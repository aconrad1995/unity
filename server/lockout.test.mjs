import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { freshDir, start } from './test-helpers.mjs'

process.env.UNITY_DATA_DIR = freshDir()
process.env.UNITY_TRUST_CF = '1'
process.env.UNITY_OWNER_CODE = 'owner-code-for-tests'
const app = await start()
after(() => app.stop())

test('a flood of wrong team codes from many devices and addresses locks sign-in for everyone', async () => {
  const results = []
  for (let i = 0; i < 25; i++) {
    const p = app.person(String.fromCharCode(97 + i), `192.0.2.${i}`)
    results.push((await p.call('POST', 'team/claim', { code: `guess-number-${i}` })).status)
  }
  assert.equal(results.filter((s) => s === 403).length, 20)
  assert.equal(results.filter((s) => s === 429).length, 5)
  // Even the right code waits until the hour is up.
  assert.equal((await app.person('Z', '192.0.2.99').call('POST', 'team/claim', { code: 'owner-code-for-tests' })).status, 429)
})
