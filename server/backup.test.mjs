// The nightly backup: closed without the token, and what comes out restores every file exactly.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readBackup } from './backup.mjs'
import { freshDir, listing, start } from './test-helpers.mjs'

const TOKEN = 'b'.repeat(48)
const dir = freshDir()
process.env.UNITY_DATA_DIR = dir
process.env.UNITY_BACKUP_TOKEN = TOKEN
process.env.UNITY_TRUST_CF = '1'
const app = await start()
after(() => app.stop())

const jpeg = (n) => 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, n, ...Array(3000).fill(n)]).toString('base64')
const fetchBackup = (token, ip = '10.7.0.1') =>
  fetch(`${app.base}/api/admin/backup`, { headers: { ...(token ? { 'x-unity-backup': token } : {}), 'cf-connecting-ip': ip } })

const seller = app.person('s')
await seller.call('POST', 'account/signup', { email: 'seller@example.com', password: 'seller-password' })
const made = await seller.call('POST', 'listings', listing({ art: undefined, photos: [jpeg(1), jpeg(2)] }))
assert.equal(made.status, 200)

test('without the right token the backup does not exist', async () => {
  assert.equal((await fetchBackup()).status, 404)
  assert.equal((await fetchBackup('x'.repeat(48))).status, 404)
  assert.equal((await fetchBackup(TOKEN.slice(1))).status, 404)
})

test('the backup holds every data file, byte for byte, and only opens with the token', async () => {
  const res = await fetchBackup(TOKEN, '10.7.0.2')
  assert.equal(res.status, 200)
  const file = Buffer.from(await res.arrayBuffer())
  assert.equal(file.includes(Buffer.from('seller@example.com')), false, 'nothing readable without the token')

  const files = readBackup(file, TOKEN)
  const names = files.map((f) => f.name).sort()
  assert.ok(names.includes('unity.json'))
  assert.ok(names.includes('account-secret'))
  assert.equal(names.filter((n) => n.startsWith('photos/')).length, 2)
  for (const f of files) assert.deepEqual(f.data, readFileSync(join(dir, f.name)), f.name)
  assert.equal(names.includes('unity.json.bak'), false)

  assert.throws(() => readBackup(file, 'c'.repeat(48)), /token is wrong/)
  const tampered = Buffer.from(file)
  tampered[60] ^= 1
  assert.throws(() => readBackup(tampered, TOKEN), /damaged/)
})

test('the restore script writes the files into an empty folder', async () => {
  const file = join(freshDir(), 'b.bin')
  writeFileSync(file, Buffer.from(await (await fetchBackup(TOKEN, '10.7.0.3')).arrayBuffer()))
  const out = join(freshDir(), 'restored')
  const said = execFileSync('node', ['scripts/restore-backup.mjs', file, out], { env: { ...process.env, UNITY_BACKUP_TOKEN: TOKEN } }).toString()
  assert.match(said, /1 listings, 1 accounts/)
  assert.match(said, /2 photos/)
  assert.deepEqual(readFileSync(join(out, 'unity.json')), readFileSync(join(dir, 'unity.json')))
  assert.equal(readdirSync(join(out, 'photos')).length, 2)
})
