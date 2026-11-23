// Protections that need their own fresh server: the host is NOT behind Cloudflare here.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { freshDir, start, listing } from './test-helpers.mjs'

const dir = freshDir()
process.env.UNITY_DATA_DIR = dir
process.env.UNITY_OWNER_CODE = 'owner-code-for-tests'
process.env.UNITY_ADMIN_CODE = 'admin-code-for-tests'
process.env.UNITY_PHOTO_BUDGET_MB = '0.002' // 2,000 bytes, so the storage cap is easy to reach
delete process.env.UNITY_TRUST_CF
const app = await start()
after(() => app.stop())

const jpeg = (n = 1, pad = 0) => 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, n, ...Array(pad).fill(7)]).toString('base64')
const mary = app.person('m'), shopper = app.person('s'), other = app.person('o')
await mary.call('PUT', 'me', { name: 'Mary' })
await shopper.call('PUT', 'me', { name: 'Shopper' })
await other.call('PUT', 'me', { name: 'Other' })
await mary.call('POST', 'team/claim', { code: 'owner-code-for-tests' }) // uses 1 of this address's 8 tries an hour

test('a made-up visitor address is ignored when the host is not behind Cloudflare', async () => {
  const p = app.person('g')
  const codes = []
  for (let i = 0; i < 10; i++) {
    codes.push((await p.call('POST', 'team/claim', { code: `wrong-guess-${i}` }, { 'cf-connecting-ip': `203.0.113.${i}` })).status)
  }
  assert.equal(codes.filter((s) => s === 429).length, 3)
})

test('photos are kept as files, not inside the data file, and removing a listing removes them', async () => {
  const made = await shopper.call('POST', 'listings', listing({ art: undefined, photos: [jpeg(1), jpeg(2)] }))
  assert.equal(made.status, 200)
  assert.equal(readFileSync(join(dir, 'unity.json'), 'utf8').includes('data:image'), false)
  assert.equal(readdirSync(join(dir, 'photos')).length, 2)
  assert.equal((await fetch(`${app.base}/api/photo/${made.body.id}/0`)).status, 200)
  await shopper.call('DELETE', `listings/${made.body.id}`)
  assert.equal(readdirSync(join(dir, 'photos')).length, 0)
})

test('removing something that is not there changes nothing', async () => {
  const before = (await shopper.call('GET', 'sync')).body.rev
  await shopper.call('DELETE', 'listings/not-a-real-listing')
  await shopper.call('POST', 'block', { user: (await other.id()), on: false })
  assert.equal((await shopper.call('GET', 'sync')).body.rev, before)
})

test('profile pictures get their own address instead of riding along in every sync', async () => {
  const pic = 'data:image/png;base64,' + Buffer.from('fake png bytes').toString('base64')
  const r = await other.call('PUT', 'me', { name: 'Other', photo: pic })
  const id = await other.id()
  assert.match(r.body.people[id].photo, new RegExp(`^/api/avatar/${id}/`))
  assert.equal(JSON.stringify(r.body).includes('data:image'), false)
  const got = await fetch(`${app.base}${r.body.people[id].photo}`)
  assert.equal(got.status, 200)
  assert.equal(got.headers.get('content-type'), 'image/png')
  await other.call('PUT', 'me', { name: 'Other' })
  assert.equal(existsSync(join(dir, 'photos', `avatar-${id}.png`)), false)
})

test('a full disk budget refuses new photos from everyone but the team', async () => {
  assert.equal((await shopper.call('POST', 'listings', listing({ art: undefined, photos: [jpeg(1, 1600)] }))).status, 507)
  assert.equal((await mary.call('POST', 'listings', listing({ art: undefined, photos: [jpeg(1, 1600)] }))).status, 200)
})

test('nobody else can take the owner’s name or call themselves the team', async () => {
  assert.equal((await shopper.call('PUT', 'me', { name: ' mary ' })).status, 400)
  assert.equal((await shopper.call('PUT', 'me', { name: 'Unity Team' })).status, 400)
  assert.equal((await shopper.call('PUT', 'me', { name: 'Shop Owner' })).status, 400)
  assert.equal((await shopper.call('PUT', 'me', { name: 'Shopper' })).status, 200)
})

test('sellers can edit a listing and mark it sold; nobody else can', async () => {
  const l = (await shopper.call('POST', 'listings', listing())).body.id
  assert.equal((await other.call('PATCH', `listings/${l}`, { status: 'sold' })).status, 404)
  const edited = await shopper.call('PATCH', `listings/${l}`, { price: 25, title: 'Cheaper set', status: 'sold' })
  const shown = edited.body.listings.find((x) => x.id === l)
  assert.equal(shown.price, 25)
  assert.equal(shown.title, 'Cheaper set')
  assert.equal(shown.status, 'sold')
  assert.equal((await shopper.call('PATCH', `listings/${l}`, { price: 0 })).status, 400)
  const back = await shopper.call('PATCH', `listings/${l}`, { status: null })
  assert.equal(back.body.listings.find((x) => x.id === l).status, undefined)
})

test('a message keeps the outfit’s name, so the chat makes sense after the outfit is gone', async () => {
  const l = (await shopper.call('POST', 'listings', listing({ title: 'Holo set' }))).body.id
  await other.call('POST', 'messages', { to: await shopper.id(), text: 'Still free?', listingId: l })
  await shopper.call('DELETE', `listings/${l}`)
  const m = (await shopper.call('GET', 'sync')).body.messages.find((x) => x.text === 'Still free?')
  assert.equal(m.about, 'Holo set')
})

test('changing a team code on the host signs out everyone who used the old one', async () => {
  assert.equal((await mary.call('GET', 'sync')).body.myRole, 'owner')
  process.env.UNITY_OWNER_CODE = 'a-brand-new-owner-code'
  const snap = (await mary.call('GET', 'sync?rev=0')).body
  assert.equal(snap.myRole, '')
  assert.equal(snap.roles[await mary.id()], undefined)
  process.env.UNITY_OWNER_CODE = 'owner-code-for-tests'
})


test('a listing keeps the festival it was worn at, trimmed, and leaves it off when blank', async () => {
  const worn = await mary.call('POST', 'listings', listing({ wornAt: `  Tahoe Live 2026 ${'x'.repeat(100)}` }))
  assert.equal(worn.status, 200)
  const got = worn.body.listings.find((l) => l.id === worn.body.id)
  assert.equal(got.wornAt.length, 60)
  assert.ok(got.wornAt.startsWith('Tahoe Live 2026'))
  const plain = await mary.call('POST', 'listings', listing({ wornAt: '   ' }))
  assert.equal('wornAt' in plain.body.listings.find((l) => l.id === plain.body.id), false)
  await mary.call('DELETE', `listings/${worn.body.id}`)
  await mary.call('DELETE', `listings/${plain.body.id}`)
})
