// Unity's small shared backend. It runs inside the dev server (see vite.config.ts) and keeps
// everything in one file: .data/unity.json. It is enough for people on the same computer or
// wifi to list outfits and message each other. Swap it for a hosted service before a public launch.
//
// Who is who: each device makes a long random secret key and sends it with every request.
// The public id other people see is a one-way hash of that key, so nobody can turn an id
// back into a key and read someone else's messages.
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const FILE = resolve(process.env.UNITY_DATA_DIR || resolve(process.cwd(), '.data'), 'unity.json')
const MAX_BODY = 2_000_000
const EMPTY = { rev: 1, listings: [], people: {}, messages: [], blocks: {}, reports: [] }

let db
function load() {
  if (db) return db
  try {
    db = existsSync(FILE) ? { ...EMPTY, ...JSON.parse(readFileSync(FILE, 'utf8')) } : structuredClone(EMPTY)
  } catch {
    db = structuredClone(EMPTY)
  }
  return db
}
function save() {
  db.rev += 1
  mkdirSync(dirname(FILE), { recursive: true })
  writeFileSync(FILE + '.tmp', JSON.stringify(db))
  renameSync(FILE + '.tmp', FILE)
}

const idFor = (key) => createHash('sha256').update(key).digest('hex').slice(0, 16)
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const blocked = (a, b) => (db.blocks[a] ?? []).includes(b) || (db.blocks[b] ?? []).includes(a)

function readBody(req) {
  return new Promise((ok, fail) => {
    let size = 0
    const parts = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        fail(new Error('too big'))
        req.destroy()
      } else parts.push(c)
    })
    req.on('end', () => {
      try {
        ok(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {})
      } catch {
        fail(new Error('bad json'))
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
  const mine = db.blocks[me] ?? []
  return {
    rev: db.rev,
    me,
    listings: db.listings,
    people: db.people,
    // Only messages this person sent or received. Messages from someone they blocked are hidden.
    messages: db.messages.filter((m) => (m.from === me || m.to === me) && !mine.includes(m.from === me ? m.to : m.from)),
    blocked: mine,
  }
}

export async function api(req, res, next) {
  const url = new URL(req.url ?? '/', 'http://x')
  if (!url.pathname.startsWith('/api/')) return next()
  const key = req.headers['x-unity-key']
  if (typeof key !== 'string' || key.length < 32 || key.length > 200) return send(res, 401, { error: 'no key' })
  const me = idFor(key)
  const path = url.pathname.slice(5)
  load()

  try {
    if (req.method === 'GET' && path === 'sync') {
      if (url.searchParams.get('rev') === String(db.rev)) return send(res, 200, { rev: db.rev, same: true })
      return send(res, 200, snapshot(me))
    }

    if (req.method === 'PUT' && path === 'me') {
      const b = await readBody(req)
      const photo = typeof b.photo === 'string' && b.photo.startsWith('data:image/') ? b.photo : ''
      db.people[me] = {
        name: text(b.name, 30),
        photo,
        upFor: Array.isArray(b.upFor) ? b.upFor.map((x) => text(x, 40)).filter(Boolean).slice(0, 8) : [],
      }
      save()
      return send(res, 200, snapshot(me))
    }

    if (req.method === 'POST' && path === 'listings') {
      const b = await readBody(req)
      const price = Math.round(Number(b.price))
      if (!text(b.title, 80) || !text(b.brand, 40) || !(price > 0)) return send(res, 400, { error: 'missing details' })
      db.listings.unshift({
        id: randomUUID(),
        ownerId: me,
        title: text(b.title, 80),
        brand: text(b.brand, 40),
        category: text(b.category, 20),
        size: text(b.size, 20),
        condition: text(b.condition, 10),
        price,
        description: text(b.description, 600),
        seller: '',
        sample: false,
        createdAt: Date.now(),
        photo: typeof b.photo === 'string' && b.photo.startsWith('data:image/') ? b.photo : undefined,
        art: b.art && typeof b.art === 'object' ? b.art : undefined,
      })
      save()
      return send(res, 200, { ...snapshot(me), id: db.listings[0].id })
    }

    if (req.method === 'DELETE' && path.startsWith('listings/')) {
      const id = path.slice(9)
      db.listings = db.listings.filter((l) => !(l.id === id && l.ownerId === me))
      save()
      return send(res, 200, snapshot(me))
    }

    if (req.method === 'POST' && path === 'messages') {
      const b = await readBody(req)
      const to = text(b.to, 16)
      const body = text(b.text, 1000)
      if (!body || !/^[0-9a-f]{16}$/.test(to) || to === me) return send(res, 400, { error: 'bad message' })
      if (blocked(me, to)) return send(res, 403, { error: 'blocked' })
      db.messages.push({ id: randomUUID(), from: me, to, text: body, listingId: text(b.listingId, 40) || undefined, at: Date.now() })
      save()
      return send(res, 200, snapshot(me))
    }

    if (req.method === 'POST' && path === 'block') {
      const b = await readBody(req)
      const user = text(b.user, 16)
      const list = (db.blocks[me] ?? []).filter((x) => x !== user)
      if (b.on && user && user !== me) list.push(user)
      db.blocks[me] = list
      save()
      return send(res, 200, snapshot(me))
    }

    if (req.method === 'POST' && path === 'report') {
      const b = await readBody(req)
      db.reports.push({ by: me, user: text(b.user, 16), reason: text(b.reason, 500), at: Date.now() })
      save()
      return send(res, 200, snapshot(me))
    }

    return send(res, 404, { error: 'not found' })
  } catch (e) {
    return send(res, e instanceof Error && e.message === 'too big' ? 413 : 400, { error: 'bad request' })
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
