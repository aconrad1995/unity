import test from 'node:test'
import assert from 'node:assert/strict'
import { edmtrainEvents, shape } from './edmtrain.mjs'

test('shape keeps what the app needs and drops incomplete rows', () => {
  const ok = shape({ id: 7, name: 'Test Fest', link: 'https://edmtrain.com/x', startDate: '2027-05-01', endDate: '2027-05-03', venue: { name: 'Park', location: 'Denver, CO', latitude: 39.7, longitude: -105 } })
  assert.equal(ok.id, 'edmtrain-7')
  assert.equal(ok.days, 3)
  assert.equal(ok.via, 'EDMTrain')
  assert.equal(shape({ id: 8, name: 'No venue', startDate: '2027-05-01' }), null)
})

test('without a key there is no request and no events', async () => {
  let called = false
  const out = await edmtrainEvents('', async () => { called = true })
  assert.deepEqual(out, [])
  assert.equal(called, false)
})
