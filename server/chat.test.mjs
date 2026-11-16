import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { freshDir, start, listing } from './test-helpers.mjs'

process.env.UNITY_DATA_DIR = freshDir()
process.env.UNITY_ADMIN_TOKEN = 'admin-token-for-tests'
const app = await start()
after(() => app.stop())

// Seller "a" can be messaged because they have a profile. Buyer "b" and stranger "c" are others.
const a = app.person('a'), b = app.person('b'), c = app.person('c')
await a.call('PUT', 'me', { name: 'Seller', upFor: [] })
await b.call('PUT', 'me', { name: 'Buyer', upFor: [] })
await c.call('PUT', 'me', { name: 'Stranger', upFor: [] })
const [aId, bId, cId] = [await a.id(), await b.id(), await c.id()]

test('requests without a key are refused', async () => {
  const r = await fetch(`${app.base}/api/sync`)
  assert.equal(r.status, 401)
})

test('a message reaches only the two people in the chat', async () => {
  const sent = await b.call('POST', 'messages', { to: aId, text: 'hello there' })
  assert.equal(sent.status, 200)
  assert.deepEqual((await a.call('GET', 'sync')).body.messages.map((m) => m.text), ['hello there'])
  assert.deepEqual((await b.call('GET', 'sync')).body.messages.map((m) => m.text), ['hello there'])
  assert.equal((await c.call('GET', 'sync')).body.messages.length, 0)
})

test('the sender comes from the secret key, not from the request', async () => {
  const r = await c.call('POST', 'messages', { to: aId, text: 'pretend to be buyer', from: bId })
  assert.equal(r.status, 200)
  const m = (await a.call('GET', 'sync')).body.messages.find((x) => x.text === 'pretend to be buyer')
  assert.equal(m.from, cId)
})

test('sending the same message id twice stores it once', async () => {
  const body = { id: 'retry-id-0001', to: aId, text: 'only once please' }
  assert.equal((await b.call('POST', 'messages', body)).status, 200)
  assert.equal((await b.call('POST', 'messages', body)).status, 200)
  const n = (await a.call('GET', 'sync')).body.messages.filter((m) => m.text === 'only once please').length
  assert.equal(n, 1)
})

test('bad messages are refused', async () => {
  assert.equal((await b.call('POST', 'messages', { to: aId, text: '   ' })).status, 400)
  assert.equal((await b.call('POST', 'messages', { to: 'nothex', text: 'hi' })).status, 400)
  assert.equal((await b.call('POST', 'messages', { to: bId, text: 'to myself' })).status, 400)
  assert.equal((await b.call('POST', 'messages', { to: 'f'.repeat(16), text: 'nobody here' })).status, 404)
  const long = await b.call('POST', 'messages', { to: aId, text: 'x'.repeat(5000) })
  assert.equal(long.status, 200)
  const stored = (await b.call('GET', 'sync')).body.messages.find((m) => m.text.startsWith('xxxx'))
  assert.equal(stored.text.length, 1000)
})

test('messages are shown as plain text, never as markup', async () => {
  await b.call('POST', 'messages', { to: aId, text: '<img src=x onerror=alert(1)>' })
  const m = (await a.call('GET', 'sync')).body.messages.find((x) => x.text.includes('onerror'))
  assert.equal(m.text, '<img src=x onerror=alert(1)>') // stored as typed; the app renders it as text
})

test('a blocked person cannot reach you and is not told', async () => {
  const d = app.person('d'); await d.call('PUT', 'me', { name: 'Pest' }); const dId = await d.id()
  await a.call('POST', 'block', { user: dId, on: true })
  const r = await d.call('POST', 'messages', { to: aId, text: 'let me in' })
  assert.equal(r.status, 200) // looks delivered to them
  assert.ok(r.body.messages.some((m) => m.text === 'let me in')) // and they still see their own message
  assert.equal((await a.call('GET', 'sync')).body.messages.some((m) => m.text === 'let me in'), false)
  await a.call('POST', 'block', { user: dId, on: false })
  assert.equal((await a.call('GET', 'sync')).body.messages.some((m) => m.text === 'let me in'), false) // never delivered, even after unblocking
})

test('blocking hides the person’s earlier messages and stops your own sends', async () => {
  await a.call('POST', 'block', { user: bId, on: true })
  assert.equal((await a.call('GET', 'sync')).body.messages.filter((m) => m.from === bId).length, 0)
  assert.equal((await a.call('POST', 'messages', { to: bId, text: 'hi' })).status, 403)
  await a.call('POST', 'block', { user: bId, on: false })
  assert.ok((await a.call('GET', 'sync')).body.messages.some((m) => m.from === bId))
})

test('a report keeps the recent messages as evidence, and only the team can read it', async () => {
  const r = await a.call('POST', 'report', { user: bId, reason: 'rude' })
  assert.equal(r.status, 200)
  assert.equal((await a.call('POST', 'report', { user: bId, reason: '' })).status, 400)
  const nope = await fetch(`${app.base}/api/admin/reports`)
  assert.equal(nope.status, 404)
  const wrong = await fetch(`${app.base}/api/admin/reports`, { headers: { 'x-unity-admin': 'wrong' } })
  assert.equal(wrong.status, 404)
  const ok = await fetch(`${app.base}/api/admin/reports`, { headers: { 'x-unity-admin': 'admin-token-for-tests' } })
  const { reports } = await ok.json()
  assert.equal(reports.length, 1)
  assert.ok(reports[0].evidence.length > 0)
})

test('listings only accept real values and only the owner can remove them', async () => {
  assert.equal((await a.call('POST', 'listings', listing({ condition: 'broken' }))).status, 400)
  assert.equal((await a.call('POST', 'listings', listing({ price: -5 }))).status, 400)
  assert.equal((await a.call('POST', 'listings', listing({ art: { kind: 'nope' } }))).status, 400)
  const made = await a.call('POST', 'listings', listing())
  assert.equal(made.status, 200)
  assert.equal((await c.call('DELETE', `listings/${made.body.id}`)).body.listings.length, 1)
  assert.equal((await a.call('DELETE', `listings/${made.body.id}`)).body.listings.length, 0)
})

test('a flood of messages is slowed down', async () => {
  const f = app.person('f'); await f.call('PUT', 'me', { name: 'Fast' })
  let refused = 0
  for (let i = 0; i < 30; i++) {
    const r = await f.call('POST', 'messages', { to: aId, text: `spam ${i}` })
    if (r.status === 429) refused++
  }
  assert.equal(refused, 10) // 20 a minute allowed
})

test('starting chats with too many people in a day is slowed down', async () => {
  const g = app.person('g'); await g.call('PUT', 'me', { name: 'Spreader' })
  const targets = []
  for (let i = 0; i < 18; i++) {
    const p = app.person(String.fromCharCode(104 + i)); await p.call('PUT', 'me', { name: `P${i}` }); targets.push(await p.id())
  }
  const results = []
  for (const t of targets) results.push((await g.call('POST', 'messages', { to: t, text: 'hi' })).status)
  assert.equal(results.filter((s) => s === 200).length, 15)
  assert.equal(results.filter((s) => s === 429).length, 3)
})

test('one address cannot mint endless new accounts', async () => {
  let refused = 0
  for (let i = 0; i < 30; i++) {
    const p = app.person(`${i.toString(36)}`.padStart(1, 'z'), '203.0.113.9')
    p.call = ((orig) => (m, path, body) => orig(m, path, body, { 'x-unity-key': `${'q'.repeat(30)}${i.toString().padStart(10, '0')}` }))(p.call)
    const r = await p.call('PUT', 'me', { name: `bot${i}` })
    if (r.status === 429) refused++
  }
  assert.equal(refused, 5) // 25 new accounts per address per day
})

const jpeg = (n = 1) => 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, n, 2, 3, 4, 5, 6]).toString('base64')

test('listing photos: up to five real JPEGs, served as pictures and kept out of the sync', async () => {
  const made = await b.call('POST', 'listings', listing({ art: undefined, photos: [jpeg(1), jpeg(2)] }))
  assert.equal(made.status, 200)
  const l = made.body.listings.find((x) => x.id === made.body.id)
  assert.equal(l.photoCount, 2)
  assert.equal('photos' in l, false)
  const pic = await fetch(`${app.base}/api/photo/${made.body.id}/1`) // no key needed: it loads as an ordinary image
  assert.equal(pic.status, 200)
  assert.equal(pic.headers.get('content-type'), 'image/jpeg')
  assert.equal((await fetch(`${app.base}/api/photo/${made.body.id}/2`)).status, 404)
  assert.equal((await fetch(`${app.base}/api/photo/not-a-listing/0`)).status, 404)
})

test('listing photos: things that are not JPEG pictures are refused', async () => {
  const svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg onload=alert(1)/>').toString('base64')
  const fake = 'data:image/jpeg;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64')
  assert.equal((await b.call('POST', 'listings', listing({ art: undefined, photos: [svg] }))).status, 400)
  assert.equal((await b.call('POST', 'listings', listing({ art: undefined, photos: [fake] }))).status, 400)
  assert.equal((await b.call('POST', 'listings', listing({ art: undefined, photos: Array(6).fill(jpeg()) }))).status, 400)
})
