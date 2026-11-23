import { useCallback, useState } from 'react'
import type { Listing } from './data'
import { readProfile, type Store } from './store'

/* New-outfit alerts. Your favorite brands and sizes stay on this phone, so the matching
   happens here too: nothing about your taste is sent anywhere. */
const KEY = 'unity.alerts.v1'
interface AlertState { since: number; seenAt: number }

function load(): AlertState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as AlertState | null
    if (s && s.since && s.seenAt) return s
  } catch {
    /* start fresh */
  }
  const now = Date.now()
  const fresh = { since: now, seenAt: now }
  try {
    localStorage.setItem(KEY, JSON.stringify(fresh))
  } catch {
    /* alerts still work for this visit */
  }
  return fresh
}

/** A new outfit matches when it is from a favorite brand in one of your sizes, or, with no favorite brands set, just in your size. */
export function matchesYou(l: Listing, brands: string[], sizes: string[]): boolean {
  const sizeOk = sizes.length === 0 || sizes.includes(l.size) || l.size === 'One size'
  if (brands.length > 0) return brands.some((b) => b.toLowerCase() === l.brand.toLowerCase()) && sizeOk
  return sizes.length > 0 && sizes.includes(l.size)
}

export function useAlerts(store: Store) {
  const [state, setState] = useState(load)
  const p = readProfile()
  const cutoff = Math.max(state.since, Date.now() - 30 * 86_400_000)
  const matches = store.listings
    .filter((l) => !l.sample && l.ownerId !== store.me && l.createdAt > cutoff && matchesYou(l, p.brands, p.sizes))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 60)
  const fresh = matches.filter((l) => l.createdAt > state.seenAt).length

  const markSeen = useCallback(() => {
    const next = { ...load(), seenAt: Date.now() }
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* fine */
    }
    setState(next)
  }, [])

  return { matches, fresh, seenAt: state.seenAt, hasPrefs: p.brands.length > 0 || p.sizes.length > 0, markSeen }
}
export type Alerts = ReturnType<typeof useAlerts>
