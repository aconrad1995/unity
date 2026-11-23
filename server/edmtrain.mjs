// Pulls upcoming festivals from EDMTrain and shapes them like the app's own events.
// Needs EDMTRAIN_KEY (EDMTrain issues API keys on request). Without one, this returns nothing and the app shows its checked list.
// The key stays on the server; the browser only ever calls /api/events.
const TTL = 6 * 60 * 60 * 1000
let cache = { at: 0, events: [] }

const iso = (d) => String(d).slice(0, 10)

export function shape(raw) {
  const v = raw?.venue ?? {}
  if (!raw?.name || !raw?.startDate || typeof v.latitude !== 'number' || typeof v.longitude !== 'number') return null
  const start = new Date(`${iso(raw.startDate)}T12:00:00Z`)
  const end = raw.endDate ? new Date(`${iso(raw.endDate)}T12:00:00Z`) : start
  const days = Math.min(7, Math.max(1, Math.round((end - start) / 86400000) + 1))
  return {
    id: `edmtrain-${raw.id}`,
    name: String(raw.name).slice(0, 80),
    city: String(v.location ?? '').slice(0, 60),
    place: String(v.name ?? '').slice(0, 80),
    lat: v.latitude,
    lng: v.longitude,
    date: iso(raw.startDate),
    days,
    url: typeof raw.link === 'string' && raw.link.startsWith('https://') ? raw.link : 'https://edmtrain.com',
    via: 'EDMTrain',
  }
}

export async function edmtrainEvents(key = process.env.EDMTRAIN_KEY, fetcher = fetch) {
  if (!key) return []
  if (Date.now() - cache.at < TTL) return cache.events
  try {
    const url = new URL('https://edmtrain.com/api/events')
    url.searchParams.set('client', key)
    url.searchParams.set('festivalInd', 'true')
    url.searchParams.set('startDate', new Date().toISOString().slice(0, 10))
    const res = await fetcher(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`EDMTrain answered ${res.status}`)
    const body = await res.json()
    const list = Array.isArray(body?.data) ? body.data : []
    cache = { at: Date.now(), events: list.map(shape).filter(Boolean).slice(0, 300) }
  } catch (err) {
    console.warn('EDMTrain feed unavailable:', err instanceof Error ? err.message : err)
    // Keep serving the last good copy, and wait a short while before asking again.
    cache = { at: Date.now() - TTL + 10 * 60 * 1000, events: cache.events }
  }
  return cache.events
}
