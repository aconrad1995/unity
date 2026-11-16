// Unity's small shared backend. It runs inside the dev server (see vite.config.ts) and inside
// server/start.mjs on the host. Everything is kept in one file: unity.json.
//
// Who is who: each device makes a long random secret key and sends it with every request.
// The public id other people see is a one-way hash of that key, so nobody can turn an id
// back into a key and read someone else's messages.
//
// Chat safety rules enforced here (the phone-side code is not trusted):
//  - you only ever receive messages sent to you or by you
//  - messages to someone who blocked you are accepted but never delivered (they can't tell)
//  - every field is checked, every action is rate-limited
//  - a message with the same id is stored once, so a retry never double-posts
//  - the data file is written safely, backed up, and never silently reset
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DIR = resolve(process.env.UNITY_DATA_DIR || join(process.cwd(), '.data'))
const FILE = join(DIR, 'unity.json')
const MAX_BODY = 4_000_000
const EMPTY = { rev: 1, listings: [], people: {}, messages: [], blocks: {}, reports: [], roles: {}, looks: [], fit: null }

// Must match src/data.ts
const CATEGORIES = ['Sets', 'Tops', 'Bottoms', 'Bodysuits', 'Bikini', 'Accessories']
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'One size']
const CONDITIONS = ['new', 'once', 'light', 'loved']
const ART_KINDS = ['set', 'top', 'bottom', 'bodysuit', 'bikini', 'accessory']

const MAX_PER_CHAT = 2000
const MAX_LISTINGS_PER_PERSON = 50
const MAX_PHOTOS = 5
const MAX_LOOK_PHOTOS = 4

/* ---------- Saving: never lose or silently reset data ---------- */
let db
let lastBackup = 0

function tryRead(file) {
  try {
    return existsSync(file) ? { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(file, 'utf8')) } : null
  } catch {
    return null
  }
}

function load() {
  if (db) return db
  const main = tryRead(FILE)
  if (main) return (db = upgrade(main))
  if (existsSync(FILE)) {
    // The file exists but cannot be read. Keep it for inspection and fall back to the backup.
    try {
      renameSync(FILE, join(DIR, `unity.corrupt-${Date.now()}.json`))
    } catch {
      /* nothing more to do */
    }
    console.error('unity.json was unreadable; it was set aside and the backup is being used')
  }
  return (db = upgrade(tryRead(FILE + '.bak') ?? structuredClone(EMPTY)))
}

/** Older saves kept one inline photo; photos are now a list served from their own addresses. */
function upgrade(d) {
  for (const l of d.listings) {
    if (!l.photos) l.photos = l.photo ? [l.photo] : []
    delete l.photo
  }
  return d
}

function save() {
  db.rev += 1
  mkdirSync(DIR, { recursive: true })
  const now = Date.now()
  if (existsSync(FILE) && now - lastBackup > 60_000) {
    try {
      copyFileSync(FILE, FILE + '.bak')
      lastBackup = now
    } catch {
      /* the backup is best effort */
    }
  }
  writeFileSync(FILE + '.tmp', JSON.stringify(db))
  renameSync(FILE + '.tmp', FILE)
}

/* ---------- Rate limits ---------- */
const buckets = new Map()
/** Returns true when this action is allowed, and counts it. */
function allow(name, limit, windowMs) {
  const now = Date.now()
  const hits = (buckets.get(name) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(name, hits)
    return false
  }
  hits.push(now)
  buckets.set(name, hits)
  return true
}
setInterval(() => {
  const cutoff = Date.now() - 86_400_000
  for (const [k, v] of buckets) if (!v.some((t) => t > cutoff)) buckets.delete(k)
}, 600_000).unref()

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

function ipOf(req) {
  const cf = req.headers['cf-connecting-ip']
  if (typeof cf === 'string' && cf) return cf
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd) return fwd.split(',').pop().trim()
  return req.socket.remoteAddress ?? 'unknown'
}

// Many fresh keys from one address in a day is how someone dodges per-person limits.
const keysByIp = new Map()
function newIdentityAllowed(ip, me) {
  const set = keysByIp.get(ip) ?? new Set()
  if (!set.has(me) && set.size >= 25) return false
  set.add(me)
  keysByIp.set(ip, set)
  return true
}
setInterval(() => keysByIp.clear(), DAY).unref()

/* ---------- Small helpers ---------- */
const idFor = (key) => createHash('sha256').update(key).digest('hex').slice(0, 16)
const text = (v, max) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '')
const isId = (v) => typeof v === 'string' && /^[0-9a-f]{16}$/.test(v)
const isMsgId = (v) => typeof v === 'string' && /^[A-Za-z0-9-]{8,60}$/.test(v)
const hasBlocked = (a, b) => (db.blocks[a] ?? []).includes(b)
const colour = (v, fallback) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback)
// Listing photos are always re-saved as JPEG by the app, so only real JPEG data is accepted.
const jpegOk = (v, max) =>
  typeof v === 'string' && v.length <= max && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v) &&
  Buffer.from(v.slice(23, 31), 'base64').subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
const photoOk = (v, max) => typeof v === 'string' && v.length <= max && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)

/* ---------- Team roles ----------
   The shop owner and administrators prove who they are once per device by typing a team code.
   The codes are set on the host (UNITY_OWNER_CODE, UNITY_ADMIN_CODE) and never stored in the code. */
const roleOf = (id) => db.roles[id] ?? ''
const isStaff = (id) => roleOf(id) !== ''
function codeIs(given, want) {
  if (typeof want !== 'string' || want.length < 8 || typeof given !== 'string') return false
  const a = Buffer.from(given.trim())
  const b = Buffer.from(want)
  return a.length === b.length && timingSafeEqual(a, b)
}

function knownPerson(id) {
  return !!db.people[id] || db.listings.some((l) => l.ownerId === id) || db.messages.some((m) => m.from === id)
}

class Refuse extends Error {
  constructor(status, error) {
    super(error)
    this.status = status
    this.error = error
  }
}

function readBody(req) {
  return new Promise((ok, fail) => {
    let size = 0
    const parts = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        fail(new Refuse(413, 'too_big'))
        req.destroy()
      } else parts.push(c)
    })
    req.on('end', () => {
      try {
        const body = parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {}
        ok(body && typeof body === 'object' && !Array.isArray(body) ? body : {})
      } catch {
        fail(new Refuse(400, 'bad_json'))
      }
    })
    req.on('error', fail)
  })
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function snapshot(me) {
  return {
    rev: db.rev,
    me,
    // Photos are not sent in the sync; each one is fetched (and cached) from its own address.
    listings: db.listings.map(({ photos, ...l }) => ({ ...l, photoCount: photos?.length ?? 0 })),
    people: db.people,
    // Only messages this person sent, or received from someone they have not blocked.
    // Messages that were silently dropped (the sender is blocked) never reach the recipient.
    messages: db.messages
      .filter((m) => (m.from === me ? true : m.to === me && !m.dropped && !hasBlocked(me, m.from)))
      .map(({ dropped, ...m }) => m),
    blocked: db.blocks[me] ?? [],
    roles: db.roles,
    myRole: roleOf(me),
    looks: db.looks.map(({ photos, ...l }) => ({ ...l, photoCount: photos.length })),
    fit: db.fit,
  }
}

function checkLook(b) {
  const photos = Array.isArray(b.photos) ? b.photos : []
  if (photos.length < 1 || photos.length > MAX_LOOK_PHOTOS) throw new Refuse(400, 'bad_photo')
  if (!photos.every((p) => jpegOk(p, 700_000))) throw new Refuse(400, 'bad_photo')
  const brands = Array.isArray(b.brands) ? [...new Set(b.brands.map((x) => text(x, 40)).filter(Boolean))].slice(0, 8) : []
  return { caption: text(b.caption, 300), brands, photos }
}

function checkListing(b) {
  const title = text(b.title, 80)
  const brand = text(b.brand, 40)
  const price = Math.round(Number(b.price))
  if (!title || !brand) throw new Refuse(400, 'missing_details')
  if (!CATEGORIES.includes(b.category) || !SIZES.includes(b.size) || !CONDITIONS.includes(b.condition)) throw new Refuse(400, 'bad_details')
  if (!(price >= 1 && price <= 10000)) throw new Refuse(400, 'bad_price')
  const art = b.art && typeof b.art === 'object' && ART_KINDS.includes(b.art.kind)
    ? { kind: b.art.kind, bg: colour(b.art.bg, '#FFE1EF'), fill: colour(b.art.fill, '#6BC1FF'), accent: colour(b.art.accent, '#FFFFFF') }
    : undefined
  const given = Array.isArray(b.photos) ? b.photos : b.photo ? [b.photo] : []
  if (given.length > MAX_PHOTOS) throw new Refuse(400, 'too_many_photos')
  if (!given.every((p) => jpegOk(p, 700_000))) throw new Refuse(400, 'bad_photo')
  if (given.length === 0 && !art) throw new Refuse(400, 'missing_details')
  return { title, brand, category: b.category, size: b.size, condition: b.condition, price, description: text(b.description, 600), art, photos: given }
}

/* ---------- Routes ---------- */
export async function api(req, res, next) {
  const url = new URL(req.url ?? '/', 'http://x')
  if (!url.pathname.startsWith('/api/')) return next()
  const path = url.pathname.slice(5)
  load()

  try {
    // The team's view of reports. Closed unless an admin token is set on the host.
    if (path === 'admin/reports') {
      const want = process.env.UNITY_ADMIN_TOKEN
      const got = req.headers['x-unity-admin']
      const same = want && typeof got === 'string' && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want))
      if (!same) throw new Refuse(404, 'not_found')
      return send(res, 200, { reports: db.reports })
    }

    // Listing photos load as ordinary pictures, so they cannot carry the secret key. They are public like the listing.
    if (req.method === 'GET' && path.startsWith('photo/')) {
      const [, id, n] = path.split('/')
      const data = (db.listings.find((l) => l.id === id) ?? db.looks.find((l) => l.id === id))?.photos?.[Number(n)]
      if (!data) throw new Refuse(404, 'not_found')
      res.statusCode = 200
      res.setHeader('Content-Type', 'image/jpeg')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      return res.end(Buffer.from(data.slice(23), 'base64'))
    }

    const key = req.headers['x-unity-key']
    if (typeof key !== 'string' || key.length < 32 || key.length > 200) throw new Refuse(401, 'no_key')
    const me = idFor(key)
    const write = req.method !== 'GET'

    if (write) {
      const ip = ipOf(req)
      if (!allow(`ip:${ip}`, 120, MINUTE)) throw new Refuse(429, 'rate_limited')
      if (!newIdentityAllowed(ip, me)) throw new Refuse(429, 'rate_limited')
    }

    if (req.method === 'GET' && path === 'sync') {
      if (url.searchParams.get('rev') === String(db.rev)) return send(res, 200, { rev: db.rev, same: true })
      return send(res, 200, snapshot(me))
    }

    if (req.method === 'PUT' && path === 'me') {
      if (!allow(`me:${me}`, 30, MINUTE)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      db.people[me] = {
        name: text(b.name, 30),
        photo: photoOk(b.photo, 400_000) ? b.photo : '',
        upFor: Array.isArray(b.upFor) ? b.upFor.map((x) => text(x, 40)).filter(Boolean).slice(0, 8) : [],
      }
      save()
      return send(res, 200, snapshot(me))
    }

    if (req.method === 'POST' && path === 'listings') {
      // The team (the owner stocking the shop) gets far higher limits than everyone else.
      if (!allow(`list:${me}`, isStaff(me) ? 300 : 10, HOUR)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      const fields = checkListing(b)
      if (db.listings.filter((l) => l.ownerId === me).length >= (isStaff(me) ? 5000 : MAX_LISTINGS_PER_PERSON)) throw new Refuse(400, 'too_many_listings')
      db.listings.unshift({ id: randomUUID(), ownerId: me, ...fields, seller: '', sample: false, createdAt: Date.now() })
      save()
      return send(res, 200, { ...snapshot(me), id: db.listings[0].id })
    }

    if (req.method === 'DELETE' && path.startsWith('listings/')) {
      const id = path.slice(9)
      db.listings = db.listings.filter((l) => !(l.id === id && (l.ownerId === me || isStaff(me))))
      save()
      return send(res, 200, snapshot(me))
    }

    if (req.method === 'POST' && path === 'messages') {
      const b = await readBody(req)
      const to = b.to
      const body = text(b.text, 1000)
      if (!body || !isId(to) || to === me) throw new Refuse(400, 'bad_message')
      const id = isMsgId(b.id) ? b.id : randomUUID()

      // A retry of something already stored is a success, never a second copy.
      if (db.messages.some((m) => m.id === id && m.from === me)) return send(res, 200, snapshot(me))

      if (hasBlocked(me, to)) throw new Refuse(403, 'you_blocked')
      if (!knownPerson(to)) throw new Refuse(404, 'unknown_person')

      const started = !db.messages.some((m) => (m.from === me && m.to === to) || (m.from === to && m.to === me))
      if (!allow(`msg:${me}`, 20, MINUTE) || !allow(`msgday:${me}`, 300, DAY)) throw new Refuse(429, 'rate_limited')
      if (started && !allow(`chatnew:${me}`, 15, DAY)) throw new Refuse(429, 'rate_limited')

      const listingId = isMsgId(b.listingId) && db.listings.some((l) => l.id === b.listingId) ? b.listingId : undefined
      db.messages.push({ id, from: me, to, text: body, listingId, at: Date.now(), ...(hasBlocked(to, me) ? { dropped: true } : {}) })

      // Keep each chat to a sane size by letting the oldest messages go.
      const inChat = db.messages.filter((m) => (m.from === me && m.to === to) || (m.from === to && m.to === me))
      if (inChat.length > MAX_PER_CHAT) {
        const gone = new Set(inChat.slice(0, inChat.length - MAX_PER_CHAT).map((m) => m.id))
        db.messages = db.messages.filter((m) => !gone.has(m.id))
      }
      save()
      return send(res, 200, snapshot(me))
    }

    if (req.method === 'POST' && path === 'block') {
      if (!allow(`block:${me}`, 30, MINUTE)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      if (!isId(b.user) || b.user === me) throw new Refuse(400, 'bad_user')
      const list = (db.blocks[me] ?? []).filter((x) => x !== b.user)
      if (b.on) list.push(b.user)
      db.blocks[me] = list
      save()
      return send(res, 200, snapshot(me))
    }

    if (req.method === 'POST' && path === 'report') {
      if (!allow(`report:${me}`, 10, DAY)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      const reason = text(b.reason, 500)
      if (!isId(b.user) || b.user === me || !reason) throw new Refuse(400, 'bad_report')
      // The last few messages between the two people go with the report, so it can be judged.
      const evidence = db.messages
        .filter((m) => (m.from === me && m.to === b.user) || (m.from === b.user && m.to === me))
        .slice(-20)
        .map(({ dropped, ...m }) => m)
      db.reports.push({ id: randomUUID(), by: me, user: b.user, reason, evidence, at: Date.now() })
      save()
      return send(res, 200, snapshot(me))
    }

    /* ---------- Looks (Inspo) ---------- */
    if (req.method === 'POST' && path === 'looks') {
      if (!allow(`look:${me}`, isStaff(me) ? 200 : 10, DAY)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      const fields = checkLook(b)
      if (db.looks.filter((l) => l.ownerId === me).length >= (isStaff(me) ? 5000 : 200)) throw new Refuse(400, 'too_many_looks')
      db.looks.unshift({ id: randomUUID(), ownerId: me, ...fields, createdAt: Date.now() })
      save()
      return send(res, 200, { ...snapshot(me), id: db.looks[0].id })
    }

    if (req.method === 'DELETE' && path.startsWith('looks/')) {
      const id = path.slice(6)
      const look = db.looks.find((l) => l.id === id)
      if (look && (look.ownerId === me || isStaff(me))) {
        db.looks = db.looks.filter((l) => l.id !== id)
        if (db.fit?.lookId === id) db.fit = null
        save()
      }
      return send(res, 200, snapshot(me))
    }

    /* ---------- Team ---------- */
    if (req.method === 'POST' && path === 'team/claim') {
      if (!allow(`claim:${ipOf(req)}`, 8, HOUR) || !allow(`claimme:${me}`, 8, HOUR)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      const role = codeIs(b.code, process.env.UNITY_OWNER_CODE) ? 'owner' : codeIs(b.code, process.env.UNITY_ADMIN_CODE) ? 'admin' : ''
      if (!role) throw new Refuse(403, 'wrong_code')
      db.roles[me] = role
      save()
      return send(res, 200, snapshot(me))
    }

    if (path.startsWith('team/') && !isStaff(me)) throw new Refuse(404, 'not_found')

    if (req.method === 'GET' && path === 'team/reports') return send(res, 200, { reports: db.reports })

    if (req.method === 'POST' && path === 'team/resolve') {
      const b = await readBody(req)
      const r = db.reports.find((x) => x.id === b.id)
      if (!r) throw new Refuse(404, 'not_found')
      r.resolved = Date.now()
      r.resolvedBy = me
      save()
      return send(res, 200, { reports: db.reports })
    }

    if (req.method === 'POST' && path === 'team/fit') {
      const b = await readBody(req)
      if (b.lookId === null) db.fit = null
      else {
        if (!db.looks.some((l) => l.id === b.lookId)) throw new Refuse(404, 'not_found')
        db.fit = { lookId: b.lookId, note: text(b.note, 280), at: Date.now(), by: me }
      }
      save()
      return send(res, 200, snapshot(me))
    }

    throw new Refuse(404, 'not_found')
  } catch (e) {
    if (e instanceof Refuse) return send(res, e.status, { error: e.error })
    console.error('api error', e)
    return send(res, 500, { error: 'server_error' })
  }
}

/** Vite plugin: serves the API from the same address as the app. */
export const unityApi = () => ({
  name: 'unity-api',
  configureServer(server) {
    server.middlewares.use(api)
  },
  configurePreviewServer(server) {
    server.middlewares.use(api)
  },
})
