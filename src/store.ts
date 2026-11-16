import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EMPTY_PROFILE, SAMPLE_LISTINGS, type Listing, type Profile } from './data'

// Private things (saved outfits, preferences, what the shop has learned) stay in this browser.
const LISTINGS_KEY = 'unity.listings.v1'
const SAVED_KEY = 'unity.saved.v1'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/* ---------- Shared data ----------
   Listings, public profiles and messages live on Unity's small server (server/api.mjs) so
   different people see the same shop and can message each other. This device proves who it
   is with a long random secret key that never leaves it except to that server. */
const KEY_KEY = 'unity.key.v1'
const READ_KEY = 'unity.read.v1'

function deviceKey(): string {
  let key = ''
  try {
    key = localStorage.getItem(KEY_KEY) ?? ''
    if (key.length < 32) {
      const bytes = crypto.getRandomValues(new Uint8Array(32))
      key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
      localStorage.setItem(KEY_KEY, key)
    }
  } catch {
    /* no storage: a fresh key each visit */
  }
  return key
}

export interface Person { name: string; photo: string; upFor: string[] }
export interface Message { id: string; from: string; to: string; text: string; listingId?: string; at: number; state?: 'sending' | 'failed' | 'rejected'; why?: string }
export type Role = '' | 'owner' | 'admin'
export interface Look { id: string; ownerId: string; caption: string; brands: string[]; photoCount: number; createdAt: number }
export interface Fit { lookId: string; note: string; at: number; by: string }
export interface Report { id: string; by: string; user: string; reason: string; at: number; resolved?: number; evidence: Message[] }
interface Shared {
  rev: number; me: string; listings: Listing[]; people: Record<string, Person>; messages: Message[]; blocked: string[]
  roles: Record<string, Role>; myRole: Role; looks: Look[]; fit: Fit | null
}
const NOTHING: Shared = { rev: 0, me: '', listings: [], people: {}, messages: [], blocked: [], roles: {}, myRole: '', looks: [], fit: null }

export const NO_ONE: Person = { name: '', photo: '', upFor: [] }
export const nameOf = (p: Person | undefined) => p?.name.trim() || 'Someone new'

type Reply = { status: number; error?: string; data: (Shared & { same?: boolean; id?: string }) | null }
export type { Reply }

async function call(method: string, path: string, body?: unknown): Promise<Reply> {
  try {
    const res = await fetch(`/api/${path}`, {
      method,
      headers: { 'x-unity-key': deviceKey(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => null) : null
    return { status: res.status, error: json?.error, data: res.ok ? json : null }
  } catch {
    return { status: 0, data: null }
  }
}
const fetchData = async (method: string, path: string, body?: unknown) => (await call(method, path, body)).data

const samePerson = (a: Person | undefined, b: Person) =>
  !!a && a.name === b.name && a.photo === b.photo && a.upFor.join('|') === b.upFor.join('|')

/* ---------- Outgoing messages ----------
   A message shows in the chat the moment it is sent. It is kept on this device until the server
   confirms it, so a dropped connection never loses it, and it is retried automatically. Every
   message has its own id, so a retry can never post it twice. */
const OUTBOX_KEY = 'unity.outbox.v1'
const newId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')

const WHY: Record<string, string> = {
  rate_limited: 'You are sending a lot of messages. Wait a minute, then try again.',
  you_blocked: 'You blocked this person. Unblock them to message again.',
  unknown_person: 'This person can’t be messaged.',
}

export function useStore() {
  const [shared, setShared] = useState<Shared>(NOTHING)
  const [online, setOnline] = useState<boolean | null>(null)
  const [saved, setSaved] = useState<string[]>(() => read<string[]>(SAVED_KEY, []))
  const [readAt, setReadAt] = useState<Record<string, number>>(() => read<Record<string, number>>(READ_KEY, {}))
  const [outbox, setOutbox] = useState<Message[]>(() =>
    read<Message[]>(OUTBOX_KEY, []).map((m) => ({ ...m, state: m.state === 'rejected' ? 'rejected' : 'failed' })),
  )
  const latest = useRef(NOTHING)
  const outboxRef = useRef(outbox)
  const inflight = useRef(new Set<string>())
  outboxRef.current = outbox

  const take = useCallback((next: Shared | null) => {
    if (!next) return false
    latest.current = next
    setShared(next)
    return true
  }, [])

  useEffect(() => {
    write(OUTBOX_KEY, outbox)
  }, [outbox])

  const deliver = useCallback(async (m: Message) => {
    if (inflight.current.has(m.id)) return false
    inflight.current.add(m.id)
    setOutbox((cur) => cur.map((x) => (x.id === m.id ? { ...x, state: 'sending', why: undefined } : x)))
    const r = await call('POST', 'messages', { id: m.id, to: m.to, text: m.text, listingId: m.listingId })
    inflight.current.delete(m.id)
    if (r.data) {
      take(r.data)
      setOutbox((cur) => cur.filter((x) => x.id !== m.id))
      return true
    }
    // A refusal from the server will not get better by retrying; a dropped connection or a busy server will.
    const refused = r.status >= 400 && r.status < 500 && r.status !== 429 && r.status !== 401
    const why = WHY[r.error ?? ''] ?? (refused ? 'This message could not be sent.' : 'Not sent. Check your connection.')
    setOutbox((cur) => cur.map((x) => (x.id === m.id ? { ...x, state: refused || r.error === 'rate_limited' ? 'rejected' : 'failed', why } : x)))
    return false
  }, [take])

  useEffect(() => {
    let stopped = false
    let busy = false
    async function tick() {
      if (busy || stopped) return
      busy = true
      const got = await call('GET', `sync?rev=${latest.current.rev}`)
      if (stopped) return
      setOnline(got.data !== null)
      if (got.data && !got.data.same) take(got.data)
      if (got.data) {
        // Messages that did not go through earlier are tried again now that the server answers.
        for (const m of outboxRef.current) if (m.state === 'failed') void deliver(m)
        // Listings made before the shared shop existed: move them over once.
        const old = read<Listing[]>(LISTINGS_KEY, [])
        if (old.length > 0) {
          let moved = true
          for (const l of old) moved = take(await fetchData('POST', 'listings', l)) && moved
          if (moved) localStorage.removeItem(LISTINGS_KEY)
        }
        // Keep the public part of the profile (name, picture, "say hi about") up to date.
        const p = readProfile()
        const mine: Person = { name: p.name.trim(), photo: p.photo, upFor: p.upFor }
        const known = latest.current.people[latest.current.me]
        if (!samePerson(known, mine) && (known || mine.name || mine.photo || mine.upFor.length > 0)) take(await fetchData('PUT', 'me', mine))
      }
      busy = false
    }
    tick()
    const timer = window.setInterval(tick, 2500)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [take, deliver])

  useEffect(() => {
    write(SAVED_KEY, saved)
  }, [saved])

  const listings = useMemo(() => [...shared.listings, ...SAMPLE_LISTINGS], [shared.listings])
  const mine = useMemo(() => shared.listings.filter((l) => l.ownerId === shared.me), [shared.listings, shared.me])

  /** Returns the new listing's id, or '' when it could not be saved. */
  const addListing = useCallback(async (listing: Listing, photos: string[] = []): Promise<string> => {
    const got = await fetchData('POST', 'listings', { ...listing, photos })
    return take(got) ? (got as { id?: string }).id ?? '' : ''
  }, [take])

  const removeListing = useCallback(async (id: string) => take(await fetchData('DELETE', `listings/${id}`)), [take])

  const toggleSaved = useCallback((id: string) => {
    setSaved((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur]))
  }, [])

  const sendMessage = useCallback((to: string, text: string, listingId?: string) => {
    const m: Message = { id: newId(), from: latest.current.me, to, text, listingId, at: Date.now(), state: 'sending' }
    setOutbox((cur) => [...cur, m])
    void deliver(m)
  }, [deliver])
  const retryMessage = useCallback((id: string) => {
    const m = outboxRef.current.find((x) => x.id === id)
    if (m) void deliver(m)
  }, [deliver])
  const discardMessage = useCallback((id: string) => setOutbox((cur) => cur.filter((x) => x.id !== id)), [])

  const addLook = useCallback(async (look: { caption: string; brands: string[]; photos: string[] }): Promise<string> => {
    const r = await call('POST', 'looks', look)
    return take(r.data) ? r.data!.id ?? '' : ''
  }, [take])
  const removeLook = useCallback(async (id: string) => take(await fetchData('DELETE', `looks/${id}`)), [take])
  const claimRole = useCallback(async (code: string) => {
    const r = await call('POST', 'team/claim', { code })
    take(r.data)
    return r.data ? 'ok' : r.error === 'rate_limited' ? 'slow' : r.status === 0 ? 'offline' : 'wrong'
  }, [take])
  const pickFit = useCallback(async (lookId: string | null, note = '') => take(await fetchData('POST', 'team/fit', { lookId, note })), [take])
  const teamReports = useCallback(async (): Promise<Report[] | null> => {
    const r = await call('GET', 'team/reports')
    return (r.data as unknown as { reports?: Report[] } | null)?.reports ?? null
  }, [])
  const resolveReport = useCallback(async (id: string) => {
    const r = await call('POST', 'team/resolve', { id })
    return (r.data as unknown as { reports?: Report[] } | null)?.reports ?? null
  }, [])

  const setBlocked = useCallback(async (user: string, on: boolean) => take(await fetchData('POST', 'block', { user, on })), [take])
  const report = useCallback(async (user: string, reason: string) => take(await fetchData('POST', 'report', { user, reason })), [take])

  const markRead = useCallback((user: string) => {
    setReadAt((cur) => {
      const next = { ...cur, [user]: Date.now() }
      write(READ_KEY, next)
      return next
    })
  }, [])

  /** One chat per person, newest first. Messages still waiting to go out are shown at the end. */
  const chats = useMemo(() => {
    const confirmed = new Set(shared.messages.map((m) => m.id))
    const by = new Map<string, Message[]>()
    for (const m of [...shared.messages, ...outbox.filter((o) => !confirmed.has(o.id))]) {
      const other = m.state || m.from === shared.me ? m.to : m.from
      by.set(other, [...(by.get(other) ?? []), m.state ? { ...m, from: shared.me } : m])
    }
    return [...by.entries()]
      .map(([user, messages]) => ({
        user,
        messages,
        last: messages[messages.length - 1],
        unread: messages.filter((m) => m.from === user && m.at > (readAt[user] ?? 0)).length,
      }))
      .sort((a, b) => b.last.at - a.last.at)
  }, [shared.messages, shared.me, readAt, outbox])
  const unread = chats.reduce((n, c) => n + c.unread, 0)

  return {
    listings, mine, saved, online, me: shared.me, people: shared.people, blocked: shared.blocked, chats, unread,
    roles: shared.roles ?? {}, myRole: shared.myRole ?? '', looks: shared.looks ?? [], fit: shared.fit ?? null,
    addListing, removeListing, toggleSaved, sendMessage, retryMessage, discardMessage, setBlocked, report, markRead,
    addLook, removeLook, claimRole, pickFit, teamReports, resolveReport,
  }
}

export type Store = ReturnType<typeof useStore>

/** Tiny hash router: "#/", "#/item/abc", "#/sell", "#/saved". */
export function useRoute(): string[] {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

/** Shrinks a chosen photo so it fits in browser storage. */
export function shrinkPhoto(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable'))
    }
    img.src = url
  })
}

/* ---------- Featured-brand activity ----------
   Counted on this device only for now; a real backend is needed to count across all shoppers. */
const STATS_KEY = 'unity.brandStats.v1'
export type StatKind = 'bannerViews' | 'storeClicks' | 'listingViews'
export type BrandStats = Record<string, Partial<Record<StatKind, number>>>

export const readStats = (): BrandStats => read<BrandStats>(STATS_KEY, {})

export function bumpStat(brand: string, kind: StatKind) {
  const stats = readStats()
  stats[brand] = { ...stats[brand], [kind]: (stats[brand]?.[kind] ?? 0) + 1 }
  write(STATS_KEY, stats)
}

/* ---------- Profile (this device only for now) ---------- */
const PROFILE_KEY = 'unity.profile.v1'
export const readProfile = (): Profile => ({ ...EMPTY_PROFILE, ...read<Partial<Profile>>(PROFILE_KEY, {}) })

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(readProfile)
  const [saveFailed, setSaveFailed] = useState(false)
  const update = useCallback((change: Partial<Profile>) => {
    setProfile((cur) => {
      const next = { ...cur, ...change }
      setSaveFailed(!write(PROFILE_KEY, next))
      return next
    })
  }, [])
  return { profile, update, saveFailed }
}
