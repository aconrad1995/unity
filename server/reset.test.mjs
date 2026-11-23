// Password reset by email, and the welcome email. Emails are written to a folder instead of sent.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { freshDir, start } from './test-helpers.mjs'

const dir = freshDir()
const mailDir = join(dir, 'mail')
process.env.UNITY_DATA_DIR = dir
process.env.UNITY_MAIL_DIR = mailDir
process.env.UNITY_TRUST_CF = '1'
const app = await start()
after(() => app.stop())

const mails = () => {
  try {
    return readdirSync(mailDir).sort().map((f) => JSON.parse(readFileSync(join(mailDir, f), 'utf8')))
  } catch {
    return []
  }
}
const linkIn = (mail) => mail.text.match(/#\/reset\/([A-Za-z0-9_-]+)/)?.[1]
const settle = () => new Promise((ok) => setTimeout(ok, 30))

const m = app.person('m'), phone2 = app.person('p'), x = app.person('x')
const mId = await m.id()

test('making an account sends a welcome email, and the app knows email is on', async () => {
  const made = await m.call('POST', 'account/signup', { email: 'Mary@Example.com', password: 'first-password' })
  assert.equal(made.status, 200)
  assert.equal(made.body.mailOn, true)
  await settle()
  const [welcome] = mails()
  assert.equal(welcome.to, 'mary@example.com')
  assert.match(welcome.subject, /ready/)
  assert.doesNotMatch(welcome.text, /first-password/)
})

test('asking for a link gives the same answer for unknown emails, and only mails real accounts', async () => {
  const before = mails().length
  const unknown = await x.call('POST', 'account/forgot', { email: 'nobody@example.com' })
  const known = await x.call('POST', 'account/forgot', { email: 'mary@example.com' })
  assert.deepEqual([unknown.status, unknown.body], [200, { sent: true }])
  assert.deepEqual([known.status, known.body], [200, { sent: true }])
  await settle()
  const sent = mails().slice(before)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'mary@example.com')
  assert.ok(linkIn(sent[0]))
  assert.equal(readFileSync(join(dir, 'unity.json'), 'utf8').includes(linkIn(sent[0])), false, 'only a fingerprint of the link is stored')
})

test('a link sets a new password once, signs that phone in, and the old password stops working', async () => {
  await x.call('POST', 'account/forgot', { email: 'mary@example.com' })
  await settle()
  const token = linkIn(mails().at(-1))
  assert.equal((await phone2.call('POST', 'account/reset', { token, password: 'short' })).status, 400)
  const done = await phone2.call('POST', 'account/reset', { token, password: 'brand-new-password' })
  assert.equal(done.status, 200)
  assert.ok(done.body.key)
  assert.equal((await phone2.call('POST', 'account/reset', { token, password: 'another-password' })).status, 410, 'links work once')

  // The key it hands back is Mary's: using it shows her as "me".
  const res = await fetch(`${app.base}/api/sync`, { headers: { 'x-unity-key': done.body.key } })
  assert.equal((await res.json()).me, mId)
  assert.equal((await x.call('POST', 'account/signin', { email: 'mary@example.com', password: 'first-password' })).status, 401)
  assert.equal((await x.call('POST', 'account/signin', { email: 'mary@example.com', password: 'brand-new-password' })).status, 200)
})

test('a newer link replaces an older one, and made-up links are refused', async () => {
  // Its own account, since Mary has used up her links for the hour.
  await app.person('j').call('POST', 'account/signup', { email: 'jo@example.com', password: 'jo-password' })
  await x.call('POST', 'account/forgot', { email: 'jo@example.com' })
  await settle()
  const older = linkIn(mails().at(-1))
  await x.call('POST', 'account/forgot', { email: 'jo@example.com' })
  await settle()
  assert.notEqual(linkIn(mails().at(-1)), older)
  assert.equal((await x.call('POST', 'account/reset', { token: older, password: 'whatever-password' })).status, 410)
  for (const token of ['made-up', '', 'x'.repeat(500), 42]) {
    assert.equal((await x.call('POST', 'account/reset', { token, password: 'whatever-password' })).status, 410, String(token).slice(0, 10))
  }
})

test('asking again and again for one email is slowed down', async () => {
  const codes = []
  for (let i = 0; i < 4; i++) codes.push((await app.person('q', `10.9.9.${i}`).call('POST', 'account/forgot', { email: 'slow@example.com' })).status)
  assert.deepEqual(codes, [200, 200, 200, 429])
})
