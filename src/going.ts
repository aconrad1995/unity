import { useEffect, useState } from 'react'
import { lastDay, type RaveEvent } from './events'

/** Festivals this person marked "I'm going". Kept on this device, with enough detail to count down
    even if the event later drops out of the list (an EDMTrain listing that changes, say). */
export type GoingEvent = Pick<RaveEvent, 'id' | 'name' | 'city' | 'date' | 'days' | 'url' | 'tba'>

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

/** "Tahoe Live 2026": how a festival is named on a listing worn there. */
export const wornLabel = (ev: Pick<GoingEvent, 'name' | 'date'>) => `${ev.name} ${ev.date.slice(0, 4)}`

/* Festivals someone has been back from: after a marked event ends, Unity asks once whether
   they want to list what they wore. Answered ones (listed or "not now") are remembered here. */
const BACK_KEY = 'unity.backfrom.v1'
const BACK_DAYS = 21
function readBack(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(BACK_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
export function answerBackFrom(id: string) {
  try {
    localStorage.setItem(BACK_KEY, JSON.stringify([...new Set([...readBack(), id])].slice(-50)))
  } catch {
    /* asking again is harmless */
  }
  window.dispatchEvent(new Event(CHANGED))
}

/** Marked festivals that ended in the last three weeks, newest first. */
export const pastGoing = (list: GoingEvent[]) =>
  list.filter((x) => { if (x.tba) return false; const end = lastDay(x); return end < today() && -daysUntil(end) <= BACK_DAYS }).sort((a, b) => b.date.localeCompare(a.date))

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
      : [...cur, { id: ev.id, name: ev.name, city: ev.city, date: ev.date, days: ev.days, url: ev.url, ...(ev.tba ? { tba: true } : {}) }])
  }
  const answered = readBack()
  const backFrom = pastGoing(list).find((x) => !answered.includes(x.id))
  const next = upcoming(list)
  /** The next one with real dates, for anything that needs a day, like "arrives before". */
  const nextDated = next.find((x) => !x.tba)
  return { list, next, nextDated, past: pastGoing(list), backFrom, isGoing, toggle }
}
