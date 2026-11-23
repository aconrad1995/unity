import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { freshDir, start, listing } from './test-helpers.mjs'

const dir = freshDir()
process.env.UNITY_DATA_DIR = dir
process.env.UNITY_TRUST_CF = '1'
process.env.UNITY_OWNER_CODE = 'owner-code-for-tests'
const app = await start()
after(() => app.stop())

// "m" makes an account on her phone; "p" is her second phone; "x" is someone else.
const m = app.person('m'), p = app.person('p'), x = app.person('x')
await m.call('PUT', 'me', { name: 'Mary' })
await m.call('POST', 'listings', listing({ title: 'Mary set' }))
const mId = await m.id()

test('making an account: real email, password of 8 or more', async () => {
  assert.equal((await m.call('POST', 'account/signup', { email: 'not-an-email', password: 'longenough' })).body.error, 'bad_email')
  assert.equal((await m.call('POST', 'account/signup', { email: 'mary@example.com', password: 'short' })).body.error, 'weak_password')
  const r = await m.call('POST', 'account/signup', { email: ' Mary@Example.com ', password: 'glitter-and-bass' })
  assert.equal(r.status, 200)
  assert.equal(r.body.account, 'mary@example.com')
  // Only you see your own email.
  assert.equal((await x.call('GET', 'sync')).body.account, null)
})

test('one account per person, one person per email', async () => {
  assert.equal((await m.call('POST', 'account/signup', { email: 'other@example.com', password: 'glitter-and-bass' })).body.error, 'has_account')
  assert.equal((await x.call('POST', 'account/signup', { email: 'mary@example.com', password: 'whatever123' })).body.error, 'email_taken')
})

test('signing in on another phone makes it the same person', async () => {
  const r = await p.call('POST', 'account/signin', { email: 'MARY@example.com', password: 'glitter-and-bass' })
  assert.equal(r.status, 200)
  const res = await fetch(`${app.base}/api/sync`, { headers: { 'x-unity-key': r.body.key } })
  const body = await res.json()
  assert.equal(body.me, mId)
  assert.equal(body.listings.some((l) => l.title === 'Mary set' && l.ownerId === mId), true)
})

test('a wrong password or unknown email gives the same answer', async () => {
  const wrong = await p.call('POST', 'account/signin', { email: 'mary@example.com', password: 'nope-nope-nope' })
  const unknown = await p.call('POST', 'account/signin', { email: 'nobody@example.com', password: 'nope-nope-nope' })
  assert.equal(wrong.status, 401)
  assert.deepEqual(wrong.body, unknown.body)
})

test('passwords are stored hashed and keys encrypted, never in plain text', async () => {
  const file = readFileSync(join(dir, 'unity.json'), 'utf8')
  assert.equal(file.includes('glitter-and-bass'), false)
  assert.equal(file.includes('m'.repeat(40)), false)
  assert.equal(existsSync(join(dir, 'account-secret')), true)
})

test('changing the password needs the current one', async () => {
  assert.equal((await m.call('POST', 'account/password', { current: 'wrong-one', next: 'new-password-1' })).status, 401)
  assert.equal((await m.call('POST', 'account/password', { current: 'glitter-and-bass', next: 'new-password-1' })).status, 200)
  assert.equal((await p.call('POST', 'account/signin', { email: 'mary@example.com', password: 'new-password-1' })).status, 200)
})

test('guessing passwords for one email is slowed down', async () => {
  const g = app.person('g', '203.0.113.9')
  const codes = []
  for (let i = 0; i < 12; i++) codes.push((await g.call('POST', 'account/signin', { email: 'guess@example.com', password: `guess-${i}-xx` })).status)
  assert.equal(codes.filter((s) => s === 429).length, 2)
})

test('only the team can reset someone’s password', async () => {
  assert.equal((await x.call('POST', 'team/account-reset', { email: 'mary@example.com', password: 'reset-by-team' })).status, 404)
  const t = app.person('t')
  await t.call('POST', 'team/claim', { code: 'owner-code-for-tests' })
  assert.equal((await t.call('POST', 'team/account-reset', { email: 'mary@example.com', password: 'reset-by-team' })).status, 200)
  assert.equal((await p.call('POST', 'account/signin', { email: 'mary@example.com', password: 'reset-by-team' })).status, 200)
})
