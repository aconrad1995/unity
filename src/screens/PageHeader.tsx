import { useEffect, type MouseEvent } from 'react'
import { BackIcon } from '../art'
import { APP_NAME } from '../data'

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

/** Sets the browser tab's title, which is also what a shared link or a screen reader announces. */
export function usePageTitle(title: string) {
  useEffect(() => { document.title = title ? `${title} · ${APP_NAME}` : `${APP_NAME}: rave outfit resale` }, [title])
}

export function PageHeader({ title, back = '#/', backLabel = 'Back', noBack = false, heading = true, docTitle }: {
  title: string; back?: string; backLabel?: string; noBack?: boolean
  /** false when the page's own h1 sits further down (a listing's name). */
  heading?: boolean
  docTitle?: string
}) {
  usePageTitle(docTitle ?? title)
  const Title = heading ? 'h1' : 'p'
  return (
    <header className="top top-small">
      <div className="top-inner top-row">
        {!noBack && <a href={back} className="back" aria-label={backLabel} onClick={(e) => goBack(e, back)}><BackIcon /></a>}
        <Title className="top-title">{title}</Title>
      </div>
    </header>
  )
}
