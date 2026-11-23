import { useState, type FormEvent } from 'react'
import { CheckIcon } from '../art'
import { APP_NAME } from '../data'
import { applyMoveCode, moveCode, signIn, signOut, type Store } from '../store'
import { PageHeader } from './PageHeader'

/** "#/you/account": make an account, sign in on this phone, change the password, or sign out. */
export function AccountPage({ store }: { store: Store }) {
  const startOnSignIn = window.location.hash.endsWith('/signin')
  const [mode, setMode] = useState<'create' | 'signin'>(startOnSignIn ? 'signin' : 'create')
  return (
    <>
      <PageHeader title="Account" back="#/you" backLabel="Back to You" />
      <main className="page profile account">
        {store.account ? <SignedIn store={store} /> : (
          <>
            <div className="seg" role="tablist" aria-label="Account">
              <button type="button" role="tab" aria-selected={mode === 'create'} onClick={() => setMode('create')}>Create account</button>
              <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => setMode('signin')}>Sign in</button>
            </div>
            {mode === 'create' ? <CreateForm store={store} /> : <SignInForm store={store} />}
          </>
        )}
        <MoveAccount />
      </main>
    </>
  )
}

function CreateForm({ store }: { store: Store }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setProblem('Use a password of at least 8 characters.')
    setBusy(true)
    setProblem(await store.signUp(email.trim(), password))
    setBusy(false)
  }
  const has = store.mine.length > 0 || store.chats.length > 0
  return (
    <form className="step" onSubmit={submit}>
      <h2 className="section-h section-h-in">Save this phone’s {APP_NAME} to an account</h2>
      <p>{has
        ? `Your ${[store.mine.length ? `${store.mine.length} ${store.mine.length === 1 ? 'listing' : 'listings'}` : '', store.chats.length ? `${store.chats.length} ${store.chats.length === 1 ? 'chat' : 'chats'}` : ''].filter(Boolean).join(' and ')} move into the account. Sign in with it on any phone or in the home-screen app.`
        : 'Sign in with it on any phone or in the home-screen app, and you’ll never lose your listings or chats.'}</p>
      <label className="field">
        <span>Email</span>
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setProblem('') }} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={160} required />
      </label>
      <label className="field">
        <span>Password</span>
        <span className="hint">At least 8 characters.</span>
        <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setProblem('') }} autoComplete="new-password" minLength={8} maxLength={200} required />
      </label>
      {problem && <p className="error" role="alert">{problem}</p>}
      <button type="submit" className="btn" disabled={busy || !email.trim() || !password}>{busy ? 'Creating' : 'Create account'}</button>
      <p className="hint">We only use your email to sign you in. It’s never shown to anyone.</p>
    </form>
  )
}

function SignInForm({ store }: { store: Store }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const leaving = store.mine.length > 0 || store.chats.length > 0
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (leaving && !window.confirm(`This phone has listings or chats that aren’t saved to an account. Signing in switches to your account and leaves them behind. Sign in anyway?`)) return
    setBusy(true)
    const why = await signIn(email.trim(), password)
    setBusy(false)
    if (why) return setProblem(why)
    window.location.hash = '#/you'
    window.location.reload()
  }
  return (
    <form className="step" onSubmit={submit}>
      <h2 className="section-h section-h-in">Sign in</h2>
      <p>Your listings, chats, ratings and profile come with you.</p>
      {leaving && <p className="notice">This phone has listings or chats that aren’t in an account yet. To keep them, create an account here first instead.</p>}
      <label className="field">
        <span>Email</span>
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setProblem('') }} autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={160} required />
      </label>
      <label className="field">
        <span>Password</span>
        <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setProblem('') }} autoComplete="current-password" maxLength={200} required />
      </label>
      {problem && <p className="error" role="alert">{problem}</p>}
      <button type="submit" className="btn" disabled={busy || !email.trim() || !password}>{busy ? 'Signing in' : 'Sign in'}</button>
      <p className="hint">Forgot your password? Ask the {APP_NAME} team. We’ll check it’s you, then set a new one.</p>
    </form>
  )
}

function SignedIn({ store }: { store: Store }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [problem, setProblem] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  async function change(e: FormEvent) {
    e.preventDefault()
    if (next.length < 8) return setProblem('Use a new password of at least 8 characters.')
    setBusy(true)
    const why = await store.changePassword(current, next)
    setBusy(false)
    setProblem(why)
    if (!why) { setDone(true); setCurrent(''); setNext('') }
  }
  return (
    <>
      <section className="step">
        <h2 className="section-h section-h-in">Signed in</h2>
        <p className="account-email"><CheckIcon /> {store.account}</p>
        <p className="hint">Sign in with this email on any phone, or in the home-screen app, to pick up where you left off.</p>
        <button type="button" className="btn btn-soft" onClick={() => {
          if (!window.confirm('Sign out on this phone? Your listings and chats stay in your account. Sign back in any time.')) return
          signOut()
          window.location.hash = '#/you'
          window.location.reload()
        }}>Sign out on this phone</button>
      </section>
      <form className="step" onSubmit={change}>
        <h2 className="section-h section-h-in">Change password</h2>
        <input type="email" value={store.account ?? ''} autoComplete="username" readOnly hidden />
        <label className="field"><span>Current password</span>
          <input type="password" value={current} onChange={(e) => { setCurrent(e.target.value); setProblem(''); setDone(false) }} autoComplete="current-password" maxLength={200} required />
        </label>
        <label className="field"><span>New password</span>
          <input type="password" value={next} onChange={(e) => { setNext(e.target.value); setProblem(''); setDone(false) }} autoComplete="new-password" minLength={8} maxLength={200} required />
        </label>
        {problem && <p className="error" role="alert">{problem}</p>}
        {done && <p className="success" role="status"><CheckIcon /> Password changed</p>}
        <button type="submit" className="btn btn-soft" disabled={busy || !current || !next}>{busy ? 'Saving' : 'Change password'}</button>
      </form>
    </>
  )
}

/** The older way to move: copy this phone's secret code to another browser. */
function MoveAccount() {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState('')
  return (
    <details className="safety move">
      <summary>Move without an account, using a code</summary>
      <p>Copy this phone’s move code and paste it in your other browser. An account is easier, but this works too.</p>
      <p className="hint">Keep this code private, like a password. Anyone with it can act as you.</p>
      {shown ? (
        <div className="move-code">
          <code>{moveCode()}</code>
          <button type="button" className="btn btn-soft" onClick={async () => {
            try { await navigator.clipboard.writeText(moveCode()); setCopied(true) } catch { setCopied(false) }
          }}>{copied ? 'Copied' : 'Copy my move code'}</button>
        </div>
      ) : (
        <button type="button" className="btn btn-soft" onClick={() => setShown(true)}>Show my move code</button>
      )}
      <form className="report" onSubmit={(e) => {
        e.preventDefault()
        if (!window.confirm('Switch this browser to the account from that code? Anything listed from this browser stays with its old account.')) return
        if (applyMoveCode(code)) window.location.reload()
        else setProblem('That code isn’t right. It is 64 letters and numbers, copied from your other browser.')
      }}>
        <label className="field">
          <span>Paste a move code from your other browser</span>
          <input value={code} onChange={(e) => { setCode(e.target.value); setProblem('') }} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={80} />
        </label>
        {problem && <p className="error" role="alert">{problem}</p>}
        <button type="submit" className="btn btn-soft" disabled={!code.trim()}>Move my account here</button>
      </form>
    </details>
  )
}
