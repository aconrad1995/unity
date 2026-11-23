// Events portal data: real festivals, added by hand with a source link for each.
// To go live with more, replace loadEvents() with a call to a real feed (for example EDMTrain or Ticketmaster).

export interface City { name: string; lat: number; lng: number }

export const CITIES: City[] = [
  { name: 'Atlanta, GA', lat: 33.749, lng: -84.388 },
  { name: 'Austin, TX', lat: 30.267, lng: -97.743 },
  { name: 'Boston, MA', lat: 42.36, lng: -71.059 },
  { name: 'Chicago, IL', lat: 41.878, lng: -87.63 },
  { name: 'Dallas, TX', lat: 32.777, lng: -96.797 },
  { name: 'Denver, CO', lat: 39.739, lng: -104.99 },
  { name: 'Detroit, MI', lat: 42.331, lng: -83.046 },
  { name: 'Houston, TX', lat: 29.76, lng: -95.37 },
  { name: 'Las Vegas, NV', lat: 36.17, lng: -115.14 },
  { name: 'Los Angeles, CA', lat: 34.052, lng: -118.244 },
  { name: 'Miami, FL', lat: 25.762, lng: -80.192 },
  { name: 'New York, NY', lat: 40.713, lng: -74.006 },
  { name: 'Orlando, FL', lat: 28.538, lng: -81.379 },
  { name: 'Phoenix, AZ', lat: 33.448, lng: -112.074 },
  { name: 'San Diego, CA', lat: 32.716, lng: -117.161 },
  { name: 'San Francisco, CA', lat: 37.775, lng: -122.419 },
  { name: 'Seattle, WA', lat: 47.606, lng: -122.332 },
  { name: 'Washington, DC', lat: 38.907, lng: -77.037 },
]

export interface RaveEvent {
  id: string
  name: string
  city: string
  place: string
  lat: number
  lng: number
  /** ISO date of the first day */
  date: string
  days: number
  /** The festival's own website, where the button sends people. Dates were checked against it or a press release. */
  url: string
  /** Shown on the card when the dates are not yet on an official page. */
  note?: string
  /** Set on events pulled from EDMTrain. */
  via?: 'EDMTrain'
}

let n = 0
const e = (name: string, city: string, place: string, lat: number, lng: number, date: string, days: number, url: string, note?: string): RaveEvent => ({
  id: `event-${++n}`, name, city, place, lat, lng, date, days, url, note,
})

/** Real festivals with dates announced as of 22 Nov 2026. Add new ones here; keep the source link. */
export const EVENTS_CHECKED = '22 Nov 2026'
const EVENTS: RaveEvent[] = [
  e('Decadence Colorado', 'Denver, CO', 'Colorado Convention Center', 39.7428, -104.9969, '2026-12-30', 2, 'https://decadencenye.com'),
  e('Forbidden Kingdom', 'Orlando, FL', 'Central Florida Fairgrounds', 28.553, -81.442, '2027-04-23', 3, 'https://www.forbiddenkingdomfestival.com'),
  e('EDC Orlando', 'Orlando, FL', 'Tinker Field', 28.54, -81.4036, '2027-11-05', 3, 'https://orlando.edc.com'),
  e('Tahoe Live', 'Olympic Valley, CA', 'Palisades Tahoe', 39.1969, -120.2358, '2026-12-11', 3, 'https://tahoelive.net'),
  e('Countdown NYE', 'San Bernardino, CA', 'NOS Event Center', 34.1083, -117.2898, '2026-12-31', 2, 'https://countdownnye.com'),
  e('Ultra Music Festival', 'Miami, FL', 'Bayfront Park', 25.7743, -80.1862, '2027-03-26', 3, 'https://ultramusicfestival.com'),
  e('Ubbi Dubbi', 'Fort Worth, TX', 'Panther Island Pavilion', 32.7634, -97.3363, '2027-04-23', 2, 'https://ubbidubbifestival.com'),
  e('EDC Las Vegas: Dusk', 'Las Vegas, NV', 'Las Vegas Motor Speedway', 36.2721, -115.0107, '2027-05-14', 3, 'https://lasvegas.edc.com'),
  e('EDC Las Vegas: Dawn', 'Las Vegas, NV', 'Las Vegas Motor Speedway', 36.2721, -115.0107, '2027-05-21', 3, 'https://lasvegas.edc.com'),
  e('Lightning in a Bottle', 'Bakersfield, CA', 'Buena Vista Aquatic Recreation Area', 35.1814, -119.3197, '2027-05-26', 5, 'https://www.libfestival.org'),
  e('Movement Detroit', 'Detroit, MI', 'Hart Plaza', 42.3282, -83.0446, '2027-05-29', 3, 'https://movementfestival.com', 'Dates come from ticket listings. Check the official site.'),
  e('Beyond Wonderland Midwest', 'Joliet, IL', 'Chicagoland Speedway', 41.4767, -88.0553, '2027-06-11', 3, 'https://midwest.beyondwonderland.com'),
  e('Escape Halloween', 'San Bernardino, CA', 'NOS Event Center', 34.1083, -117.2898, '2027-10-29', 2, 'https://escapehalloween.com'),
]

const words = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
const sameEvent = (a: RaveEvent, b: RaveEvent) => {
  const close = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) <= 3 * 86400000
  const wa = words(a.name), wb = words(b.name)
  return close && wa.some((w) => wb.includes(w)) && milesBetween(a, b) < 60
}

/** The hand-checked list, plus whatever EDMTrain has when the server holds a key. Our own entries win on a match. */
/** Each event gets its own wristband color, the way a festival picks a new one every year. */
const BANDS = ['#ff2e93', '#ffd93d', '#8fb4ff', '#7de8c0', '#c3a8ff', '#ff9d4d']
export const bandColor = (id: string) => BANDS[[...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % BANDS.length]

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

export function dateParts(iso: string, days: number) {
  const start = new Date(`${iso}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + days - 1)
  const month = start.toLocaleDateString('en-US', { month: 'short' })
  const full = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const range = days > 1 ? `${full} to ${end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : full
  const away = Math.round((start.getTime() - Date.now()) / 86400000)
  return { month, day: start.getDate(), range, away }
}
