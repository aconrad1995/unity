import { useEffect, useState } from 'react'
import { BellIcon } from '../art'
import { pushState, turnOff, turnOn, type PushState } from '../push'

const COPY: Record<PushState, string> = {
  on: 'On for this device. We’ll ping you for new messages, and a week and a day before festivals you marked.',
  off: 'Get a ping when someone messages you, and a week and a day before festivals you marked.',
  blocked: 'Alerts are blocked for Unity. Turn them on in your browser or phone settings, then come back.',
  'install-first': 'On iPhone, alerts work in the home screen app. Add Unity to your home screen, open it from there, and turn alerts on.',
  unsupported: 'This browser can’t show alerts. Try Chrome, or the home screen app on iPhone.',
}

export function PushCard() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    pushState().then(setState).catch(() => setState('unsupported'))
  }, [])
  if (!state) return null

  const flip = async () => {
    setBusy(true)
    setFailed(false)
    try {
      setState(state === 'on' ? await turnOff() : await turnOn())
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="install-card push-card" aria-labelledby="push-h">
      <span className="push-icon" aria-hidden="true"><BellIcon /></span>
      <div>
        <h2 id="push-h">Alerts</h2>
        <p>{COPY[state]}</p>
        {failed && <p className="error" role="alert">That didn’t work. Check your connection and try again.</p>}
        {(state === 'on' || state === 'off') && (
          <div className="event-actions">
            <button type="button" className={state === 'on' ? 'btn btn-soft' : 'btn'} onClick={flip} disabled={busy} aria-pressed={state === 'on'}>
              {busy ? 'One sec…' : state === 'on' ? 'Turn alerts off' : 'Turn alerts on'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
