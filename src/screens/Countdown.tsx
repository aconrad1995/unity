import { bandColor, bandPrint, dateParts } from '../events'
import { answerBackFrom, daysUntil, useGoing } from '../going'

/** Your next festival as a band-stub ticket, counting down. Shows nothing until you mark one, unless `prompt` is set. */
export function Countdown({ prompt = false }: { prompt?: boolean }) {
  const { next } = useGoing()
  const ev = next[0]

  if (!ev) {
    if (!prompt) return null
    return (
      <div className="countdown-empty">
        <p>Going to a festival? Mark it on Events and it counts down here.</p>
        <a className="btn btn-soft" href="#/events">Find your next one</a>
      </div>
    )
  }

  const left = daysUntil(ev.date)
  const d = dateParts(ev.date, ev.days, ev.tba)
  const big = ev.tba ? d.month : left > 0 ? String(left) : 'Now'
  const unit = ev.tba ? 'dates soon' : left === 1 ? 'day to go' : left > 1 ? 'days to go' : left === 0 ? 'Today' : 'On now'
  const more = next.length - 1
  const label = ev.tba ? `${ev.name}, dates not announced yet` : left > 0 ? `${ev.name} in ${left} ${left === 1 ? 'day' : 'days'}` : `${ev.name} is on now`

  return (
    <a className="countdown" href="#/events" data-print={bandPrint(ev.id)} style={{ ['--band' as string]: bandColor(ev.id) }} aria-label={`Your next festival: ${label}`}>
      <div className="event-date" aria-hidden="true">
        <div>
          <strong>{big}</strong>
          <small>{unit}</small>
        </div>
      </div>
      <div className="countdown-main">
        <p className="event-kicker">Your next festival</p>
        <h2>{ev.name}</h2>
        <p className="countdown-when">{d.range}</p>
        <p>{ev.city}{more > 0 && <span className="countdown-more"> · {more} more on your list</span>}</p>
      </div>
    </a>
  )
}

/** Shown once after a marked festival ends: list what you wore while the photos are fresh. */
export function BackFrom() {
  const { backFrom: ev } = useGoing()
  if (!ev) return null
  const d = dateParts(ev.date, ev.days)
  return (
    <section className="countdown back-from" data-print={bandPrint(ev.id)} style={{ ['--band' as string]: bandColor(ev.id) }} aria-labelledby="back-from-h">
      <div className="event-date" aria-hidden="true">
        <div>
          <span>{d.month}</span>
          <strong>{String(d.day).padStart(2, '0')}</strong>
          {ev.days > 1 && <small>{ev.days} days</small>}
        </div>
      </div>
      <div className="countdown-main">
        <p className="event-kicker">How was it?</p>
        <h2 id="back-from-h">{ev.name}</h2>
        <p>Sell what you wore while it’s still fresh. We’ll tag it as worn there.</p>
        <div className="event-actions">
          <a className="btn" href={`#/sell/worn/${encodeURIComponent(ev.id)}`}>List my outfit</a>
          <button type="button" className="btn btn-soft" onClick={() => answerBackFrom(ev.id)}>Not now</button>
        </div>
      </div>
    </section>
  )
}
