import { useEffect, useState } from 'react'
import { lastDay, type RaveEvent } from './events'

/** Festivals this person marked "I'm going". Kept on this device, with enough detail to count down
    even if the event later drops out of the list (an EDMTrain listing that changes, say). */
export type GoingEvent = Pick<RaveEvent, 'id' | 'name' | 'city' | 'date' | 'days' | 'url'>

const KEY = 'unity.going.v2'
const CHANGED = 'unity:going'

function read(): GoingEvent[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as GoingEvent[]) : []
    return Array.isArray(list) ? list.filter((x) => x && typeof x.id === 'string' && typeof x.date === 'string') : []
  } catch {
    return []
  }
}

function write(list: GoingEvent[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* remembering is optional */
  }
  window.dispatchEvent(new Event(CHANGED))
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Events still to come (or happening now), soonest first. */
export const upcoming = (list: GoingEvent[]) => list.filter((x) => lastDay(x) >= today()).sort((a, b) => a.date.localeCompare(b.date))

/** Whole days from today until the event starts; 0 or less once it has begun. */
export function daysUntil(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  const now = new Date()
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
}

export function useGoing() {
  const [list, setList] = useState(read)
  useEffect(() => {
    const sync = () => setList(read())
    window.addEventListener(CHANGED, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  const isGoing = (id: string) => list.some((x) => x.id === id)
  const toggle = (ev: RaveEvent) => {
    const cur = read()
    write(cur.some((x) => x.id === ev.id)
      ? cur.filter((x) => x.id !== ev.id)
      : [...cur, { id: ev.id, name: ev.name, city: ev.city, date: ev.date, days: ev.days, url: ev.url }])
  }
  return { list, next: upcoming(list), isGoing, toggle }
}
