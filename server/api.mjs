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
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { writeBackup } from './backup.mjs'
import { edmtrainEvents } from './edmtrain.mjs'
import { mailReady, resetMail, sendMail, welcomeMail } from './mail.mjs'
import { checkSubscription, daysBetween, pacificNow, sendPush, setupPush } from './push.mjs'

const DIR = resolve(process.env.UNITY_DATA_DIR || join(process.cwd(), '.data'))
const FILE = join(DIR, 'unity.json')
const PHOTOS = join(DIR, 'photos')
const MAX_BODY = 4_000_000
const EMPTY = { rev: 1, listings: [], people: {}, messages: [], blocks: {}, reports: [], roles: {}, looks: [], fit: null, goingBy: {}, goingNames: {}, push: {}, pushSent: {}, ratings: {}, accounts: {}, accountOf: {}, resets: {} }

// Must match src/data.ts
const CATEGORIES = ['Sets', 'Tops', 'Bottoms', 'Bodysuits', 'Bikini', 'Accessories']
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'One size']
const CONDITIONS = ['new', 'once', 'light', 'loved']
const ART_KINDS = ['set', 'top', 'bottom', 'bodysuit', 'bikini', 'accessory']

const MAX_PER_CHAT = 2000
const MAX_LISTINGS_PER_PERSON = 50
const MAX_LOOKS_PER_PERSON = 30
const MAX_PHOTOS = 5
const MAX_LOOK_PHOTOS = 4
const MAX_BLOCKS = 500
// Photos live in their own files, not in unity.json. These caps keep one person (or a flood of
// throwaway accounts) from filling the disk. The team gets the most room so the shop can be stocked.
const MB = 1_000_000
const PHOTO_BUDGET = Number(process.env.UNITY_PHOTO_BUDGET_MB || 850) * MB
const PUBLIC_SHARE = 0.75 // everyone but the team stops at 75% of the budget
const PERSON_BYTES = 40 * MB

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

/* ---------- Photo files ---------- */
const sizes = new Map() // photo file name -> bytes
let photoBytes = 0

function countPhotos() {
  sizes.clear()
  photoBytes = 0
  if (!existsSync(PHOTOS)) return
  for (const f of readdirSync(PHOTOS)) {
    try {
      const n = statSync(join(PHOTOS, f)).size
      sizes.set(f, n)
      photoBytes += n
    } catch {
      /* gone */
    }
  }
}

function writeDurably(file, data) {
  const fd = openSync(file, 'w')
  try {
    writeSync(fd, data)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}

/** Saves a data: URL as a file and returns its name. */
function storePhoto(dataUrl, name = `${randomUUID()}.jpg`) {
  mkdirSync(PHOTOS, { recursive: true })
  const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
  writeDurably(join(PHOTOS, name), bytes)
  photoBytes += bytes.length - (sizes.get(name) ?? 0)
  sizes.set(name, bytes.length)
  return name
}

function dropPhoto(name) {
  if (typeof name !== 'string' || !sizes.has(name)) return
  try {
    unlinkSync(join(PHOTOS, name))
  } catch {
    /* already gone */
  }
  photoBytes -= sizes.get(name)
  sizes.delete(name)
}

const bytesOf = (dataUrls) => dataUrls.reduce((n, p) => n + Math.floor(((p.length - p.indexOf(',') - 1) * 3) / 4), 0)
function bytesOwnedBy(id) {
  let n = 0
  for (const x of [...db.listings, ...db.looks]) if (x.ownerId === id) for (const f of x.photos ?? []) n += sizes.get(f) ?? 0
  return n
}
/** Refuses new photos when the disk budget, or this person's share of it, is used up. */
function roomFor(id, dataUrls) {
  const add = bytesOf(dataUrls)
  if (add === 0) return
  const staff = isStaff(id)
  if (photoBytes + add > PHOTO_BUDGET * (staff ? 1 : PUBLIC_SHARE)) throw new Refuse(507, 'storage_full')
  if (!staff && bytesOwnedBy(id) + add > PERSON_BYTES) throw new Refuse(507, 'storage_full')
}

/** Older saves kept photos inside unity.json. They are moved out to files, once. */
function upgrade(d) {
  countPhotos()
  let moved = false
  for (const x of [...d.listings, ...(d.looks ?? [])]) {
    if (!x.photos) x.photos = x.photo ? [x.photo] : []
    delete x.photo
    x.photos = x.photos.map((p) => {
      if (typeof p === 'string' && p.startsWith('data:')) {
        moved = true
        return storePhoto(p)
      }
      return p
    })
  }
  for (const [id, p] of Object.entries(d.people ?? {})) {
    if (typeof p.photo === 'string' && p.photo.startsWith('data:')) {
      moved = true
      const ext = p.photo.slice(11, p.photo.indexOf(';'))
      storePhoto(p.photo, `avatar-${id}.${ext}`)
      p.photoType = ext
      p.photo = `/api/avatar/${id}/${sumOf(p.photo)}`
    }
  }
  d.roleCodes ??= {}
  d.goingBy ??= {}
  d.goingNames ??= {}
  d.push ??= {}
  d.pushSent ??= {}
  d.ratings ??= {}
  d.accounts ??= {}
  d.accountOf ??= {}
  d.resets ??= {}
  d.authFails ??= []
  if (moved) {
    db = d
    save()
  }
  return d
}

/** Writes everything to disk. If that fails, the change is undone so memory and disk agree. */
function save() {
  db.rev += 1
  try {
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
    writeDurably(FILE + '.tmp', JSON.stringify(db))
    renameSync(FILE + '.tmp', FILE)
  } catch (e) {
    console.error('could not save unity.json', e)
    db = undefined
    load()
    throw new Refuse(503, 'not_saved')
  }
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

// On Render every request comes through Cloudflare, which sets cf-connecting-ip itself and
// overwrites anything a visitor sends. Anywhere else that header is just text from the visitor,
// so it is ignored.
const BEHIND_CLOUDFLARE = process.env.UNITY_TRUST_CF === '1' || (process.env.RENDER === 'true' && process.env.UNITY_TRUST_CF !== '0')
function ipOf(req) {
  const cf = req.headers['cf-connecting-ip']
  if (BEHIND_CLOUDFLARE && typeof cf === 'string' && cf) return cf
  return req.socket.remoteAddress ?? 'unknown'
}

// Many fresh keys from one address in a day is how someone dodges per-person limits.
const NEW_KEYS_PER_IP = Number(process.env.UNITY_NEW_KEYS_PER_IP || 150)
const keysByIp = new Map()
function newIdentityAllowed(ip, me) {
  const set = keysByIp.get(ip) ?? new Set()
  // Generous, because festival wifi and phone networks put many real people behind one address.
  if (!set.has(me) && set.size >= NEW_KEYS_PER_IP) return false
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
// A small, stable fingerprint of a picture, worked out the same way by the app (store.ts).
function sumOf(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}
const photoOk = (v, max) => typeof v === 'string' && v.length <= max && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)

/* ---------- Team roles ----------
   The shop owner and administrators prove who they are once per device by typing a team code.
   The codes are set on the host (UNITY_OWNER_CODE, UNITY_ADMIN_CODE) and never stored in the code. */
const CODE_ENV = { owner: 'UNITY_OWNER_CODE', admin: 'UNITY_ADMIN_CODE' }
const MIN_CODE = 12
const codeTag = (code) => createHash('sha256').update(`unity-role:${code}`).digest('hex').slice(0, 16)
// A role only counts while the code it was claimed with is still the one set on the host.
// Changing a code in Render signs every device that used the old one out of the team.
function roleOf(id) {
  const role = db.roles[id]
  const want = role && process.env[CODE_ENV[role]]
  return want && want.length >= MIN_CODE && db.roleCodes[id] === codeTag(want) ? role : ''
}
const isStaff = (id) => roleOf(id) !== ''
function codeIs(given, want) {
  if (typeof want !== 'string' || want.length < MIN_CODE || typeof given !== 'string') return false
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

function sendPhoto(res, file, type) {
  let data
  try {
    if (typeof file === 'string' && sizes.has(file)) data = readFileSync(join(PHOTOS, file))
  } catch {
    /* missing */
  }
  if (!data) throw new Refuse(404, 'not_found')
  res.statusCode = 200
  res.setHeader('Content-Type', type)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  return res.end(data)
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
    // photoV changes whenever the photos do, so their long-cached addresses change with them.
    listings: db.listings.map(({ photos, ...l }) => ({ ...l, photoCount: photos?.length ?? 0, ...(photos?.length ? { photoV: sumOf(photos.join()) } : {}) })),
    people: Object.fromEntries(Object.entries(db.people).map(([id, { photoType, ...p }]) => [id, p])),
    // Only messages this person sent, or received from someone they have not blocked.
    // Messages that were silently dropped (the sender is blocked) never reach the recipient.
    messages: db.messages
      .filter((m) => (m.from === me ? true : m.to === me && !m.dropped && !hasBlocked(me, m.from)))
      .map(({ dropped, ...m }) => m),
    blocked: db.blocks[me] ?? [],
    roles: Object.fromEntries(Object.keys(db.roles).map((id) => [id, roleOf(id)]).filter(([, r]) => r)),
    myRole: roleOf(me),
    looks: db.looks.map(({ photos, ...l }) => ({ ...l, photoCount: photos.length })),
    fit: db.fit,
    ratings: publicRatings(),
    sellers: sellerFacts(),
    account: db.accountOf[me] ?? null,
    // Whether "Forgot your password?" can email a link, or has to go through the team.
    mailOn: mailReady(),
  }
}

/* ---------- Seller ratings ----------
   You can rate someone only after a real two-way chat: you wrote to them and they wrote back.
   One rating per person per seller, which they can change or take back. */
const MAX_NOTES_SHOWN = 30
function publicRatings() {
  const out = {}
  for (const [of, by] of Object.entries(db.ratings)) {
    const list = Object.entries(by).map(([who, r]) => ({ by: who, ...r })).sort((x, y) => y.at - x.at)
    if (!list.length) continue
    out[of] = {
      count: list.length,
      average: Math.round((list.reduce((n, r) => n + r.stars, 0) / list.length) * 10) / 10,
      recent: list.slice(0, MAX_NOTES_SHOWN),
    }
  }
  return out
}
/** For each seller: when they first listed, and how many outfits they've marked sold. Shown on listings
    and in chats so buyers can tell a regular from someone brand new. */
function sellerFacts() {
  const out = {}
  for (const l of db.listings) {
    if (!l.ownerId) continue
    const s = (out[l.ownerId] ??= { since: l.createdAt ?? 0, sold: 0 })
    if (l.createdAt && (!s.since || l.createdAt < s.since)) s.since = l.createdAt
    if (l.status === 'sold') s.sold++
  }
  return out
}
/** Whether "me" may rate "of": they're a seller, and both have written to each other (and nothing was dropped by a block). */
function mayRate(me, of) {
  if (!isId(of) || of === me) return false
  if (!db.listings.some((l) => l.ownerId === of)) return false
  const wrote = db.messages.some((m) => m.from === me && m.to === of && !m.dropped)
  const replied = db.messages.some((m) => m.from === of && m.to === me && !m.dropped)
  return wrote && replied
}

/* ---------- Accounts: an email and password that lead back to this device's secret key ----------
   Signing in on another phone hands that phone the same secret key, so it becomes the same person:
   same listings, chats, ratings and team role. The key is kept encrypted with a server secret
   (UNITY_ACCOUNT_SECRET, or account-secret next to the data file); passwords are kept as scrypt hashes. */
const scrypt = promisify(scryptCb)
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,100}\.[a-z]{2,24}$/i
let accountSecret
function secret() {
  if (accountSecret) return accountSecret
  const env = process.env.UNITY_ACCOUNT_SECRET
  if (env && /^[0-9a-f]{64}$/i.test(env)) return (accountSecret = Buffer.from(env, 'hex'))
  const file = join(DIR, 'account-secret')
  try {
    if (existsSync(file)) {
      const b = Buffer.from(readFileSync(file, 'utf8').trim(), 'hex')
      if (b.length === 32) return (accountSecret = b)
    }
  } catch {
    /* made below */
  }
  const b = randomBytes(32)
  mkdirSync(DIR, { recursive: true })
  writeFileSync(file, b.toString('hex'), { mode: 0o600 })
  return (accountSecret = b)
}
function seal(key) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', secret(), iv)
  const body = Buffer.concat([c.update(key, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), body].map((b) => b.toString('base64')).join('.')
}
function unseal(sealed) {
  const [iv, tag, body] = sealed.split('.').map((x) => Buffer.from(x, 'base64'))
  const d = createDecipheriv('aes-256-gcm', secret(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(body), d.final()]).toString('utf8')
}
const hashOf = async (password, salt) => (await scrypt(password, Buffer.from(salt, 'hex'), 32)).toString('hex')
const tokenTag = (token) => createHash('sha256').update(`unity-reset:${token}`).digest('hex')
const passwordOk = (v) => typeof v === 'string' && v.length >= 8 && v.length <= 200
const emailOf = (v) => (typeof v === 'string' && v.trim().length <= 160 && EMAIL.test(v.trim()) ? v.trim().toLowerCase() : '')
async function checkPassword(account, password) {
  const want = Buffer.from(account?.hash ?? '0'.repeat(64), 'hex')
  // Unknown emails take as long as known ones, so timing doesn't reveal who has an account.
  // Over-long guesses are hashed as empty, so nobody can make the server hash megabytes per try.
  const given = typeof password === 'string' && password.length <= 200 ? password : ''
  const got = Buffer.from(await hashOf(given, account?.salt ?? '00'.repeat(16)), 'hex')
  if (given !== password) return false
  return !!account && got.length === want.length && timingSafeEqual(got, want)
}

/** An Instagram handle from whatever was typed: "@name", "name" or a profile link. '' when it isn't one. */
function instagramOf(v) {
  if (typeof v !== 'string') return ''
  const h = v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : ''
}

function checkLook(b) {
  const photos = Array.isArray(b.photos) ? b.photos : []
  if (photos.length < 1 || photos.length > MAX_LOOK_PHOTOS) throw new Refuse(400, 'bad_photo')
  if (!photos.every((p) => jpegOk(p, 700_000))) throw new Refuse(400, 'bad_photo')
  const brands = Array.isArray(b.brands) ? [...new Set(b.brands.map((x) => text(x, 40)).filter(Boolean))].slice(0, 8) : []
  return { caption: text(b.caption, 300), brands, photos }
}

const SHIP_DAYS = [1, 3, 7]

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
  const wornAt = text(b.wornAt, 60)
  const shipDays = SHIP_DAYS.includes(Number(b.shipDays)) ? Number(b.shipDays) : undefined
  return { title, brand, category: b.category, size: b.size, condition: b.condition, price, description: text(b.description, 600), art, photos: given, ...(wornAt ? { wornAt } : {}), ...(shipDays ? { shipDays } : {}) }
}

// Names that would let someone pass themselves off as the shop or the team.
const squash = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
function nameReserved(name, me) {
  const n = squash(name)
  if (!n) return false
  if (/unity|shopowner|owner|admin|official|moderator|staff/.test(n)) return true
  return Object.keys(db.roles).some((id) => id !== me && roleOf(id) && squash(db.people[id]?.name ?? '') === n)
}

/* ---------- Routes ---------- */
/* ---------- Who's going: counts per festival, never names ---------- */
const EVENT_ID = /^[a-z0-9][a-z0-9-]{2,79}$/
const MAX_GOING = 100
let counts = { rev: -1, value: {} }
function goingCounts() {
  if (counts.rev === db.rev) return counts.value
  const value = {}
  for (const ids of Object.values(db.goingBy)) for (const id of ids) value[id] = (value[id] ?? 0) + 1
  counts = { rev: db.rev, value }
  return value
}

/* ---------- Push alerts ---------- */
const MAX_DEVICES = 5
/** Sends an alert to every device this person turned alerts on for. Drops devices that have gone. */
async function notify(person, payload) {
  const subs = db.push[person] ?? []
  if (!subs.length) return
  const results = await Promise.all(subs.map((sub) => sendPush(sub, payload)))
  const kept = subs.filter((_, i) => results[i] !== 'gone')
  if (kept.length !== subs.length) {
    if (kept.length) db.push[person] = kept
    else delete db.push[person]
    try {
      save()
    } catch {
      /* tried again next time */
    }
  }
}

/** A week before and the day before each festival someone marked, once, during the day in Pacific time. */
export async function sendCountdowns(now = new Date()) {
  load()
  const { date: today, hour } = pacificNow(now)
  if (hour < 10 || hour >= 20) return 0
  let sent = 0
  let changed = false
  for (const [person, ids] of Object.entries(db.goingBy)) {
    if (!db.push[person]) continue
    for (const id of ids) {
      const start = /-(\d{4}-\d{2}-\d{2})$/.exec(id)?.[1]
      if (!start) continue // dates not announced yet
      const left = daysBetween(today, start)
      if (left !== 7 && left !== 1) continue
      const mark = `${person}|${id}|${left}`
      if (db.pushSent[mark]) continue
      db.pushSent[mark] = Date.now()
      changed = true
      const name = db.goingNames[person]?.[id] || 'Your festival'
      await notify(person, {
        title: left === 1 ? `${name} is tomorrow` : `${name} is a week away`,
        body: left === 1 ? 'Outfit sorted? Check your list and charge your phone.' : 'Still need a look? See what’s on Unity that arrives in time.',
        url: left === 1 ? '#/events' : '#/',
        tag: `countdown-${id}`,
      })
      sent++
    }
  }
  if (changed) {
    const old = Date.now() - 60 * 86_400_000
    for (const [k, t] of Object.entries(db.pushSent)) if (t < old) delete db.pushSent[k]
    try {
      save()
    } catch {
      /* the marks are kept in memory until the next save */
    }
  }
  return sent
}
if (process.env.NODE_ENV !== 'test' && !process.env.UNITY_NO_TIMERS) {
  setInterval(() => sendCountdowns().catch((e) => console.error('countdown alerts failed', e)), 30 * MINUTE).unref()
}

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

    // An encrypted copy of everything, fetched nightly by the GitHub backup job. Closed unless
    // UNITY_BACKUP_TOKEN (32+ characters) is set; the same token is needed to open the file.
    if (req.method === 'GET' && path === 'admin/backup') {
      if (!allow(`backup:${ipOf(req)}`, 10, HOUR)) throw new Refuse(429, 'rate_limited')
      const want = process.env.UNITY_BACKUP_TOKEN
      const got = req.headers['x-unity-backup']
      const same = want && want.length >= 32 && typeof got === 'string' && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want))
      if (!same) throw new Refuse(404, 'not_found')
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="unity-backup.bin"' })
      try {
        await writeBackup(DIR, want, res)
      } catch (e) {
        console.error('backup failed', e)
        res.destroy() // the job sees a broken download, not a short file that looks fine
      }
      return
    }

    // Public festival listings from EDMTrain. Empty unless the host has a key.
    if (req.method === 'GET' && path === 'events') {
      return send(res, 200, { events: await edmtrainEvents() })
    }

    // The public half of the key that signs push alerts. Browsers need it to subscribe.
    if (req.method === 'GET' && path === 'push/key') return send(res, 200, { key: setupPush(DIR).publicKey })

    // How many people marked each festival. Only totals leave the server.
    if (req.method === 'GET' && path === 'going') return send(res, 200, { counts: goingCounts() })

    // Listing photos load as ordinary pictures, so they cannot carry the secret key. They are public like the listing.
    if (req.method === 'GET' && path.startsWith('photo/')) {
      const [, id, n] = path.split('/')
      const file = (db.listings.find((l) => l.id === id) ?? db.looks.find((l) => l.id === id))?.photos?.[Number(n)]
      return sendPhoto(res, file, 'image/jpeg')
    }
    if (req.method === 'GET' && path.startsWith('avatar/')) {
      const [, id] = path.split('/')
      const type = isId(id) ? db.people[id]?.photoType : undefined
      return sendPhoto(res, type && `avatar-${id}.${type}`, `image/${type}`)
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
      const name = text(b.name, 30)
      if (!isStaff(me) && nameReserved(name, me)) throw new Refuse(400, 'name_reserved')
      const was = db.people[me]
      const next = { name, photo: '', upFor: Array.isArray(b.upFor) ? b.upFor.map((x) => text(x, 40)).filter(Boolean).slice(0, 8) : [] }
      const instagram = instagramOf(b.instagram)
      // The shop's own handle can't be borrowed to look official.
      if (instagram && !isStaff(me) && /^unity/.test(squash(instagram))) throw new Refuse(400, 'handle_reserved')
      if (instagram) next.instagram = instagram
      if (photoOk(b.photo, 400_000)) {
        next.photo = `/api/avatar/${me}/${sumOf(b.photo)}`
        next.photoType = b.photo.slice(11, b.photo.indexOf(';'))
        if (was?.photo !== next.photo) {
          if (was?.photoType) dropPhoto(`avatar-${me}.${was.photoType}`)
          roomFor(me, [b.photo])
          storePhoto(b.photo, `avatar-${me}.${next.photoType}`)
        }
      } else if (was?.photoType) dropPhoto(`avatar-${me}.${was.photoType}`)
      if (JSON.stringify(was) !== JSON.stringify(next)) {
        db.people[me] = next
        save()
      }
      return send(res, 200, snapshot(me))
    }

    // Turn alerts on for this device, or off.
    if (path === 'push' && (req.method === 'PUT' || req.method === 'DELETE')) {
      if (!allow(`push:${me}`, 20, HOUR)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      const mine = db.push[me] ?? []
      if (req.method === 'DELETE') {
        const left = mine.filter((x) => x.endpoint !== b.endpoint)
        if (left.length !== mine.length) {
          if (left.length) db.push[me] = left
          else delete db.push[me]
          save()
        }
        return send(res, 200, { on: false })
      }
      const sub = checkSubscription(b.subscription)
      if (!sub) throw new Refuse(400, 'bad_subscription')
      setupPush(DIR)
      db.push[me] = [...mine.filter((x) => x.endpoint !== sub.endpoint), sub].slice(-MAX_DEVICES)
      save()
      return send(res, 200, { on: true })
    }

    // The whole list of festivals this person marked, replacing what was there.
    if (req.method === 'PUT' && path === 'going') {
      if (!allow(`going:${me}`, 60, MINUTE)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      const ids = Array.isArray(b.ids) ? [...new Set(b.ids.filter((x) => typeof x === 'string' && EVENT_ID.test(x)))].slice(0, MAX_GOING) : []
      // Festival names, only for this person's own countdown alerts. Never shown to anyone else.
      const names = {}
      if (b.names && typeof b.names === 'object') for (const id of ids) if (typeof b.names[id] === 'string') names[id] = text(b.names[id], 60)
      const sameNames = JSON.stringify(db.goingNames[me] ?? {}) === JSON.stringify(names)
      if ((db.goingBy[me] ?? []).join('|') !== ids.join('|') || !sameNames) {
        if (ids.length) db.goingBy[me] = ids
        else delete db.goingBy[me]
        if (Object.keys(names).length) db.goingNames[me] = names
        else delete db.goingNames[me]
        save()
      }
      return send(res, 200, { counts: goingCounts() })
    }

    // Make an account for this device's identity.
    if (req.method === 'POST' && path === 'account/signup') {
      if (!allow(`signup:${me}`, 10, HOUR)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      const email = emailOf(b.email)
      if (!email) throw new Refuse(400, 'bad_email')
      if (!passwordOk(b.password)) throw new Refuse(400, 'weak_password')
      if (db.accountOf[me]) throw new Refuse(409, 'has_account')
      if (db.accounts[email]) throw new Refuse(409, 'email_taken')
      const salt = randomBytes(16).toString('hex')
      const hash = await hashOf(b.password, salt)
      if (db.accounts[email] || db.accountOf[me]) throw new Refuse(409, 'email_taken')
      db.accounts[email] = { id: me, salt, hash, sealed: seal(key), at: Date.now() }
      db.accountOf[me] = email
      save()
      // Lets them know it worked, and shows early if the address was mistyped. Not waited on.
      void sendMail(welcomeMail(email))
      return send(res, 200, snapshot(me))
    }

    // Sign in: hands back the account's secret key so this device becomes that person.
    if (req.method === 'POST' && path === 'account/signin') {
      const b = await readBody(req)
      const email = emailOf(b.email)
      if (!allow(`signin-ip:${ipOf(req)}`, 30, HOUR) || (email && !allow(`signin:${email}`, 10, HOUR))) throw new Refuse(429, 'rate_limited')
      const account = email ? db.accounts[email] : undefined
      if (!(await checkPassword(account, b.password))) throw new Refuse(401, 'wrong_login')
      return send(res, 200, { key: unseal(account.sealed) })
    }

    // Forgot password: email a one-time link. The answer is the same whether or not the email has an
    // account, so this can't be used to find out who uses Unity.
    if (req.method === 'POST' && path === 'account/forgot') {
      if (!mailReady()) throw new Refuse(503, 'mail_off')
      const b = await readBody(req)
      const email = emailOf(b.email)
      if (!email) throw new Refuse(400, 'bad_email')
      if (!allow(`forgot-ip:${ipOf(req)}`, 10, HOUR) || !allow(`forgot:${email}`, 3, HOUR)) throw new Refuse(429, 'rate_limited')
      if (db.accounts[email]) {
        const token = randomBytes(32).toString('base64url')
        // Only a fingerprint of the link is kept, and a new link replaces any older one.
        for (const [k, r] of Object.entries(db.resets)) if (r.email === email || r.exp < Date.now()) delete db.resets[k]
        db.resets[tokenTag(token)] = { email, exp: Date.now() + HOUR }
        save()
        void sendMail(resetMail(email, token))
      }
      return send(res, 200, { sent: true })
    }

    // Reset: a valid link and a new password. Signs this device in, like signing in does.
    if (req.method === 'POST' && path === 'account/reset') {
      if (!allow(`reset-ip:${ipOf(req)}`, 20, HOUR)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      const tag = typeof b.token === 'string' && b.token.length <= 100 ? tokenTag(b.token) : ''
      const r = tag ? db.resets[tag] : undefined
      if (!r || r.exp < Date.now() || !db.accounts[r.email]) {
        if (r) { delete db.resets[tag]; save() }
        throw new Refuse(410, 'link_expired')
      }
      if (!passwordOk(b.password)) throw new Refuse(400, 'weak_password')
      const salt = randomBytes(16).toString('hex')
      db.accounts[r.email] = { ...db.accounts[r.email], salt, hash: await hashOf(b.password, salt) }
      delete db.resets[tag]
      save()
      return send(res, 200, { key: unseal(db.accounts[r.email].sealed) })
    }

    if (req.method === 'POST' && path === 'account/password') {
      if (!allow(`pw:${me}`, 10, HOUR)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      const email = db.accountOf[me]
      if (!email) throw new Refuse(404, 'no_account')
      if (!(await checkPassword(db.accounts[email], b.current))) throw new Refuse(401, 'wrong_login')
      if (!passwordOk(b.next)) throw new Refuse(400, 'weak_password')
      const salt = randomBytes(16).toString('hex')
      db.accounts[email] = { ...db.accounts[email], salt, hash: await hashOf(b.next, salt) }
      save()
      return send(res, 200, snapshot(me))
    }

    // Rate a seller, change your rating, or take it back.
    if (path === 'ratings' && (req.method === 'PUT' || req.method === 'DELETE')) {
      if (!allow(`rate:${me}`, 30, DAY)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      if (!isId(b.of) || b.of === me) throw new Refuse(400, 'bad_rating')
      if (req.method === 'DELETE') {
        if (db.ratings[b.of]?.[me]) {
          delete db.ratings[b.of][me]
          if (!Object.keys(db.ratings[b.of]).length) delete db.ratings[b.of]
          save()
        }
        return send(res, 200, snapshot(me))
      }
      const stars = typeof b.stars === 'number' ? b.stars : NaN
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Refuse(400, 'bad_rating')
      if (!mayRate(me, b.of)) throw new Refuse(403, 'chat_first')
      const was = db.ratings[b.of]?.[me]
      const note = text(b.note, 200)
      if (!was || was.stars !== stars || was.note !== note) {
        db.ratings[b.of] = { ...db.ratings[b.of], [me]: { stars, note, at: Date.now() } }
        save()
      }
      return send(res, 200, snapshot(me))
    }

    if (req.method === 'POST' && path === 'listings') {
      // The team (the owner stocking the shop) gets far higher limits than everyone else.
      if (!allow(`list:${me}`, isStaff(me) ? 300 : 10, HOUR)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      const fields = checkListing(b)
      if (db.listings.filter((l) => l.ownerId === me).length >= (isStaff(me) ? 5000 : MAX_LISTINGS_PER_PERSON)) throw new Refuse(400, 'too_many_listings')
      roomFor(me, fields.photos)
      const photos = fields.photos.map((p) => storePhoto(p))
      db.listings.unshift({ id: randomUUID(), ownerId: me, ...fields, photos, seller: '', sample: false, createdAt: Date.now() })
      try {
        save()
      } catch (e) {
        photos.forEach(dropPhoto)
        throw e
      }
      return send(res, 200, { ...snapshot(me), id: db.listings[0].id })
    }

    if (req.method === 'DELETE' && path.startsWith('listings/')) {
      const id = path.slice(9)
      const gone = db.listings.find((l) => l.id === id && (l.ownerId === me || isStaff(me)))
      if (gone) {
        db.listings = db.listings.filter((l) => l !== gone)
        save()
        gone.photos.forEach(dropPhoto)
      }
      return send(res, 200, snapshot(me))
    }

    // Change a listing's details, or mark it sold / reserved.
    if (req.method === 'PATCH' && path.startsWith('listings/')) {
      if (!allow(`edit:${me}`, 120, HOUR)) throw new Refuse(429, 'rate_limited')
      const l = db.listings.find((x) => x.id === path.slice(9) && (x.ownerId === me || isStaff(me)))
      if (!l) throw new Refuse(404, 'not_found')
      const b = await readBody(req)
      const next = { ...l }
      if ('title' in b) next.title = text(b.title, 80)
      if ('description' in b) next.description = text(b.description, 600)
      if ('price' in b) next.price = Math.round(Number(b.price))
      if ('size' in b) next.size = b.size
      if ('condition' in b) next.condition = b.condition
      if ('shipDays' in b) {
        if (SHIP_DAYS.includes(Number(b.shipDays))) next.shipDays = Number(b.shipDays)
        else if (b.shipDays === null) delete next.shipDays
      }
      if ('status' in b) next.status = ['sold', 'reserved'].includes(b.status) ? b.status : undefined
      if (!next.title || !(next.price >= 1 && next.price <= 10000) || !SIZES.includes(next.size) || !CONDITIONS.includes(next.condition)) throw new Refuse(400, 'bad_details')
      if (next.status === 'sold' && l.status !== 'sold') next.soldAt = Date.now()
      if (next.status !== 'sold') delete next.soldAt
      if (!next.status) delete next.status
      // Photos: the new order, where a number keeps an existing photo and a JPEG adds one.
      let dropped = []
      if ('photos' in b) {
        const want = Array.isArray(b.photos) ? b.photos : []
        const old = l.photos ?? []
        if (want.length < 1) throw new Refuse(400, 'bad_photo')
        if (want.length > MAX_PHOTOS) throw new Refuse(400, 'too_many_photos')
        const kept = want.filter((p) => typeof p === 'number')
        if (!kept.every((i) => Number.isInteger(i) && i >= 0 && i < old.length) || new Set(kept).size !== kept.length) throw new Refuse(400, 'bad_photo')
        const fresh = want.filter((p) => typeof p !== 'number')
        if (!fresh.every((p) => jpegOk(p, 700_000))) throw new Refuse(400, 'bad_photo')
        roomFor(me, fresh)
        next.photos = want.map((p) => (typeof p === 'number' ? old[p] : storePhoto(p)))
        dropped = old.filter((f) => !next.photos.includes(f))
      }
      if (JSON.stringify(next) !== JSON.stringify(l)) {
        Object.keys(l).forEach((k) => delete l[k])
        Object.assign(l, next)
        save()
      }
      // Old files go only once the listing no longer points at them.
      dropped.forEach(dropPhoto)
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

      const about = isMsgId(b.listingId) ? db.listings.find((l) => l.id === b.listingId) : undefined
      // The outfit's name is kept with the message, so the chat still makes sense after it is sold or removed.
      db.messages.push({
        id, from: me, to, text: body, listingId: about?.id, about: about?.title, at: Date.now(),
        ...(hasBlocked(to, me) ? { dropped: true } : {}),
      })

      // Keep each chat to a sane size by letting the oldest messages go.
      const inChat = db.messages.filter((m) => (m.from === me && m.to === to) || (m.from === to && m.to === me))
      if (inChat.length > MAX_PER_CHAT) {
        const gone = new Set(inChat.slice(0, inChat.length - MAX_PER_CHAT).map((m) => m.id))
        db.messages = db.messages.filter((m) => !gone.has(m.id))
      }
      save()
      // A ping for the person it's to, unless they blocked the sender. One per chat every two minutes, so a burst is one alert.
      if (!hasBlocked(to, me) && db.push[to] && allow(`ping:${me}:${to}`, 1, 2 * MINUTE)) {
        const who = db.people[me]?.name?.trim() || 'Someone new'
        void notify(to, { title: who, body: about ? `About ${about.title}: ${body.slice(0, 120)}` : body.slice(0, 140), url: `#/chats/${me}`, tag: `chat-${me}` })
      }
      return send(res, 200, snapshot(me))
    }

    if (req.method === 'POST' && path === 'block') {
      if (!allow(`block:${me}`, 30, MINUTE)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      if (!isId(b.user) || b.user === me) throw new Refuse(400, 'bad_user')
      const was = db.blocks[me] ?? []
      const list = was.filter((x) => x !== b.user)
      if (b.on) {
        if (!knownPerson(b.user)) throw new Refuse(404, 'unknown_person')
        if (list.length >= MAX_BLOCKS) throw new Refuse(400, 'too_many_blocks')
        list.push(b.user)
      }
      if (list.join() !== was.join()) {
        db.blocks[me] = list
        save()
      }
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
      if (db.looks.filter((l) => l.ownerId === me).length >= (isStaff(me) ? 5000 : MAX_LOOKS_PER_PERSON)) throw new Refuse(400, 'too_many_looks')
      roomFor(me, fields.photos)
      const photos = fields.photos.map((p) => storePhoto(p))
      db.looks.unshift({ id: randomUUID(), ownerId: me, ...fields, photos, createdAt: Date.now() })
      try {
        save()
      } catch (e) {
        photos.forEach(dropPhoto)
        throw e
      }
      return send(res, 200, { ...snapshot(me), id: db.looks[0].id })
    }

    if (req.method === 'DELETE' && path.startsWith('looks/')) {
      const id = path.slice(6)
      const look = db.looks.find((l) => l.id === id)
      if (look && (look.ownerId === me || isStaff(me))) {
        db.looks = db.looks.filter((l) => l.id !== id)
        if (db.fit?.lookId === id) db.fit = null
        save()
        look.photos.forEach(dropPhoto)
      }
      return send(res, 200, snapshot(me))
    }

    /* ---------- Team ---------- */
    if (req.method === 'POST' && path === 'team/claim') {
      // Wrong guesses from everyone together are capped, so even a flood of new devices and
      // addresses gets very few tries. The real team can always try again an hour later.
      const now = Date.now()
      db.authFails = db.authFails.filter((t) => now - t < HOUR)
      if (db.authFails.length >= 20) throw new Refuse(429, 'rate_limited')
      if (!allow(`claim:${ipOf(req)}`, 8, HOUR) || !allow(`claimme:${me}`, 8, HOUR)) throw new Refuse(429, 'rate_limited')
      const b = await readBody(req)
      const role = codeIs(b.code, process.env.UNITY_OWNER_CODE) ? 'owner' : codeIs(b.code, process.env.UNITY_ADMIN_CODE) ? 'admin' : ''
      if (!role) {
        db.authFails.push(now)
        save()
        console.warn('team sign-in: wrong code')
        throw new Refuse(403, 'wrong_code')
      }
      db.roles[me] = role
      db.roleCodes[me] = codeTag(process.env[CODE_ENV[role]])
      console.warn(`team sign-in: ${me} is now ${role}`)
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

    // The team sets a new password for someone who forgot theirs (after checking it's really them).
    if (req.method === 'POST' && path === 'team/account-reset') {
      const b = await readBody(req)
      const email = emailOf(b.email)
      if (!email || !db.accounts[email]) throw new Refuse(404, 'not_found')
      if (!passwordOk(b.password)) throw new Refuse(400, 'weak_password')
      const salt = randomBytes(16).toString('hex')
      db.accounts[email] = { ...db.accounts[email], salt, hash: await hashOf(b.password, salt) }
      console.warn(`team: password reset for an account by ${me}`)
      save()
      return send(res, 200, { ok: true })
    }

    // The team takes down a rating that breaks the rules.
    if (req.method === 'POST' && path === 'team/rating-remove') {
      const b = await readBody(req)
      if (!db.ratings[b.of]?.[b.by]) throw new Refuse(404, 'not_found')
      delete db.ratings[b.of][b.by]
      if (!Object.keys(db.ratings[b.of]).length) delete db.ratings[b.of]
      save()
      return send(res, 200, snapshot(me))
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
