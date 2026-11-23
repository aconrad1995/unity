import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { freshDir, start, listing } from './test-helpers.mjs'

process.env.UNITY_DATA_DIR = freshDir()
process.env.UNITY_TRUST_CF = '1'
process.env.UNITY_OWNER_CODE = 'owner-code-for-tests'
const app = await start()
after(() => app.stop())

// "s" sells, "b" buys and chats, "q" only messaged and never got a reply, "x" is a stranger.
const s = app.person('s'), b = app.person('b'), q = app.person('q'), x = app.person('x')
for (const [p, name] of [[s, 'Seller'], [b, 'Buyer'], [q, 'Quiet'], [x, 'Stranger']]) await p.call('PUT', 'me', { name })
const [sId, bId] = [await s.id(), await b.id()]
await s.call('POST', 'listings', listing())

test('you cannot rate someone you never had a chat with', async () => {
  const r = await x.call('PUT', 'ratings', { of: sId, stars: 5 })
  assert.equal(r.status, 403)
  assert.equal(r.body.error, 'chat_first')
})

test('messaging a seller is not enough: they have to write back', async () => {
  await q.call('POST', 'messages', { to: sId, text: 'still available?' })
  assert.equal((await q.call('PUT', 'ratings', { of: sId, stars: 1 })).status, 403)
})

test('after a two-way chat you can rate a seller, once, and change it', async () => {
  await b.call('POST', 'messages', { to: sId, text: 'hi, still have it?' })
  await s.call('POST', 'messages', { to: bId, text: 'yes!' })
  assert.equal((await b.call('PUT', 'ratings', { of: sId, stars: 4, note: 'Quick to reply' })).status, 200)
  const r = await b.call('PUT', 'ratings', { of: sId, stars: 5, note: 'Arrived before Lost Lands' })
  const mine = r.body.ratings[sId]
  assert.equal(mine.count, 1)
  assert.equal(mine.average, 5)
  assert.equal(mine.recent[0].note, 'Arrived before Lost Lands')
  assert.equal(mine.recent[0].by, bId)
  // Everyone sees it, signed in or not.
  assert.equal((await x.call('GET', 'sync')).body.ratings[sId].count, 1)
})

test('only real star values are accepted, and you cannot rate yourself or a non-seller', async () => {
  for (const stars of [0, 6, 3.5, '5', null]) assert.equal((await b.call('PUT', 'ratings', { of: sId, stars })).status, 400)
  assert.equal((await s.call('PUT', 'ratings', { of: sId, stars: 5 })).status, 400)
  // The buyer has no listings, so the seller can't rate them even after chatting.
  assert.equal((await s.call('PUT', 'ratings', { of: bId, stars: 5 })).status, 403)
})

test('you can take your rating back', async () => {
  const r = await b.call('DELETE', 'ratings', { of: sId })
  assert.equal(r.body.ratings[sId], undefined)
  await b.call('PUT', 'ratings', { of: sId, stars: 5 })
})

test('the team can take a rating down; nobody else can', async () => {
  const mary = app.person('M')
  await mary.call('POST', 'team/claim', { code: 'owner-code-for-tests' })
  assert.equal((await x.call('POST', 'team/rating-remove', { of: sId, by: bId })).status, 404)
  const r = await mary.call('POST', 'team/rating-remove', { of: sId, by: bId })
  assert.equal(r.status, 200)
  assert.equal(r.body.ratings[sId], undefined)
})

test('an Instagram handle is kept from a handle, an @handle or a profile link, and junk is dropped', async () => {
  const handle = async (instagram) => {
    const r = await s.call('PUT', 'me', { name: 'Seller', instagram })
    return r.body.people[sId].instagram
  }
  assert.equal(await handle('@glitter.babe_'), 'glitter.babe_')
  assert.equal(await handle('https://www.instagram.com/glitter.babe_/?hl=en'), 'glitter.babe_')
  assert.equal(await handle('javascript:alert(1)'), undefined)
  assert.equal(await handle('<b>hi</b>'), undefined)
  assert.equal(await handle(''), undefined)
})

test('nobody but the team can use the shop’s own Instagram name', async () => {
  const r = await x.call('PUT', 'me', { name: 'Stranger', instagram: '@unityrave' })
  assert.equal(r.status, 400)
  assert.equal(r.body.error, 'handle_reserved')
})
