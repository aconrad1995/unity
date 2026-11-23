import { useEffect, useMemo, useState } from 'react'
import { CheckIcon, PinIcon, SearchIcon } from '../art'
import { CITIES, EVENTS_CHECKED, GENRES, bandColor, bandPrint, dateParts, lastDay, loadEvents, milesBetween, type Genre, type RaveEvent } from '../events'
import { goingLabel, useGoing, useGoingCounts } from '../going'
import { PageHeader } from './PageHeader'

interface Spot { label: string; lat: number; lng: number }
const SPOT_KEY = 'unity.spot.v1'

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
  const going = useGoing()
  const counts = useGoingCounts()
  const [radius, setRadius] = useState(150)
  const [genre, setGenre] = useState<Genre | ''>('')
  const [query, setQuery] = useState('')
  const [locating, setLocating] = useState(false)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    loadEvents().then(setEvents)
  }, [])
  useEffect(() => save(SPOT_KEY, spot), [spot])

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
      .filter((ev) => lastDay(ev) >= today)
      .map((ev) => ({ ev, miles: spot ? milesBetween(spot, ev) : null }))
    const near = spot && radius > 0 ? upcoming.filter((x) => x.miles !== null && x.miles <= radius) : upcoming
    const q = query.trim().toLowerCase()
    return near
      .filter((x) => !genre || x.ev.genre === genre)
      .filter((x) => !q || `${x.ev.name} ${x.ev.city} ${x.ev.place}`.toLowerCase().includes(q))
      .sort((a, b) => a.ev.date.localeCompare(b.ev.date) || Number(!!a.ev.tba) - Number(!!b.ev.tba))
  }, [events, spot, radius, today, genre, query])

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
    const d = dateParts(ev.date, ev.days, ev.tba)
    const isGoing = going.isGoing(ev.id)
    const away = ev.tba ? 'dates soon' : d.away <= 0 ? 'today' : d.away === 1 ? 'tomorrow' : `in ${d.away} days`
    return (
      <li key={ev.id} className={feature ? 'event event-feature' : 'event'} data-print={bandPrint(ev.id)} style={{ ['--band' as string]: bandColor(ev.id) }}>
        {feature && <div className="event-band" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i}>{ev.name} / {d.range} /</span>)}</div>}
        <div className="event-date" aria-hidden="true">
          <div>
            <span>{d.month}</span>
            <strong>{ev.tba ? 'TBA' : String(d.day).padStart(2, '0')}</strong>
            {ev.days > 1 && <small>{ev.days} days</small>}
          </div>
        </div>
        <div className="event-main">
          {feature && <p className="event-kicker">Next up · {away}</p>}
          <h3>{ev.name}</h3>
          <p className="event-when">{d.range}{!feature && !ev.tba && <span className="event-away"> · {away}</span>}</p>
          <p className="event-where">
            {ev.place}, {ev.city}
            {miles !== null && <> · <strong>{miles < 1 ? 'in town' : `${Math.round(miles)} miles away`}</strong></>}
          </p>
          {goingLabel(counts[ev.id], isGoing) && <p className="event-crowd">{goingLabel(counts[ev.id], isGoing)}</p>}
          {ev.note && <p className="event-note">{ev.note}</p>}
          {ev.via && <p className="event-note">Listing from {ev.via}</p>}
          <div className="event-actions">
            <a className="btn" href={ev.url} target="_blank" rel="noopener noreferrer">{ev.tba ? 'Official site' : 'Dates and tickets'}</a>
            <button type="button" className={`btn btn-soft going${isGoing ? ' is-going' : ''}`} aria-pressed={isGoing} onClick={() => going.toggle(ev)}>
              {isGoing && <CheckIcon />} {isGoing ? 'I’m going' : 'Mark as going'}
            </button>
          </div>
          {!ev.tba && !ev.via && d.away > 6 && <a className="link-btn event-shop" href={`#/shop-for/${encodeURIComponent(ev.id)}`}>Find a fit that arrives in time</a>}
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
            <button type="button" className="btn btn-soft" onClick={useMyLocation} disabled={locating}>
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

        <section className="event-filters" aria-label="Filter events">
          <label className="search">
            <span className="sr-only">Search festivals</span>
            <SearchIcon />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a festival or city" />
          </label>
          <div className="bubbles" role="group" aria-label="Sound">
            <button type="button" className="bubble" aria-pressed={!genre} onClick={() => setGenre('')}>All sounds</button>
            {GENRES.map((g) => (
              <button key={g.id} type="button" className="bubble" aria-pressed={genre === g.id} onClick={() => setGenre(genre === g.id ? '' : g.id)}>{g.label}</button>
            ))}
          </div>
        </section>

        <div className="results-bar" aria-live="polite">
          <p>
            {events === null ? 'Loading events…' : `${list.length} ${list.length === 1 ? 'event' : 'events'}${spot && radius > 0 ? ` within ${radius} miles` : spot ? '' : ' everywhere'}`}
          </p>
        </div>

        {events !== null && list.length === 0 && (
          <div className="empty">
            <h2>{genre || query ? 'No festivals match' : 'No events that close yet'}</h2>
            <p>{genre || query ? 'Try another sound or search, or look further out.' : `Nothing is coming up within ${radius} miles of ${spot?.label}. Try looking further out.`}</p>
            <button type="button" className="btn" onClick={() => { setRadius(0); setGenre(''); setQuery('') }}>Show every festival</button>
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
          Electronic festivals in the US, Canada and Mexico. Dates checked {EVENTS_CHECKED} against each festival’s announcements. Ones marked “dates not announced” are listed under the month they usually happen. Dates can change, so confirm on the festival’s own page before you buy.
          Your location stays on this device.
        </p>
      </main>
    </>
  )
}
