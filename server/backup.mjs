// Backups: every file in the data folder (unity.json, photos, the account secret, the push keys),
// packed, gzipped and encrypted with a key made from UNITY_BACKUP_TOKEN. Without that token a
// backup can't be opened, so it is safe to keep where others could download it.
//
// File layout: "UNITYBK1" | salt (16) | iv (12) | AES-256-GCM ciphertext | tag (16)
// Inside, after gunzip: for each file a JSON line {"n": name, "s": bytes} then the bytes; then {"end": true}.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip, gunzipSync } from 'node:zlib'

const MAGIC = Buffer.from('UNITYBK1')
const keyFor = (token, salt) => scryptSync(token, salt, 32)

/** Leftovers that are not worth keeping: half-written saves, the 1-minute copy, set-aside broken files. */
const skip = (name) => name.endsWith('.tmp') || name === 'unity.json.bak' || name.startsWith('unity.corrupt-')

function walk(dir, prefix = '') {
  const out = []
  for (const e of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    if (e.isDirectory()) out.push(...walk(dir, rel))
    else if (e.isFile() && !skip(e.name)) out.push(rel)
  }
  return out
}

async function* entries(dir) {
  for (const rel of walk(dir)) {
    let data
    try {
      data = readFileSync(join(dir, rel))
    } catch {
      continue // removed while the backup ran
    }
    yield Buffer.from(JSON.stringify({ n: rel, s: data.length }) + '\n')
    yield data
  }
  yield Buffer.from(JSON.stringify({ end: true }) + '\n')
}

/** Streams an encrypted backup of `dir` into `out` and ends it. */
export async function writeBackup(dir, token, out) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFor(token, salt), iv)
  out.write(Buffer.concat([MAGIC, salt, iv]))
  await pipeline(entries(dir), createGzip(), cipher, out, { end: false })
  out.end(cipher.getAuthTag())
}

/** Opens a backup. Returns [{ name, data }]. Throws if the token is wrong or the file was changed. */
export function readBackup(file, token) {
  if (file.length < 52 || !file.subarray(0, 8).equals(MAGIC)) throw new Error('This is not a Unity backup file.')
  const salt = file.subarray(8, 24)
  const iv = file.subarray(24, 36)
  const decipher = createDecipheriv('aes-256-gcm', keyFor(token, salt), iv)
  decipher.setAuthTag(file.subarray(-16))
  let plain
  try {
    plain = gunzipSync(Buffer.concat([decipher.update(file.subarray(36, -16)), decipher.final()]))
  } catch {
    throw new Error('Could not open the backup: the token is wrong or the file is damaged.')
  }
  const files = []
  let at = 0
  for (;;) {
    const nl = plain.indexOf(10, at)
    if (nl < 0) throw new Error('The backup ends early.')
    const head = JSON.parse(plain.subarray(at, nl).toString())
    if (head.end) return files
    const name = String(head.n)
    if (name.startsWith('/') || name.split('/').some((p) => p === '..' || p === '')) throw new Error(`Unsafe name in backup: ${name}`)
    files.push({ name, data: plain.subarray(nl + 1, nl + 1 + head.s) })
    at = nl + 1 + head.s
  }
}
