export const APP_NAME = 'Unity' // working name; change here to rename everywhere

// Brands sellers can pick from. The shop only shows a brand once something from it is listed.
// Sellers can also type a brand that is not here. Not affiliated with any of these brands.
export const BRANDS: readonly string[] = [
  '1:11 the Label', 'Anthony Wang', 'Astral Vision Designs', 'Badinka', 'Born in Stockholm',
  'Cape Robbin', 'CLOUD999', 'Club Exx', 'Cocofields', 'Current Mood', 'Cyberdog', 'Demonia',
  'Dolls Kill', 'Electric Family', 'Elsie & Fred', 'Fashion Nova', 'Forplay', 'Frammyland',
  'Freedom Rave Wear', 'Fūga Studios', 'Grumps Collection', 'I.AM.GIA', 'iEDM', 'iHeartRaves',
  'INTO THE AM', 'J Valentine', 'Jaded London', 'Kiki Riki', 'Leg Avenue', 'Little Black Diamond',
  'Lunautics', 'Mystique Apparel', 'Nasty Gal', 'Official Rebrand', 'Poster Grl', 'Punk Rave',
  'Rave Til Dawn', 'Rave Wonderland', 'Rolita Couture', 'Roma', 'Sad Girls Club',
  'Sassypants the Label', 'Scummy Bears', 'Shein', 'SpiritHoods', 'Sugar Thrillz', 'Tasteful Girl',
  'Tripp NYC', 'Vibedration', 'Widow', 'YRU', 'Zaful',
]

/** Tidies a typed brand: trims it and uses the known spelling when there is one. */
export function cleanBrand(typed: string): string {
  const t = typed.trim().replace(/\s+/g, ' ')
  const known = [...FEATURED.map((f) => f.brand), ...BRANDS]
  return known.find((b) => b.toLowerCase() === t.toLowerCase()) ?? t
}

export const CATEGORIES = ['Sets', 'Tops', 'Bottoms', 'Bodysuits', 'Bikini', 'Accessories'] as const
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'One size'] as const

export const CONDITIONS = [
  { id: 'new', label: 'New with tags', help: 'Never worn. Tags still on.' },
  { id: 'once', label: 'Worn once', help: 'One event, then washed. No marks.' },
  { id: 'light', label: 'Lightly worn', help: 'A few wears. Tiny signs of use at most.' },
  { id: 'loved', label: 'Well loved', help: 'Worn often. Any flaws are in the description.' },
] as const

export type Category = (typeof CATEGORIES)[number]
export type Size = (typeof SIZES)[number]
export type ConditionId = (typeof CONDITIONS)[number]['id']
export type ArtKind = 'set' | 'top' | 'bottom' | 'bodysuit' | 'bikini' | 'accessory'

export interface Listing {
  id: string
  title: string
  brand: string
  category: Category
  size: Size
  condition: ConditionId
  price: number
  description: string
  seller: string
  /** Public id of the person who listed it. Sample listings have none. */
  ownerId?: string
  sample: boolean
  createdAt: number
  /** How many pictures the seller added. Each loads from /api/photo/<id>/<number>. */
  photoCount?: number
  art?: { kind: ArtKind; bg: string; fill: string; accent: string }
  /** Set by the seller. Sold outfits leave the shop after a day. */
  status?: 'sold' | 'reserved'
  soldAt?: number
  /** The festival it was worn at, like "Tahoe Live 2026". Optional. */
  wornAt?: string
  /** How many days the seller needs to send it: 1, 3 or 7. Older listings may not say. */
  shipDays?: ShipDays
}

export type ShipDays = 1 | 3 | 7
export const SHIP_OPTIONS: { days: ShipDays; label: string }[] = [
  { days: 1, label: 'Next day' },
  { days: 3, label: 'Within 3 days' },
  { days: 7, label: 'Within a week' },
]
/** Standard shipping inside the US, on the slow side so "in time" means in time. */
export const TRANSIT_DAYS = 5

/** When it should reach a buyer who orders today: the seller's days to send, plus the trip. */
export function arrivesBy(l: Pick<Listing, 'shipDays'>, from = new Date()): Date | null {
  if (!l.shipDays) return null
  const d = new Date(from)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + l.shipDays + TRANSIT_DAYS)
  return d
}
/** True when it should arrive at least a day before the festival starts (YYYY-MM-DD). */
export function arrivesBefore(l: Pick<Listing, 'shipDays'>, date: string, from = new Date()): boolean {
  const by = arrivesBy(l, from)
  if (!by) return false
  const start = new Date(`${date}T12:00:00`)
  start.setDate(start.getDate() - 1)
  return by.getTime() <= start.getTime()
}

export const conditionLabel = (id: ConditionId) => CONDITIONS.find((c) => c.id === id)!.label

export const ART_FOR_CATEGORY: Record<Category, ArtKind> = {
  Sets: 'set',
  Tops: 'top',
  Bottoms: 'bottom',
  Bodysuits: 'bodysuit',
  Bikini: 'bikini',
  Accessories: 'accessory',
}

const P = { pink: '#FF7DB8', hot: '#E6338A', blue: '#6BC1FF', deep: '#2F8FE8', lilac: '#B79CFF', gold: '#FFC83D', mint: '#7FE3C8', plum: '#3B1F5E', white: '#FFFFFF' }
const BG = { pink: '#FFE1EF', blue: '#D6EEFF', lilac: '#EADFFF', mint: '#DDF8EF', gold: '#FFF1C9' }

let n = 0
const s = (
  title: string, brand: string, category: Category, size: Size, condition: ConditionId, price: number,
  description: string, seller: string, bg: string, fill: string, accent: string,
): Listing => ({
  id: `sample-${++n}`, title, brand, category, size, condition, price, description, seller,
  sample: true, createdAt: 1000 - n, shipDays: ([1, 3, 7] as const)[n % 3], art: { kind: ART_FOR_CATEGORY[category], bg, fill, accent },
})

// Sample listings so the shop has something to browse. None of these are real items or real sellers.
export const SAMPLE_LISTINGS: Listing[] = [
  s('Holographic two-piece set', 'Badinka', 'Sets', 'S', 'once', 48, 'Top and skirt, worn for one night. Washed cold and hung dry.', 'Sample seller A', BG.blue, P.pink, P.gold),
  s('Butterfly mesh top', 'Tasteful Girl', 'Tops', 'M', 'light', 22, 'Sheer mesh with butterfly print. Stretchy, fits true to size.', 'Sample seller B', BG.pink, P.blue, P.white),
  s('Sparkle flare pants', 'iHeartRaves', 'Bottoms', 'M', 'once', 35, 'High-waisted flares with glitter finish. No snags.', 'Sample seller C', BG.lilac, P.hot, P.gold),
  s('Cloud print bodysuit', 'Freedom Rave Wear', 'Bodysuits', 'S', 'new', 52, 'Never worn, tags on. Bought the wrong size.', 'Sample seller A', BG.pink, P.deep, P.white),
  s('Pink shimmer bikini', 'Cocofields', 'Bikini', 'S', 'once', 30, 'Triangle top and cheeky bottom. Worn to one pool party.', 'Sample seller D', BG.blue, P.pink, P.white),
  s('Fuzzy leg warmers', 'Frammyland', 'Accessories', 'One size', 'light', 18, 'Soft and fluffy, elastic at the top so they stay up.', 'Sample seller B', BG.mint, P.lilac, P.pink),
  s('Lilac ruffle set', 'Sassypants the Label', 'Sets', 'L', 'light', 44, 'Ruffle top and matching skirt. Worn twice.', 'Sample seller E', BG.gold, P.lilac, P.white),
  s('Iridescent wrap top', '1:11 the Label', 'Tops', 'XS', 'once', 26, 'Ties at the front, adjustable fit.', 'Sample seller C', BG.blue, P.mint, P.gold),
  s('Star cut-out bodysuit', 'Badinka', 'Bodysuits', 'M', 'light', 40, 'Star cut-outs at the waist. Snap closure works perfectly.', 'Sample seller D', BG.lilac, P.plum, P.gold),
  s('Baby blue bikini', 'Tasteful Girl', 'Bikini', 'M', 'new', 34, 'New with tags. Adjustable ties on both pieces.', 'Sample seller E', BG.pink, P.blue, P.white),
  s('Glitter mini skirt', 'iHeartRaves', 'Bottoms', 'S', 'loved', 14, 'Worn to lots of shows. A little glitter loss near the hem, shown in the price.', 'Sample seller A', BG.blue, P.gold, P.pink),
  s('Mint mesh set', 'Cocofields', 'Sets', 'M', 'once', 46, 'Mesh top with matching bottoms. One festival day only.', 'Sample seller B', BG.pink, P.mint, P.white),
  s('Heart buckle top', 'Freedom Rave Wear', 'Tops', 'L', 'light', 24, 'Heart buckle at the centre, adjustable straps.', 'Sample seller C', BG.gold, P.hot, P.white),
  s('Cloud arm sleeves', 'Sassypants the Label', 'Accessories', 'One size', 'once', 16, 'Stretch sleeves with thumb holes.', 'Sample seller D', BG.lilac, P.blue, P.white),
  s('Rosy velvet shorts', 'Frammyland', 'Bottoms', 'XL', 'light', 20, 'Soft velvet, high waist, lots of stretch.', 'Sample seller E', BG.mint, P.pink, P.gold),
  s('Plum sparkle bodysuit', '1:11 the Label', 'Bodysuits', 'L', 'once', 42, 'Long sleeve, sparkle finish. Worn one night.', 'Sample seller A', BG.blue, P.plum, P.pink),
]

/* ---------- Featured (paying) brands ----------
   A featured brand pays a monthly fee. It shows first in the brand row even with no listings,
   gets a banner when shoppers pick it, and a "Buy it new" link on its resale listings.
   Every featured spot is labelled "Sponsored". Add real partners to this list. */
export interface FeaturedBrand {
  brand: string
  storeUrl: string
  blurb: string
  /** true = a made-up placeholder, shown so the spot can be previewed before any brand signs up */
  example?: boolean
}

export const FEATURED: FeaturedBrand[] = [
  {
    brand: 'Your Brand Here',
    storeUrl: '#/for-brands',
    blurb: 'This is an example of a featured brand spot. A real brand’s message and store link go here.',
    example: true,
  },
]

export const featuredFor = (brand: string) => FEATURED.find((f) => f.brand === brand)

/** Where brands should write to. Leave empty until there is a real address. */
export const BRAND_CONTACT_EMAIL = ''

/* ---------- Profile ---------- */
export const VIBES = ['Cutesy', 'Sparkly', 'Pastel', 'Neon', 'Fairy', 'Y2K', 'Cyber', 'Dark & edgy', 'Boho', 'Matching sets'] as const
export const UP_FOR = ['Trading outfits', 'Getting ready together', 'Making content', 'Festival friends'] as const

export interface Profile {
  name: string
  photo: string
  sizes: string[]
  brands: string[]
  vibes: string[]
  upFor: string[]
  /** Instagram handle without the @. Public, on listings and the seller page. */
  instagram: string
}

export const EMPTY_PROFILE: Profile = { name: '', photo: '', sizes: [], brands: [], vibes: [], upFor: [], instagram: '' }
