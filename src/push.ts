import { deviceKey } from './store'

/* Push alerts on this device: a ping for new messages, and a week and a day before festivals you marked.
   On iPhone they only work in the home-screen app (iOS 16.4 and later). */
export type PushState = 'unsupported' | 'install-first' | 'blocked' | 'off' | 'on'

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const iphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

async function registration() {
  return navigator.serviceWorker.getRegistration()
}

export async function pushState(): Promise<PushState> {
  if (iphone() && !standalone()) return 'install-first'
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const sub = await (await registration())?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

const send = (method: string, body: unknown) =>
  fetch('/api/push', { method, headers: { 'x-unity-key': deviceKey(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

function keyBytes(base64url: string) {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

/** Asks for permission, subscribes this device and tells the server. Returns the new state. */
export async function turnOn(): Promise<PushState> {
  if (!supported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const reg = (await registration()) ?? (await navigator.serviceWorker.register('/sw.js'))
  await navigator.serviceWorker.ready
  const { key } = await (await fetch('/api/push/key')).json()
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }))
  const res = await send('PUT', { subscription: sub.toJSON() })
  return res.ok ? 'on' : 'off'
}

export async function turnOff(): Promise<PushState> {
  const sub = await (await registration())?.pushManager.getSubscription()
  if (sub) {
    await send('DELETE', { endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
  return 'off'
}
