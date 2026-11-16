import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function freshDir() {
  return mkdtempSync(join(tmpdir(), 'unity-test-'))
}

/** Starts the API on a free port. Call after setting UNITY_DATA_DIR. */
export async function start() {
  const { api } = await import('./api.mjs')
  const server = createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end('no') }))
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
  const base = `http://127.0.0.1:${server.address().port}`
  let n = 0
  // Each person gets a key; "ip" lets a test pretend to come from a different address.
  const person = (letter, ip = `10.0.0.${++n}`) => {
    const key = letter.repeat(40)
    const call = async (method, path, body, extra = {}) => {
      const res = await fetch(`${base}/api/${path}`, {
        method,
        headers: { 'x-unity-key': key, 'cf-connecting-ip': ip, ...(body ? { 'Content-Type': 'application/json' } : {}), ...extra },
        body: body ? JSON.stringify(body) : undefined,
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    }
    return { key, call, async id() { return (await call('GET', 'sync')).body.me } }
  }
  return { base, person, stop: () => server.close() }
}

export const listing = (over = {}) => ({
  title: 'Test set', brand: 'Badinka', category: 'Sets', size: 'S', condition: 'once', price: 30, description: 'x',
  art: { kind: 'set', bg: '#FFE1EF', fill: '#6BC1FF', accent: '#FFFFFF' }, ...over,
})
