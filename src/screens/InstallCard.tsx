import { useEffect, useState } from 'react'

/* "Put Unity on your home screen". Android and desktop Chrome can install with one tap.
   iPhone Safari can't be asked from a page, so it gets the two steps instead. */
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let saved: InstallEvent | null = null
const listeners = new Set<() => void>()
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  saved = e as InstallEvent
  listeners.forEach((f) => f())
})

const HIDE_KEY = 'unity.install.hidden.v1'
const installed = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const isIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)

export function InstallCard() {
  const [canPrompt, setCanPrompt] = useState(!!saved)
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false }
  })
  useEffect(() => {
    const f = () => setCanPrompt(!!saved)
    listeners.add(f)
    return () => { listeners.delete(f) }
  }, [])

  if (installed() || hidden || (!canPrompt && !isIphone())) return null

  const hide = () => {
    try { localStorage.setItem(HIDE_KEY, '1') } catch { /* fine */ }
    setHidden(true)
  }
  const install = async () => {
    if (!saved) return
    await saved.prompt()
    const { outcome } = await saved.userChoice
    saved = null
    setCanPrompt(false)
    if (outcome === 'accepted') hide()
  }

  return (
    <section className="install-card" aria-labelledby="install-h">
      <img src="/icon-192.png" alt="" width={56} height={56} />
      <div>
        <h2 id="install-h">Put Unity on your home screen</h2>
        {canPrompt ? (
          <p>It opens like an app, and your countdown is one tap away.</p>
        ) : (
          <p>In Safari, tap Share, then Add to Home Screen. The home screen app keeps its own login, so copy your move code below to bring your listings with you.</p>
        )}
        <div className="event-actions">
          {canPrompt && <button type="button" className="btn" onClick={install}>Add to home screen</button>}
          <button type="button" className="btn btn-soft" onClick={hide}>Not now</button>
        </div>
      </div>
    </section>
  )
}
