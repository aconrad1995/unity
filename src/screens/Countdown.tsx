import { bandColor, bandPrint, dateParts } from '../events'
import { daysUntil, useGoing } from '../going'

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
  const d = dateParts(ev.date, ev.days)
  const big = left > 0 ? String(left) : 'Now'
  const unit = left === 1 ? 'day to go' : left > 1 ? 'days to go' : left === 0 ? 'Today' : 'On now'
  const more = next.length - 1
  const label = left > 0 ? `${ev.name} in ${left} ${left === 1 ? 'day' : 'days'}` : `${ev.name} is on now`

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
