import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { freshDir, start } from './test-helpers.mjs'

test('photos saved inside the data file by older versions are moved out to files', async () => {
  const dir = freshDir()
  const pic = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]).toString('base64')
  const old = {
    rev: 3, people: { bbbbbbbbbbbbbbbb: { name: 'Old', photo: pic, upFor: [] } }, messages: [], blocks: {}, reports: [],
    listings: [{ id: 'old-1', ownerId: 'bbbbbbbbbbbbbbbb', title: 'Old', brand: 'X', category: 'Sets', size: 'S', condition: 'once', price: 5, photo: pic }],
  }
  writeFileSync(join(dir, 'unity.json'), JSON.stringify(old))
  process.env.UNITY_DATA_DIR = dir
  const app = await start()
  const snap = (await app.person('u').call('GET', 'sync')).body
  assert.equal(JSON.stringify(snap).includes('data:image'), false)
  assert.equal((await fetch(`${app.base}/api/photo/old-1/0`)).status, 200)
  assert.equal((await fetch(`${app.base}${snap.people.bbbbbbbbbbbbbbbb.photo}`)).status, 200)
  app.stop()
})
