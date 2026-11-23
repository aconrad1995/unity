import type { MouseEvent } from 'react'
import { BackIcon } from '../art'

// Counts moves inside the app, so the back arrow returns to wherever you came from
// (Alerts, Saved, a chat) and only falls back to its own address when the page was opened directly.
let moves = 0
window.addEventListener('hashchange', () => { moves++ })

function goBack(e: MouseEvent, back: string) {
  e.preventDefault()
  if (moves > 0) {
    moves -= 2 // going back fires one more hashchange
    window.history.back()
  } else window.location.hash = back
}

export function PageHeader({ title, back = '#/', backLabel = 'Back', noBack = false }: { title: string; back?: string; backLabel?: string; noBack?: boolean }) {
  return (
    <header className="top top-small">
      <div className="top-inner top-row">
        {!noBack && <a href={back} className="back" aria-label={backLabel} onClick={(e) => goBack(e, back)}><BackIcon /></a>}
        <h1 className="top-title">{title}</h1>
        <span className="band-print" aria-hidden="true">{`  /  UNITY  /  ${title}  /  UNITY  /  ${title}`}</span>
      </div>
      <div className="cloud-edge" aria-hidden="true" />
    </header>
  )
}
