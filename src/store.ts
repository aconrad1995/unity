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
const SAMPLES_UNTIL = 8
const READ_KEY = 'unity.read.v1'

export function deviceKey(): string {
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

export interface Person { name: string; photo: string; upFor: string[]; instagram?: string }
export interface Rating { by: string; stars: number; note: string; at: number }
export interface RatingSummary { count: number; average: number; recent: Rating[] }

/** An Instagram handle from "@name", "name" or a profile link, the same way the server reads it. '' when it isn't one. */
export function instagramOf(v: string): string {
  const h = v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : ''
}
export interface Message { id: string; from: string; to: string; text: string; listingId?: string; about?: string; at: number; state?: 'sending' | 'failed' | 'rejected'; why?: string }
export type Role = '' | 'owner' | 'admin'
export interface Look { id: string; ownerId: string; caption: string; brands: string[]; photoCount: number; createdAt: number }
export interface Fit { lookId: string; note: string; at: number; by: string }
export interface Report { id: string; by: string; user: string; reason: string; at: number; resolved?: number; evidence: Message[] }
interface Shared {
  rev: number; me: string; listings: Listing[]; people: Record<string, Person>; messages: Message[]; blocked: string[]
  roles: Record<string, Role>; myRole: Role; looks: Look[]; fit: Fit | null; ratings: Record<string, RatingSummary>; account: string | null
}
const NOTHING: Shared = { rev: 0, me: '', listings: [], people: {}, messages: [], blocked: [], roles: {}, myRole: '', looks: [], fit: null, ratings: {}, account: null }

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

// The same small fingerprint the server uses (server/api.mjs sumOf), so the app can tell whether
// the picture on the server is already this one without downloading it.
function sumOf(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}
const samePerson = (a: Person | undefined, b: Person, me: string) =>
  !!a && a.name === b.name && a.photo === (b.photo ? `/api/avatar/${me}/${sumOf(b.photo)}` : '') && a.upFor.join('|') === b.upFor.join('|') && (a.instagram ?? '') === (b.instagram ?? '')

/* ---------- Moving to another phone or browser ----------
   Everything someone has listed belongs to this device's secret key. Showing it as a "move code"
   lets Mary carry her shop from Safari to the home-screen app, or to a new phone. */
export function moveCode(): string {
  return deviceKey()
}
export function applyMoveCode(code: string): boolean {
  const clean = code.trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(clean)) return false
  return becomeKey(clean)
}

/* ---------- Accounts ----------
   Signing in hands this browser the account's secret key. The public profile on the server then
   wins over whatever this browser had, so a fresh phone never wipes your name or picture. */
const ADOPT_KEY = 'unity.adopt.v1'
function becomeKey(key: string): boolean {
  try {
    localStorage.setItem(KEY_KEY, key)
    localStorage.removeItem(OUTBOX_KEY)
    localStorage.setItem(ADOPT_KEY, '1')
    return true
  } catch {
    return false
  }
}
const ACCOUNT_WHY: Record<string, string> = {
  bad_email: 'That email doesn’t look right. Check it and try again.',
  weak_password: 'Use a password of at least 8 characters.',
  email_taken: 'That email already has an account. Sign in instead.',
  has_account: 'This phone is already signed in to an account.',
  wrong_login: 'That email and password don’t match. Check them and try again.',
  rate_limited: 'Too many tries. Wait a little while, then try again.',
  no_account: 'This phone isn’t signed in.',
}
const accountWhy = (r: Reply) => (r.error && ACCOUNT_WHY[r.error]) || (r.status === 0 ? 'Unity can’t be reached. Check your connection.' : 'That didn’t work. Try again in a moment.')

/** Signs this browser in to an account. Returns why it failed, or '' (then reload the page). */
export async function signIn(email: string, password: string): Promise<string> {
  const r = await call('POST', 'account/signin', { email, password })
  const key = (r.data as unknown as { key?: string } | null)?.key
  if (!key) return accountWhy(r)
  return becomeKey(key) ? '' : 'This browser can’t save the sign-in. Turn off private browsing and try again.'
}

/** Signs this browser out: a fresh, empty identity, and the public profile on this phone is cleared. */
export function signOut() {
  try {
    for (const k of [KEY_KEY, OUTBOX_KEY, READ_KEY, PROFILE_KEY, ADOPT_KEY]) localStorage.removeItem(k)
  } catch {
    /* nothing kept to clear */
  }
}

async function photoAsDataUrl(url: string): Promise<string> {
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise((ok) => {
      const fr = new FileReader()
      fr.onload = () => ok(typeof fr.result === 'string' ? fr.result : '')
      fr.onerror = () => ok('')
      fr.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

/** What a refusal from the server means, in words for the person using the app. */
export const LISTING_WHY: Record<string, string> = {
  rate_limited: 'You have listed a lot in a short time. Wait a little while, then try again.',
  storage_full: 'Unity is out of room for new photos right now. Message the team and we’ll sort it out.',
  too_many_listings: 'You have reached the most outfits one person can list. Remove a sold one to add more.',
  bad_photo: 'One of the photos could not be used. Try taking it again, or choose a different photo.',
  too_many_photos: 'That’s too many photos. Up to 5 per outfit.',
  bad_price: 'The price needs to be between $1 and $10,000.',
  not_saved: 'Your outfit could not be saved. Try again in a moment.',
  too_big: 'Those photos are too big to send together. Try fewer photos.',
}

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
  const refusedProfile = useRef('')
  const [refusal, setRefusal] = useState<'' | 'name' | 'handle'>('')
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
    let misses = 0
    async function tick() {
      // A phone in a pocket doesn't need the shop every 2.5 seconds; it catches up when it's back.
      if (busy || stopped || document.hidden) return
      busy = true
      try { await step() } catch { /* one bad round never stops syncing */ } finally { busy = false }
    }
    async function step() {
      const got = await call('GET', `sync?rev=${latest.current.rev}`)
      if (stopped) return
      // One dropped request on a festival campsite's signal isn't "offline"; two in a row is.
      misses = got.data ? 0 : misses + 1
      if (got.data) setOnline(true)
      else if (misses >= 2 || latest.current.rev === 0) setOnline(false)
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
        // Just signed in: take the name, picture and picks this account already has on the server.
        let adopting = false
        try { adopting = localStorage.getItem(ADOPT_KEY) === '1' } catch { /* no storage */ }
        if (adopting) {
          const theirs = latest.current.people[latest.current.me]
          if (theirs) {
            const photo = theirs.photo ? await photoAsDataUrl(theirs.photo) : ''
            write(PROFILE_KEY, { ...readProfile(), name: theirs.name, photo, upFor: theirs.upFor, instagram: theirs.instagram ?? '' })
            window.dispatchEvent(new Event('unity-profile'))
          }
          try { localStorage.removeItem(ADOPT_KEY) } catch { /* fine */ }
        }
        // Keep the public part of the profile (name, picture, "say hi about") up to date.
        const p = readProfile()
        const ig = instagramOf(p.instagram ?? '')
        const mine: Person = { name: p.name.trim(), photo: p.photo, upFor: p.upFor, ...(ig ? { instagram: ig } : {}) }
        const meId = latest.current.me
        const known = latest.current.people[meId]
        const sig = JSON.stringify(mine)
        if (!samePerson(known, mine, meId) && sig !== refusedProfile.current && (known || mine.name || mine.photo || mine.upFor.length > 0 || ig)) {
          const r = await call('PUT', 'me', mine)
          if (r.data) {
            take(r.data)
            setRefusal('')
          } else if (r.error === 'name_reserved' || r.error === 'handle_reserved') {
            // Not tried again until the name or handle changes.
            refusedProfile.current = sig
            setRefusal(r.error === 'name_reserved' ? 'name' : 'handle')
          }
        }
      }
    }
    const onVisible = () => { if (!document.hidden) void tick() }
    void tick()
    const timer = window.setInterval(tick, 2500)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [take, deliver])

  useEffect(() => {
    write(SAVED_KEY, saved)
  }, [saved])

  // Sample outfits fill the shop only until real ones arrive, so they never get mixed in with real stock.
  // Sold outfits drop out of the shop after a day, but stay in the seller's closet.
  const listings = useMemo(() => {
    const dayAgo = Date.now() - 86_400_000
    const real = shared.listings.filter((l) => l.status !== 'sold' || (l.soldAt ?? 0) > dayAgo || l.ownerId === shared.me)
    return real.length >= SAMPLES_UNTIL ? real : [...real, ...SAMPLE_LISTINGS]
  }, [shared.listings, shared.me])
  const mine = useMemo(() => shared.listings.filter((l) => l.ownerId === shared.me), [shared.listings, shared.me])

  /** Returns the new listing's id, or why it could not be saved. */
  const addListing = useCallback(async (listing: Listing, photos: string[] = []): Promise<{ id: string; why: string }> => {
    const r = await call('POST', 'listings', { ...listing, photos })
    if (take(r.data)) return { id: r.data!.id ?? '', why: '' }
    return { id: '', why: (r.error && LISTING_WHY[r.error]) || (r.status === 0 ? `Unity can’t be reached. Check your connection and try again.` : 'Your outfit could not be listed. Try again in a moment.') }
  }, [take])

  /** Changes a listing's details or marks it sold / reserved. Returns why it failed, or '' when it worked. */
  /** `photos` is the new order: a number keeps that existing photo, a JPEG data URL adds one. */
  const editListing = useCallback(async (id: string, change: Partial<Pick<Listing, 'title' | 'price' | 'description' | 'size' | 'condition' | 'shipDays'>> & { status?: Listing['status'] | null; photos?: (number | string)[] }) => {
    const r = await call('PATCH', `listings/${id}`, change)
    if (take(r.data)) return ''
    if (r.status === 0) return 'Unity can’t be reached. Check your connection.'
    if (r.error === 'bad_details') return 'Check the name and price, then try again.'
    return (r.error && r.error !== 'rate_limited' && LISTING_WHY[r.error]) || 'That change could not be saved. Try again in a moment.'
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

  /** Rate a seller (1 to 5 stars and an optional note). Returns why it failed, or '' when it worked. */
  const rate = useCallback(async (of: string, stars: number, note: string) => {
    const r = await call('PUT', 'ratings', { of, stars, note })
    if (take(r.data)) return ''
    return r.error === 'chat_first' ? 'You can rate a seller once you’ve both written in a chat.' : r.error === 'rate_limited' ? 'You’ve rated a lot today. Try again tomorrow.' : r.status === 0 ? 'Unity can’t be reached. Check your connection.' : 'Your rating could not be saved. Try again in a moment.'
  }, [take])
  const unrate = useCallback(async (of: string) => take(await fetchData('DELETE', 'ratings', { of })), [take])
  const removeRating = useCallback(async (of: string, by: string) => take(await fetchData('POST', 'team/rating-remove', { of, by })), [take])
  /** Ratings are for sellers you've had a real two-way chat with. */
  const canRate = useCallback((of: string) => {
    const s = latest.current
    if (!of || of === s.me || !s.listings.some((l) => l.ownerId === of)) return false
    return s.messages.some((m) => m.from === s.me && m.to === of) && s.messages.some((m) => m.from === of && m.to === s.me)
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const r = await call('POST', 'account/signup', { email, password })
    return take(r.data) ? '' : accountWhy(r)
  }, [take])
  const changePassword = useCallback(async (current: string, next: string) => {
    const r = await call('POST', 'account/password', { current, next })
    return take(r.data) ? '' : r.error === 'wrong_login' ? 'Your current password isn’t right.' : accountWhy(r)
  }, [take])
  const resetPassword = useCallback(async (email: string, password: string) => {
    const r = await call('POST', 'team/account-reset', { email, password })
    return r.data ? '' : r.status === 404 ? 'No account uses that email.' : accountWhy(r)
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
    roles: shared.roles ?? {}, myRole: shared.myRole ?? '', looks: shared.looks ?? [], fit: shared.fit ?? null, ratings: shared.ratings ?? {}, account: shared.account ?? null, signUp, changePassword, resetPassword,
    nameRefused: refusal === 'name', handleRefused: refusal === 'handle', rate, unrate, removeRating, canRate, addListing, editListing, removeListing, toggleSaved, sendMessage, retryMessage, discardMessage, setBlocked, report, markRead,
    addLook, removeLook, claimRole, pickFit, teamReports, resolveReport,
  }
}

export type Store = ReturnType<typeof useStore>

/** Tiny hash router: "#/", "#/item/abc", "#/sell", "#/saved". */
/* Scroll memory: each history entry gets a number, and its scroll position is kept under it, so Back
   from an outfit lands where you were in the shop. A new page starts at the top. */
const scrollAt = new Map<number, number>()
let entry = 0
let entries = 0
function entryOf(state: unknown): number | undefined {
  return state && typeof state === 'object' && typeof (state as { unityEntry?: unknown }).unityEntry === 'number' ? (state as { unityEntry: number }).unityEntry : undefined
}
function stamp(): boolean {
  const known = entryOf(window.history.state)
  if (known !== undefined) { entry = known; entries = Math.max(entries, known); return false }
  entry = ++entries
  try { window.history.replaceState({ ...(window.history.state ?? {}), unityEntry: entry }, '') } catch { /* fine */ }
  return true
}
if (typeof window !== 'undefined') {
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  stamp()
  window.addEventListener('scroll', () => { scrollAt.set(entry, window.scrollY) }, { passive: true })
}

export function useRoute(): string[] {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => {
      // The page hasn't re-rendered yet, so this is still where the outgoing page was scrolled.
      scrollAt.set(entry, window.scrollY)
      const fresh = stamp()
      setHash(window.location.hash)
      const y = fresh ? 0 : scrollAt.get(entry) ?? 0
      // Wait for the new page to render before scrolling, then point screen readers at its heading.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.scrollTo(0, y)
        if (fresh) {
          const h = document.querySelector<HTMLElement>('main h1, header h1, h1')
          if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }) }
        }
      }))
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
  // After signing in, the account's profile arrives from the server and replaces this one.
  useEffect(() => {
    const reload = () => setProfile(readProfile())
    window.addEventListener('unity-profile', reload)
    return () => window.removeEventListener('unity-profile', reload)
  }, [])
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
