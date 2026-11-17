import { useEffect, useState, type FormEvent } from 'react'
import { Sparkle } from '../art'
import { APP_NAME } from '../data'
import { NO_ONE, nameOf, type Report, type Role, type Store } from '../store'
import { PageHeader } from './PageHeader'

const ROLE_LABEL: Record<Exclude<Role, ''>, string> = { owner: 'Shop owner', admin: `${APP_NAME} team` }

/** Shows next to a name so nobody can pass themselves off as the owner or the team. */
export function RoleBadge({ role }: { role: Role | undefined }) {
  if (!role) return null
  return (
    <span className={`role-badge role-${role}`}>
      <Sparkle size={12} />
      {ROLE_LABEL[role]}
    </span>
  )
}

export function TeamPage({ store }: { store: Store }) {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<'' | 'ok' | 'wrong' | 'slow' | 'offline'>('')
  const [busy, setBusy] = useState(false)

  async function claim(e: FormEvent) {
    e.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    const r = await store.claimRole(code)
    setBusy(false)
    setResult(r)
    if (r === 'ok') setCode('')
  }

  return (
    <>
      <PageHeader title="Team" back="#/you" backLabel="Back to your profile" />
      <main className="page team">
        {store.myRole ? (
          <section className="step">
            <h2 className="section-h section-h-in">You’re signed in as <RoleBadge role={store.myRole} /></h2>
            <p>This device has team tools. The badge shows next to your name on your listings, looks and chats, so people know it’s really you.</p>
            <ul className="team-tools">
              <li><a className="btn" href="#/sell">List an outfit</a></li>
              <li><a className="btn btn-soft" href="#/team/reports">Review reports</a></li>
              <li><a className="btn btn-soft" href="#/inspo">Pick the fit of the week</a></li>
              <li><a className="btn btn-soft" href="#/inspo/new">Post a look</a></li>
            </ul>
            <p className="hint">You can remove any listing or look that breaks the rules from its own page.</p>
          </section>
        ) : (
          <form className="step" onSubmit={claim}>
            <h2 className="section-h section-h-in">Team sign-in</h2>
            <p>For the shop owner and the {APP_NAME} team only. Type the team code you were given. You only need to do this once on each phone.</p>
            <label className="field">
              <span>Team code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={200} />
            </label>
            {result === 'wrong' && <p className="error" role="alert">That code isn’t right. Check it and try again.</p>}
            {result === 'slow' && <p className="error" role="alert">Too many tries. Wait an hour, then try again.</p>}
            {result === 'offline' && <p className="error" role="alert">{APP_NAME} can’t be reached. Check your connection.</p>}
            <button type="submit" className="btn" disabled={!code.trim() || busy}>{busy ? 'Checking' : 'Sign in'}</button>
          </form>
        )}
        {result === 'ok' && <p className="success" role="status"><Sparkle size={22} /> Signed in. Welcome to the team.</p>}
        <p className="fineprint">
          Your team access lives on this phone. If you clear this browser’s data, or switch between Safari and the home-screen app, sign in again with the code.
        </p>
      </main>
    </>
  )
}

function when(at: number) {
  return new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function ReportsPage({ store }: { store: Store }) {
  const [reports, setReports] = useState<Report[] | null | undefined>(undefined)
  useEffect(() => {
    store.teamReports().then(setReports)
  }, [store.myRole])

  const who = (id: string) => nameOf(store.people[id] ?? NO_ONE)
  const open = (reports ?? []).filter((r) => !r.resolved).reverse()
  const done = (reports ?? []).filter((r) => r.resolved).reverse()

  return (
    <>
      <PageHeader title="Reports" back="#/team" backLabel="Back to team tools" />
      <main className="page team">
        {reports === undefined && <p className="hint">Loading reports…</p>}
        {reports === null && <p className="error" role="alert">Reports are only for the team. Sign in on the Team page first.</p>}
        {reports && open.length === 0 && (
          <div className="empty"><h2>Nothing to review</h2><p>New reports from chats show up here.</p></div>
        )}
        {open.map((r) => (
          <article key={r.id} className="step report-card">
            <h2 className="section-h section-h-in">{who(r.by)} reported {who(r.user)}</h2>
            <p className="hint">{when(r.at)}</p>
            <p className="report-reason">“{r.reason}”</p>
            {r.evidence.length > 0 && (
              <details className="safety">
                <summary>Last {r.evidence.length} messages between them</summary>
                <ol className="evidence">
                  {r.evidence.map((m) => (
                    <li key={m.id}><strong>{who(m.from)}:</strong> {m.text}</li>
                  ))}
                </ol>
              </details>
            )}
            <button type="button" className="btn btn-soft" onClick={async () => setReports((await store.resolveReport(r.id)) ?? reports)}>Mark as handled</button>
          </article>
        ))}
        {done.length > 0 && <p className="hint">{done.length} handled {done.length === 1 ? 'report' : 'reports'}.</p>}
      </main>
    </>
  )
}
