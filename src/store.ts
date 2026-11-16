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
export interface Message { id: string; from: string; to: string; text: string; listingId?: string; at: number }
interface Shared { rev: number; me: string; listings: Listing[]; people: Record<string, Person>; messages: Message[]; blocked: string[] }
const NOTHING: Shared = { rev: 0, me: '', listings: [], people: {}, messages: [], blocked: [] }

export const NO_ONE: Person = { name: '', photo: '', upFor: [] }
export const nameOf = (p: Person | undefined) => p?.name.trim() || 'Someone new'

async function call(method: string, path: string, body?: unknown): Promise<(Shared & { same?: boolean; id?: string }) | null> {
  try {
    const res = await fetch(`/api/${path}`, {
      method,
      headers: { 'x-unity-key': deviceKey(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null
    return await res.json()
  } catch {
    return null
  }
}

const samePerson = (a: Person | undefined, b: Person) =>
  !!a && a.name === b.name && a.photo === b.photo && a.upFor.join('|') === b.upFor.join('|')

export function useStore() {
  const [shared, setShared] = useState<Shared>(NOTHING)
  const [online, setOnline] = useState<boolean | null>(null)
  const [saved, setSaved] = useState<string[]>(() => read<string[]>(SAVED_KEY, []))
  const [readAt, setReadAt] = useState<Record<string, number>>(() => read<Record<string, number>>(READ_KEY, {}))
  const latest = useRef(NOTHING)

  const take = useCallback((next: Shared | null) => {
    if (!next) return false
    latest.current = next
    setShared(next)
    return true
  }, [])

  useEffect(() => {
    let stopped = false
    let busy = false
    async function tick() {
      if (busy || stopped) return
      busy = true
      const got = await call('GET', `sync?rev=${latest.current.rev}`)
      if (stopped) return
      setOnline(got !== null)
      if (got && !got.same) take(got)
      if (got) {
        // Listings made before the shared shop existed: move them over once.
        const old = read<Listing[]>(LISTINGS_KEY, [])
        if (old.length > 0) {
          let moved = true
          for (const l of old) moved = take(await call('POST', 'listings', l)) && moved
          if (moved) localStorage.removeItem(LISTINGS_KEY)
        }
        // Keep the public part of the profile (name, picture, "say hi about") up to date.
        const p = readProfile()
        const mine: Person = { name: p.name.trim(), photo: p.photo, upFor: p.upFor }
        const known = latest.current.people[latest.current.me]
        if (!samePerson(known, mine) && (known || mine.name || mine.photo || mine.upFor.length > 0)) take(await call('PUT', 'me', mine))
      }
      busy = false
    }
    tick()
    const timer = window.setInterval(tick, 2500)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [take])

  useEffect(() => {
    write(SAVED_KEY, saved)
  }, [saved])

  const listings = useMemo(() => [...shared.listings, ...SAMPLE_LISTINGS], [shared.listings])
  const mine = useMemo(() => shared.listings.filter((l) => l.ownerId === shared.me), [shared.listings, shared.me])

  /** Returns the new listing's id, or '' when it could not be saved. */
  const addListing = useCallback(async (listing: Listing): Promise<string> => {
    const got = await call('POST', 'listings', listing)
    return take(got) ? got!.id ?? '' : ''
  }, [take])

  const removeListing = useCallback(async (id: string) => take(await call('DELETE', `listings/${id}`)), [take])

  const toggleSaved = useCallback((id: string) => {
    setSaved((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur]))
  }, [])

  const sendMessage = useCallback(
    async (to: string, text: string, listingId?: string) => take(await call('POST', 'messages', { to, text, listingId })),
    [take],
  )
  const setBlocked = useCallback(async (user: string, on: boolean) => take(await call('POST', 'block', { user, on })), [take])
  const report = useCallback(async (user: string, reason: string) => take(await call('POST', 'report', { user, reason })), [take])

  const markRead = useCallback((user: string) => {
    setReadAt((cur) => {
      const next = { ...cur, [user]: Date.now() }
      write(READ_KEY, next)
      return next
    })
  }, [])

  /** One chat per person, newest first. */
  const chats = useMemo(() => {
    const by = new Map<string, Message[]>()
    for (const m of shared.messages) {
      const other = m.from === shared.me ? m.to : m.from
      by.set(other, [...(by.get(other) ?? []), m])
    }
    return [...by.entries()]
      .map(([user, messages]) => ({
        user,
        messages,
        last: messages[messages.length - 1],
        unread: messages.filter((m) => m.from === user && m.at > (readAt[user] ?? 0)).length,
      }))
      .sort((a, b) => b.last.at - a.last.at)
  }, [shared.messages, shared.me, readAt])
  const unread = chats.reduce((n, c) => n + c.unread, 0)

  return {
    listings, mine, saved, online, me: shared.me, people: shared.people, blocked: shared.blocked, chats, unread,
    addListing, removeListing, toggleSaved, sendMessage, setBlocked, report, markRead,
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
