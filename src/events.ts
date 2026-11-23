// Events portal data: real festivals, added by hand with a source link for each.
// To go live with more, replace loadEvents() with a call to a real feed (for example EDMTrain or Ticketmaster).

export interface City { name: string; lat: number; lng: number }

export const CITIES: City[] = [
  { name: 'Atlanta, GA', lat: 33.749, lng: -84.388 },
  { name: 'Austin, TX', lat: 30.267, lng: -97.743 },
  { name: 'Boston, MA', lat: 42.36, lng: -71.059 },
  { name: 'Calgary, AB', lat: 51.045, lng: -114.072 },
  { name: 'Charlotte, NC', lat: 35.227, lng: -80.843 },
  { name: 'Chicago, IL', lat: 41.878, lng: -87.63 },
  { name: 'Columbus, OH', lat: 39.961, lng: -82.999 },
  { name: 'Dallas, TX', lat: 32.777, lng: -96.797 },
  { name: 'Denver, CO', lat: 39.739, lng: -104.99 },
  { name: 'Detroit, MI', lat: 42.331, lng: -83.046 },
  { name: 'Houston, TX', lat: 29.76, lng: -95.37 },
  { name: 'Las Vegas, NV', lat: 36.17, lng: -115.14 },
  { name: 'Los Angeles, CA', lat: 34.052, lng: -118.244 },
  { name: 'Mexico City, Mexico', lat: 19.433, lng: -99.133 },
  { name: 'Miami, FL', lat: 25.762, lng: -80.192 },
  { name: 'Minneapolis, MN', lat: 44.978, lng: -93.265 },
  { name: 'Montréal, QC', lat: 45.502, lng: -73.567 },
  { name: 'New Orleans, LA', lat: 29.951, lng: -90.072 },
  { name: 'New York, NY', lat: 40.713, lng: -74.006 },
  { name: 'Orlando, FL', lat: 28.538, lng: -81.379 },
  { name: 'Phoenix, AZ', lat: 33.448, lng: -112.074 },
  { name: 'Portland, OR', lat: 45.515, lng: -122.679 },
  { name: 'Salt Lake City, UT', lat: 40.761, lng: -111.891 },
  { name: 'San Diego, CA', lat: 32.716, lng: -117.161 },
  { name: 'San Francisco, CA', lat: 37.775, lng: -122.419 },
  { name: 'Seattle, WA', lat: 47.606, lng: -122.332 },
  { name: 'Tampa, FL', lat: 27.951, lng: -82.457 },
  { name: 'Toronto, ON', lat: 43.653, lng: -79.383 },
  { name: 'Vancouver, BC', lat: 49.283, lng: -123.121 },
  { name: 'Washington, DC', lat: 38.907, lng: -77.037 },
]

export type Genre = 'bass' | 'house' | 'trance' | 'mixed'
export const GENRES: { id: Genre; label: string }[] = [
  { id: 'mixed', label: 'Big lineups' },
  { id: 'bass', label: 'Bass and dubstep' },
  { id: 'house', label: 'House and techno' },
  { id: 'trance', label: 'Trance' },
]

export interface RaveEvent {
  id: string
  name: string
  city: string
  place: string
  lat: number
  lng: number
  /** ISO date of the first day. When `tba` is set, only the month is known and this is the 1st. */
  date: string
  days: number
  /** The festival's own website, where the button sends people. Dates were checked against it or a press release. */
  url: string
  /** What it mostly plays. EDMTrain events have none. */
  genre?: Genre
  /** The dates are not announced yet. The month is when it usually happens. */
  tba?: boolean
  /** Shown on the card when the dates are not yet on an official page. */
  note?: string
  /** Set on events pulled from EDMTrain. */
  via?: 'EDMTrain'
}

/** Ids come from the name and start date, so adding or reordering events never changes someone else's.
    When an expected-month festival gets real dates, keep its old id with `id` so "I'm going" survives. */
const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
type Extra = { note?: string; id?: string }
const e = (name: string, city: string, place: string, lat: number, lng: number, date: string, days: number, url: string, genre: Genre, extra: Extra = {}): RaveEvent => ({
  id: extra.id ?? `${slug(name)}-${date}`, name, city, place, lat, lng, date, days, url, genre, note: extra.note,
})
/** A festival that happens every year but has not announced dates: listed under its usual month. */
const tba = (name: string, city: string, place: string, lat: number, lng: number, month: string, url: string, genre: Genre): RaveEvent => ({
  id: `${slug(name)}-${month}`, name, city, place, lat, lng, date: `${month}-01`, days: 1, url, genre, tba: true,
})

const LISTINGS = 'Dates come from listings, not the festival’s own page yet. Check before you buy.'
const BREAKAWAY = 'https://www.breakawayfestival.com'
const VENUE_SOON = 'Venue to be announced'

/** Electronic festivals in the US, Canada and Mexico, checked 23 Nov 2026 against each festival's site,
    its promoter's press or ticket sellers. Add new ones here; keep the official link. */
export const EVENTS_CHECKED = '23 Nov 2026'
const EVENTS: RaveEvent[] = [
  // 2026
  e('Tahoe Live', 'Olympic Valley, CA', 'Palisades Tahoe', 39.1969, -120.2358, '2026-12-11', 3, 'https://tahoelive.net', 'mixed'),
  e('Decadence Colorado', 'Denver, CO', 'Colorado Convention Center', 39.7428, -104.9969, '2026-12-30', 2, 'https://decadencenye.com', 'mixed'),
  e('Decadence Arizona', 'Phoenix, AZ', 'Phoenix area, venue on the official site', 33.4484, -112.074, '2026-12-30', 2, 'https://decadencearizona.com', 'mixed'),
  e('Lights All Night', 'Dallas, TX', 'Fair Park', 32.7795, -96.7597, '2026-12-30', 2, 'https://lightsallnight.com', 'mixed'),
  e('Countdown NYE', 'San Bernardino, CA', 'NOS Event Center', 34.1083, -117.2898, '2026-12-31', 2, 'https://countdownnye.com', 'mixed'),
  e('Zamna Tulum', 'Tulum, Mexico', 'Zamna, in the jungle', 20.2114, -87.4654, '2026-12-31', 11, 'https://zamnafestival.com', 'house', { note: 'A season of separate nights. Each night has its own ticket.' }),
  // 2027
  e('Day Zero Tulum', 'Tulum, Mexico', 'In the jungle outside Tulum', 20.2114, -87.4654, '2027-01-09', 1, 'https://dayzerofestival.com', 'house'),
  e('Igloofest', 'Montréal, QC', 'Jacques-Cartier Pier, Old Port', 45.5075, -73.5513, '2027-01-14', 24, 'https://igloofest.ca', 'mixed', { note: 'Thursday to Saturday nights over four weekends.' }),
  e('Groove Cruise Miami', 'Miami, FL', 'PortMiami, on Allure of the Seas', 25.7781, -80.1794, '2027-01-21', 5, 'https://www.groovecruise.com', 'house'),
  e('Gem & Jam', 'Tucson, AZ', 'Pima County Fairgrounds', 32.0467, -110.7957, '2027-02-05', 3, 'https://gemandjam.com', 'bass'),
  e('Bahidorá', 'Tlaltizapán, Mexico', 'Las Estacas', 18.7356, -99.1124, '2027-02-12', 3, 'https://bahidora.com', 'mixed'),
  e('EDC México', 'Mexico City, Mexico', 'Autódromo Hermanos Rodríguez', 19.4042, -99.0907, '2027-02-19', 3, 'https://mexico.edc.com', 'mixed'),
  e('Sunset On The River', 'Tampa, FL', 'Julian B. Lane Riverfront Park', 27.9533, -82.4664, '2027-02-20', 2, 'https://sunsetotr.com', 'mixed'),
  e('CRSSD Festival', 'San Diego, CA', 'Waterfront Park', 32.7215, -117.1725, '2027-03-13', 2, 'https://www.crssdfest.com', 'house', { note: LISTINGS }),
  e('Ultra Music Festival', 'Miami, FL', 'Bayfront Park', 25.7743, -80.1862, '2027-03-26', 3, 'https://ultramusicfestival.com', 'mixed'),
  e('Beyond Wonderland SoCal', 'San Bernardino, CA', 'NOS Events Center', 34.1083, -117.2898, '2027-03-26', 2, 'https://socal.beyondwonderland.com', 'mixed'),
  e('Breakaway Tampa', 'Tampa, FL', VENUE_SOON, 27.9506, -82.4572, '2027-04-16', 2, BREAKAWAY, 'mixed'),
  e('Forbidden Kingdom', 'Orlando, FL', 'Central Florida Fairgrounds', 28.553, -81.442, '2027-04-23', 3, 'https://www.forbiddenkingdomfestival.com', 'bass'),
  e('Ubbi Dubbi', 'Fort Worth, TX', 'Panther Island Pavilion', 32.7634, -97.3363, '2027-04-23', 2, 'https://ubbidubbifestival.com', 'mixed'),
  e('EDC Las Vegas: Dusk', 'Las Vegas, NV', 'Las Vegas Motor Speedway', 36.2721, -115.0107, '2027-05-14', 3, 'https://lasvegas.edc.com', 'mixed'),
  e('Breakaway Atlanta', 'Atlanta, GA', VENUE_SOON, 33.749, -84.388, '2027-05-14', 2, BREAKAWAY, 'mixed'),
  e('EDC Las Vegas: Dawn', 'Las Vegas, NV', 'Las Vegas Motor Speedway', 36.2721, -115.0107, '2027-05-21', 3, 'https://lasvegas.edc.com', 'mixed'),
  e('Lightning in a Bottle', 'Bakersfield, CA', 'Buena Vista Aquatic Recreation Area', 35.1814, -119.3197, '2027-05-26', 5, 'https://www.libfestival.org', 'house'),
  e('Breakaway Ohio', 'Columbus, OH', VENUE_SOON, 39.9612, -82.9988, '2027-05-28', 2, BREAKAWAY, 'mixed'),
  e('Movement Detroit', 'Detroit, MI', 'Hart Plaza', 42.3282, -83.0446, '2027-05-29', 3, 'https://movementfestival.com', 'house'),
  e('Beyond Wonderland Midwest', 'Joliet, IL', 'Chicagoland Speedway', 41.4767, -88.0553, '2027-06-11', 3, 'https://midwest.beyondwonderland.com', 'mixed'),
  e('Breakaway Minnesota', 'St. Paul, MN', VENUE_SOON, 44.9537, -93.09, '2027-06-25', 2, BREAKAWAY, 'mixed'),
  e('Beyond Wonderland at The Gorge', 'George, WA', 'The Gorge Amphitheatre', 47.1013, -119.9952, '2027-06-25', 3, 'https://www.beyondwonderland.com', 'mixed', { note: LISTINGS }),
  e('Bass Coast', 'Merritt, BC', 'Nicola Valley', 50.1113, -120.7862, '2027-07-09', 4, 'https://basscoast.ca', 'bass'),
  e('Lost In Dreams', 'Los Angeles, CA', 'LA State Historic Park', 34.0663, -118.2306, '2027-07-10', 2, 'https://www.lostindreamsfestival.com', 'bass'),
  e('Shambhala', 'Salmo, BC', 'Salmo River Ranch', 49.1934, -117.2756, '2027-07-23', 4, 'https://shambhalamusicfestival.com', 'bass'),
  e('Breakaway Michigan', 'Grand Rapids, MI', VENUE_SOON, 42.9634, -85.6681, '2027-08-13', 2, BREAKAWAY, 'mixed'),
  e('Breakaway Mass', 'Worcester, MA', VENUE_SOON, 42.2626, -71.8023, '2027-08-20', 2, BREAKAWAY, 'mixed'),
  e('Breakaway Carolina', 'Charlotte, NC', VENUE_SOON, 35.2271, -80.8431, '2027-09-24', 2, BREAKAWAY, 'mixed'),
  e('Breakaway Utah', 'Salt Lake City, UT', VENUE_SOON, 40.7608, -111.891, '2027-10-08', 2, BREAKAWAY, 'mixed'),
  e('Escape Halloween', 'San Bernardino, CA', 'NOS Event Center', 34.1083, -117.2898, '2027-10-29', 2, 'https://escapehalloween.com', 'mixed'),
  e('EDC Orlando', 'Orlando, FL', 'Tinker Field', 28.54, -81.4036, '2027-11-05', 3, 'https://orlando.edc.com', 'mixed'),
  // Every year, dates not announced yet: listed under the month they usually happen
  tba('Electric Forest', 'Rothbury, MI', 'Double JJ Resort', 43.5095, -86.3437, '2027-06', 'https://www.electricforestfestival.com', 'mixed'),
  tba('VELD', 'Toronto, ON', 'Downsview Park', 43.7417, -79.4782, '2027-07', 'https://veldmusicfestival.com', 'mixed'),
  tba('HARD Summer', 'Inglewood, CA', 'Hollywood Park', 33.9535, -118.3392, '2027-08', 'https://www.hardsummer.com', 'house'),
  tba('Elements Music & Arts', 'Long Pond, PA', 'Pocono Raceway area', 41.0566, -75.5063, '2027-08', 'https://www.elementsfest.us', 'house'),
  tba('îLESONIQ', 'Montréal, QC', 'Parc Jean-Drapeau', 45.5088, -73.5297, '2027-08', 'https://ilesoniq.com', 'mixed'),
  tba('Splash House', 'Palm Springs, CA', 'Hotels across Palm Springs', 33.8303, -116.5453, '2027-08', 'https://splashhouse.com', 'house'),
  tba('Bass Canyon', 'George, WA', 'The Gorge Amphitheatre', 47.1013, -119.9952, '2027-08', 'https://www.basscanyon.com', 'bass'),
  tba('ARC Music Festival', 'Chicago, IL', 'Union Park', 41.8846, -87.6653, '2027-09', 'https://arcmusicfestival.com', 'house'),
  tba('Global Dance Festival', 'Denver, CO', 'Denver area, venue on the official site', 39.739, -104.99, '2027-09', 'https://globaldancefestival.com', 'mixed'),
  tba('Lost Lands', 'Thornville, OH', 'Legend Valley', 39.8939, -82.4335, '2027-09', 'https://lostlandsfestival.com', 'bass'),
  tba('Nocturnal Wonderland', 'San Bernardino, CA', 'Glen Helen Regional Park', 34.2111, -117.4071, '2027-09', 'https://www.nocturnalwonderland.com', 'mixed'),
  tba('Portola', 'San Francisco, CA', 'Pier 80', 37.7525, -122.3812, '2027-09', 'https://www.portolamusicfestival.com', 'house'),
  tba('III Points', 'Miami, FL', 'Mana Wynwood', 25.8023, -80.1977, '2027-10', 'https://www.iiipoints.com', 'house'),
  tba('Freaky Deaky', 'Austin, TX', 'Travis County Exposition Center', 30.3297, -97.6153, '2027-10', 'https://freakydeaky.com', 'mixed'),
  tba('Suwannee Hulaween', 'Live Oak, FL', 'Spirit of the Suwannee Music Park', 30.3964, -82.9406, '2027-10', 'https://hulaween.com', 'mixed'),
  tba('Dreamstate SoCal', 'Long Beach, CA', 'Queen Mary Waterfront', 33.7529, -118.1897, '2027-11', 'https://socal.dreamstateusa.com', 'trance'),
  tba('Decadence Colorado', 'Denver, CO', 'Colorado Convention Center', 39.7428, -104.9969, '2027-12', 'https://decadencenye.com', 'mixed'),
  tba('Decadence Arizona', 'Phoenix, AZ', 'Phoenix area', 33.4484, -112.074, '2027-12', 'https://decadencearizona.com', 'mixed'),
  tba('Lights All Night', 'Dallas, TX', 'Fair Park', 32.7795, -96.7597, '2027-12', 'https://lightsallnight.com', 'mixed'),
  tba('Countdown NYE', 'San Bernardino, CA', 'NOS Event Center', 34.1083, -117.2898, '2027-12', 'https://countdownnye.com', 'mixed'),
]

/** The last day of an event, as YYYY-MM-DD. */
export function lastDay(ev: { date: string; days: number; tba?: boolean }) {
  const d = new Date(`${ev.date}T12:00:00`)
  if (ev.tba) d.setMonth(d.getMonth() + 1, 0)
  else d.setDate(d.getDate() + ev.days - 1)
  return d.toISOString().slice(0, 10)
}

const words = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
const sameEvent = (a: RaveEvent, b: RaveEvent) => {
  const close = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) <= 3 * 86400000
  const wa = words(a.name), wb = words(b.name)
  return close && wa.some((w) => wb.includes(w)) && milesBetween(a, b) < 60
}

/** The hand-checked list, plus whatever EDMTrain has when the server holds a key. Our own entries win on a match. */
/** Each event gets its own wristband color, the way a festival picks a new one every year. */
const BANDS = ['#ff2e93', '#ffd93d', '#8fb4ff', '#7de8c0', '#c3a8ff', '#ff9d4d']
const PRINTS = ['chevron', 'check', 'stripe', 'dots', 'diamond', 'scales'] as const
const hashId = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
export const bandColor = (id: string) => BANDS[hashId(id) % BANDS.length]
/** The woven print on the band. Picked apart from the color, so two pink bands still look different. */
export const bandPrint = (id: string) => PRINTS[Math.floor(hashId(id) / BANDS.length) % PRINTS.length]

export async function loadEvents(): Promise<RaveEvent[]> {
  let extra: RaveEvent[] = []
  try {
    const res = await fetch('/api/events')
    if (res.ok) extra = ((await res.json()) as { events?: RaveEvent[] }).events ?? []
  } catch {
    /* offline or no feed: the checked list still works */
  }
  return [...EVENTS, ...extra.filter((x) => !EVENTS.some((own) => sameEvent(own, x)))]
}

/** Straight-line distance in miles. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 3959 * 2 * Math.asin(Math.sqrt(h))
}

export function dateParts(iso: string, days: number, tba = false) {
  const start = new Date(`${iso}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + days - 1)
  const month = start.toLocaleDateString('en-US', { month: 'short' })
  const full = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const range = tba
    ? `Dates not announced · usually ${start.toLocaleDateString('en-US', { month: 'long' })}`
    : days > 1 ? `${full} to ${end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : full
  const away = Math.round((start.getTime() - Date.now()) / 86400000)
  return { month, day: start.getDate(), range, away }
}
