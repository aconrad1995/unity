// "Picked for you": learns what a shopper is into and ranks listings to match.
// Signals: searches, brand/type/size taps, listings opened, outfits saved, plus the profile.
// Everything stays on this device and can be cleared from the profile page.
import type { Listing, Profile } from './data'

export interface Taste {
  brands: Record<string, number>
  categories: Record<string, number>
  sizes: Record<string, number>
  words: Record<string, number>
}

const KEY = 'unity.taste.v1'
const EMPTY: Taste = { brands: {}, categories: {}, sizes: {}, words: {} }
const CAP = 12 // one obsession can't drown everything else out

export function readTaste(): Taste {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Taste>) } : { ...EMPTY }
  } catch {
    return { ...EMPTY }
  }
}

function writeTaste(t: Taste) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t))
  } catch {
    /* learning is optional */
  }
}

/** Record interest. weight: 1 = looked at, 2 = chose it on purpose, 3 = saved it. */
export function note(kind: keyof Taste, key: string, weight = 2) {
  if (!key) return
  const t = readTaste()
  t[kind] = { ...t[kind], [key]: Math.min(CAP, (t[kind][key] ?? 0) + weight) }
  writeTaste(t)
}

const SKIP = new Set(['the', 'and', 'for', 'with', 'size'])

export function noteSearch(query: string) {
  query
    .toLowerCase()
    .split(/[^a-z0-9:]+/)
    .filter((w) => w.length >= 3 && !SKIP.has(w))
    .forEach((w) => note('words', w, 2))
}

export function noteListing(listing: Listing, weight: number) {
  note('brands', listing.brand, weight)
  note('categories', listing.category, weight)
}

export const resetTaste = () => writeTaste({ ...EMPTY })

const VIBE_WORDS: Record<string, string[]> = {
  Cutesy: ['heart', 'butterfly', 'ruffle', 'cloud', 'fuzzy'],
  Sparkly: ['sparkle', 'glitter', 'shimmer', 'holographic', 'iridescent', 'star'],
  Pastel: ['pink', 'lilac', 'baby blue', 'mint', 'rosy'],
  Fairy: ['butterfly', 'mesh', 'iridescent', 'wrap'],
  'Matching sets': ['set', 'two-piece'],
  'Dark & edgy': ['plum', 'cut-out', 'buckle', 'velvet'],
}

export function hasSignals(t: Taste, p: Profile): boolean {
  return [t.brands, t.categories, t.sizes, t.words].some((m) => Object.keys(m).length > 0) || p.sizes.length + p.brands.length + p.vibes.length > 0
}

/** Higher = better match. What they asked for directly (profile, searches) counts most. */
export function score(l: Listing, t: Taste, p: Profile): number {
  const text = `${l.title} ${l.description}`.toLowerCase()
  let s = 0
  s += (t.brands[l.brand] ?? 0) * 1.5
  s += (t.categories[l.category] ?? 0) * 1
  s += (t.sizes[l.size] ?? 0) * 1.5
  for (const [w, n] of Object.entries(t.words)) {
    if (text.includes(w) || l.brand.toLowerCase().includes(w) || l.category.toLowerCase().includes(w)) s += n * 1.5
  }
  if (p.brands.includes(l.brand)) s += 8
  if (p.sizes.includes(l.size) || (p.sizes.length > 0 && l.size === 'One size')) s += 10
  for (const v of p.vibes) if ((VIBE_WORDS[v] ?? []).some((w) => text.includes(w))) s += 3
  return s
}

/** The top few things learned, for showing back to the shopper. */
export function topOf(map: Record<string, number>, n = 4): string[] {
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k)
}
