// Opens a Unity backup and writes its files into an empty folder, ready to copy back to the server.
//
//   UNITY_BACKUP_TOKEN=... node scripts/restore-backup.mjs unity-backup.bin restored/
//
// Without a folder it only checks the backup opens and says what is in it.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { readBackup } from '../server/backup.mjs'

const [file, out] = process.argv.slice(2)
const token = process.env.UNITY_BACKUP_TOKEN
if (!file || !token) {
  console.error('Usage: UNITY_BACKUP_TOKEN=... node scripts/restore-backup.mjs <backup file> [empty folder]')
  process.exit(2)
}

try {
  const files = readBackup(readFileSync(file), token)
  const main = files.find((f) => f.name === 'unity.json')
  if (!main) throw new Error('The backup has no unity.json.')
  const db = JSON.parse(main.data.toString())
  const photos = files.filter((f) => f.name.startsWith('photos/')).length
  console.log(`Backup opens: ${files.length} files, ${db.listings?.length ?? 0} listings, ${Object.keys(db.accounts ?? {}).length} accounts, ${db.messages?.length ?? 0} messages, ${photos} photos.`)
  if (!files.some((f) => f.name === 'account-secret')) console.log('Note: no account-secret file (the host may set UNITY_ACCOUNT_SECRET instead).')

  if (out) {
    if (existsSync(out) && readdirSync(out).length) throw new Error(`${out} is not empty.`)
    for (const f of files) {
      mkdirSync(dirname(join(out, f.name)), { recursive: true })
      writeFileSync(join(out, f.name), f.data, { mode: f.name === 'account-secret' || f.name === 'vapid.json' ? 0o600 : 0o644 })
    }
    console.log(`Written to ${out}`)
  }
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
