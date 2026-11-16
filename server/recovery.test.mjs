import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { freshDir, start } from './test-helpers.mjs'

test('a damaged data file is set aside and the backup is used, never silently wiped', async () => {
  const dir = freshDir()
  const good = { rev: 5, listings: [], people: { aaaaaaaaaaaaaaaa: { name: 'Kept', photo: '', upFor: [] } }, messages: [], blocks: {}, reports: [] }
  writeFileSync(join(dir, 'unity.json.bak'), JSON.stringify(good))
  writeFileSync(join(dir, 'unity.json'), '{"rev": 9, "listings": [ this is broken')
  process.env.UNITY_DATA_DIR = dir
  const app = await start()
  const me = app.person('r')
  const snap = (await me.call('GET', 'sync')).body
  assert.equal(snap.people.aaaaaaaaaaaaaaaa.name, 'Kept')
  assert.ok(readdirSync(dir).some((f) => f.startsWith('unity.corrupt-')), 'the damaged file is kept for inspection')
  app.stop()
})
