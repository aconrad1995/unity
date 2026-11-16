// Events portal data. The events below are made-up samples so the screen can be tried out.
// To go live, replace loadEvents() with a call to a real feed (for example EDMTrain or Ticketmaster).

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
  /** expected crowd; this is what "biggest" sorts by */
  crowd: number
  sounds: string[]
  sample: boolean
}

const city = (name: string) => CITIES.find((c) => c.name === name)!
const inDays = (n: number) => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

let n = 0
const e = (name: string, where: string, place: string, days: number, length: number, crowd: number, sounds: string[]): RaveEvent => {
  const c = city(where)
  return { id: `sample-event-${++n}`, name, city: where, place, lat: c.lat, lng: c.lng, date: inDays(days), days: length, crowd, sounds, sample: true }
}

const SAMPLE_EVENTS: RaveEvent[] = [
  e('Cotton Candy Skies', 'Los Angeles, CA', 'Outdoor fairground', 12, 2, 45000, ['House', 'Bass']),
  e('Bubble Bass Bash', 'Los Angeles, CA', 'Warehouse district', 26, 1, 6000, ['Dubstep', 'Drum & bass']),
  e('Sparkle Harbor', 'San Diego, CA', 'Waterfront park', 33, 2, 28000, ['House', 'Techno']),
  e('Starlight Carousel', 'Las Vegas, NV', 'Speedway grounds', 47, 3, 90000, ['Everything']),
  e('Moonbeam Meadow', 'San Francisco, CA', 'City park', 19, 2, 35000, ['House', 'Disco']),
  e('Pastel Planet', 'Phoenix, AZ', 'Desert park', 40, 2, 22000, ['Trance', 'House']),
  e('Dreamcloud Nights', 'Seattle, WA', 'Indoor arena', 54, 1, 12000, ['Bass', 'Trap']),
  e('Halo Fields', 'Denver, CO', 'Open-air amphitheatre', 22, 2, 18000, ['Bass', 'Dubstep']),
  e('Sugar Rush Sound Fest', 'Dallas, TX', 'Fair park', 61, 2, 30000, ['House', 'Hardstyle']),
  e('Twinkle Town', 'Austin, TX', 'Lakeside grounds', 30, 1, 9000, ['Techno']),
  e('Glitterwave Weekend', 'Miami, FL', 'Bayfront park', 16, 3, 70000, ['House', 'Techno', 'Trance']),
  e('Candy Comet', 'Orlando, FL', 'Stadium grounds', 75, 2, 55000, ['Everything']),
  e('Prism Parade', 'Chicago, IL', 'Lakefront park', 36, 3, 60000, ['House', 'Bass']),
  e('Lullabass', 'Detroit, MI', 'Riverfront plaza', 50, 2, 25000, ['Techno', 'House']),
  e('Neon Lullaby', 'New York, NY', 'Island park', 9, 2, 50000, ['House', 'Techno']),
  e('Confetti Coast', 'Boston, MA', 'Harbor pavilion', 44, 1, 8000, ['Trance']),
  e('Peach Fizz Festival', 'Atlanta, GA', 'Raceway grounds', 28, 3, 65000, ['Bass', 'House']),
  e('Capitol Glow', 'Washington, DC', 'Stadium lots', 58, 2, 32000, ['House', 'Drum & bass']),
]

export async function loadEvents(): Promise<RaveEvent[]> {
  return SAMPLE_EVENTS
}

/** Straight-line distance in miles. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 3959 * 2 * Math.asin(Math.sqrt(h))
}

export function sizeLabel(crowd: number): string {
  if (crowd >= 50000) return 'Huge'
  if (crowd >= 20000) return 'Big'
  if (crowd >= 8000) return 'Medium'
  return 'Small'
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
