import { useState } from 'react'

type Mode = 'auto' | 'light' | 'dark'
const KEY = 'unity.theme.v1'

function read(): Mode {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

/** Light by day, dark at night. "Auto" follows the device, which usually switches with the sun. */
export function Appearance() {
  const [mode, setMode] = useState<Mode>(read)
  const choose = (m: Mode) => {
    setMode(m)
    try {
      if (m === 'auto') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, m)
    } catch {
      /* the choice only lasts for this visit */
    }
    if (m === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', m)
  }
  return (
    <section className="step" aria-labelledby="look-h">
      <h2 id="look-h" className="section-h section-h-in">Appearance</h2>
      <p className="hint">Auto follows your device, so it goes dark when your phone does.</p>
      <div className="appearance" role="group" aria-label="Appearance">
        {(['auto', 'light', 'dark'] as const).map((m) => (
          <button key={m} type="button" className="bubble" aria-pressed={mode === m} onClick={() => choose(m)}>
            {m === 'auto' ? 'Auto' : m === 'light' ? 'Light' : 'Dark'}
          </button>
        ))}
      </div>
    </section>
  )
}
