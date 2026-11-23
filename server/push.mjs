// Push alerts to phones and browsers that asked for them.
// The keys that sign alerts (VAPID) are made once and kept next to the data file, so nothing
// needs setting up on the host. UNITY_VAPID_PUBLIC / UNITY_VAPID_PRIVATE override them.
import webpush from 'web-push'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

let keys = null

export function setupPush(dir) {
  if (keys) return keys
  if (process.env.UNITY_VAPID_PUBLIC && process.env.UNITY_VAPID_PRIVATE) {
    keys = { publicKey: process.env.UNITY_VAPID_PUBLIC, privateKey: process.env.UNITY_VAPID_PRIVATE }
  } else {
    const file = join(dir, 'vapid.json')
    try {
      if (existsSync(file)) keys = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      keys = null
    }
    if (!keys?.publicKey || !keys?.privateKey) {
      keys = webpush.generateVAPIDKeys()
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, JSON.stringify(keys), { mode: 0o600 })
    }
  }
  webpush.setVapidDetails('https://unityrave.com', keys.publicKey, keys.privateKey)
  return keys
}

/** Sends one alert. Resolves to 'gone' when the browser has dropped the subscription. Tests swap this out. */
let sender = async (sub, payload) => {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 24 * 3600, urgency: 'normal' })
    return 'sent'
  } catch (e) {
    return e?.statusCode === 404 || e?.statusCode === 410 ? 'gone' : 'failed'
  }
}
export const sendPush = (sub, payload) => sender(sub, payload)
export function setPushSender(fn) {
  sender = fn
}

/** A browser subscription, checked: an https endpoint and the two keys, nothing else kept. */
export function checkSubscription(s) {
  if (!s || typeof s !== 'object') return null
  const { endpoint, keys: k } = s
  if (typeof endpoint !== 'string' || endpoint.length > 800 || !/^https:\/\/[^\s]+$/.test(endpoint)) return null
  if (!k || typeof k.p256dh !== 'string' || typeof k.auth !== 'string' || k.p256dh.length > 200 || k.auth.length > 100) return null
  return { endpoint, keys: { p256dh: k.p256dh, auth: k.auth } }
}

/** Today's date in Pacific time as YYYY-MM-DD, and the hour there. */
export function pacificNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(now).map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) }
}

/** Whole days from one YYYY-MM-DD to another. */
export const daysBetween = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
