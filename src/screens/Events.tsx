import { useEffect, useMemo, useState } from 'react'
import { CheckIcon, PinIcon } from '../art'
import { CITIES, EVENTS_CHECKED, bandColor, dateParts, loadEvents, milesBetween, type RaveEvent } from '../events'
import { PageHeader } from './PageHeader'

interface Spot { label: string; lat: number; lng: number }
const SPOT_KEY = 'unity.spot.v1'
const GOING_KEY = 'unity.going.v1'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* remembering the choice is optional */
  }
}

export default function Events() {
  const [events, setEvents] = useState<RaveEvent[] | null>(null)
  const [spot, setSpot] = useState<Spot | null>(() => load<Spot | null>(SPOT_KEY, null))
  const [going, setGoing] = useState<string[]>(() => load<string[]>(GOING_KEY, []))
  const [radius, setRadius] = useState(150)
  const [locating, setLocating] = useState(false)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    loadEvents().then(setEvents)
  }, [])
  useEffect(() => save(SPOT_KEY, spot), [spot])
  useEffect(() => save(GOING_KEY, going), [going])

  function useMyLocation() {
    setProblem('')
    if (!('geolocation' in navigator)) {
      setProblem('This device can’t share its location. Pick your city instead.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setSpot({ label: 'your location', lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setLocating(false)
        setProblem('We couldn’t get your location. Check that location is allowed, or pick your city instead.')
      },
      { timeout: 10000, maximumAge: 600000 },
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const list = useMemo(() => {
    const upcoming = (events ?? [])
      .filter((ev) => ev.date >= today)
      .map((ev) => ({ ev, miles: spot ? milesBetween(spot, ev) : null }))
    const near = spot && radius > 0 ? upcoming.filter((x) => x.miles !== null && x.miles <= radius) : upcoming
    return near.sort((a, b) => a.ev.date.localeCompare(b.ev.date))
  }, [events, spot, radius, today])

  const toggleGoing = (id: string) => setGoing((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const [next, ...rest] = list
  const months = useMemo(() => {
    const groups: { label: string; items: typeof list }[] = []
    for (const item of rest) {
      const label = new Date(`${item.ev.date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const last = groups[groups.length - 1]
      if (last && last.label === label) last.items.push(item)
      else groups.push({ label, items: [item] })
    }
    return groups
  }, [rest])

  const renderEvent = ({ ev, miles }: { ev: RaveEvent; miles: number | null }, feature = false) => {
    const d = dateParts(ev.date, ev.days)
    const isGoing = going.includes(ev.id)
    return (
      <li key={ev.id} className={feature ? 'event event-feature' : 'event'} style={{ ['--band' as string]: bandColor(ev.id) }}>
        {feature && <div className="event-band" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i}>{ev.name} / {d.range} /</span>)}</div>}
        <div className="event-date" aria-hidden="true">
          <span>{d.month}</span>
          <strong>{String(d.day).padStart(2, '0')}</strong>
          {ev.days > 1 && <small>{ev.days} days</small>}
        </div>
        <div className="event-main">
          {feature && <p className="event-kicker">Next up · {d.away <= 0 ? 'today' : d.away === 1 ? 'tomorrow' : `in ${d.away} days`}</p>}
          <h3>{ev.name}</h3>
          <p className="event-when">{d.range}{!feature && <span className="event-away"> · {d.away <= 0 ? 'today' : d.away === 1 ? 'tomorrow' : `in ${d.away} days`}</span>}</p>
          <p className="event-where">
            {ev.place}, {ev.city}
            {miles !== null && <> · <strong>{miles < 1 ? 'in town' : `${Math.round(miles)} miles away`}</strong></>}
          </p>
          {ev.note && <p className="event-note">{ev.note}</p>}
          {ev.via && <p className="event-note">Listing from {ev.via}</p>}
          <div className="event-actions">
            <a className="btn" href={ev.url} target="_blank" rel="noopener noreferrer">Dates and tickets</a>
            <button type="button" className={`btn btn-soft going${isGoing ? ' is-going' : ''}`} aria-pressed={isGoing} onClick={() => toggleGoing(ev.id)}>
              {isGoing && <CheckIcon />} {isGoing ? 'I’m going' : 'Mark as going'}
            </button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <>
      <PageHeader title="Events" noBack />
      <main className="page events-page">
        <section className="where" aria-labelledby="where-h">
          <h2 id="where-h" className="row-h">
            {spot ? <>Near <strong>{spot.label}</strong></> : 'Where are you?'}
          </h2>
          <div className="where-row">
            <button type="button" className="btn" onClick={useMyLocation} disabled={locating}>
              <PinIcon /> {locating ? 'Finding you…' : 'Use my location'}
            </button>
            <label className="field-inline where-city">
              <span>Or pick your city</span>
              <select
                value={spot && spot.label !== 'your location' ? spot.label : ''}
                onChange={(e) => {
                  const c = CITIES.find((x) => x.name === e.target.value)
                  setProblem('')
                  setSpot(c ? { label: c.name, lat: c.lat, lng: c.lng } : null)
                }}
              >
                <option value="">Choose a city</option>
                {CITIES.map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label className="field-inline">
              <span>How far</span>
              <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} disabled={!spot}>
                <option value={50}>50 miles</option>
                <option value={150}>150 miles</option>
                <option value={500}>500 miles</option>
                <option value={0}>Anywhere</option>
              </select>
            </label>
          </div>
          {problem && <p className="error" role="alert">{problem}</p>}
        </section>

        <div className="results-bar" aria-live="polite">
          <p>
            {events === null ? 'Loading events…' : `${list.length} ${list.length === 1 ? 'event' : 'events'}${spot && radius > 0 ? ` within ${radius} miles` : spot ? '' : ' everywhere'}`}
          </p>
        </div>

        {events !== null && list.length === 0 && (
          <div className="empty">
            <h2>No events that close yet</h2>
            <p>Nothing is coming up within {radius} miles of {spot?.label}. Try looking further out.</p>
            <button type="button" className="btn" onClick={() => setRadius(0)}>Show events anywhere</button>
          </div>
        )}

        {next && <ul className="events events-lead">{renderEvent(next, true)}</ul>}

        {months.map((m) => (
          <section key={m.label} className="month" aria-label={m.label}>
            <h2 className="month-h">{m.label}</h2>
            <ul className="events">{m.items.map((x) => renderEvent(x))}</ul>
          </section>
        ))}

        <p className="fineprint">
          Dates checked {EVENTS_CHECKED} against each festival’s announcements. They can change, so confirm on the festival’s own page before you buy.
          Your location stays on this device.
        </p>
      </main>
    </>
  )
}
