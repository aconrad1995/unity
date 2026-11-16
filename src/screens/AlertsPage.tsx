import { useEffect, useState } from 'react'
import { BellIcon } from '../art'
import type { Alerts } from '../alerts'
import type { Store } from '../store'
import { Card } from './Card'
import { PageHeader } from './PageHeader'

export default function AlertsPage({ store, alerts }: { store: Store; alerts: Alerts }) {
  // Remember what was new when the page opened, then clear the badge.
  const [openedAt] = useState(alerts.seenAt)
  useEffect(() => {
    alerts.markSeen()
  }, [alerts.matches.length])
  const fresh = alerts.matches.filter((l) => l.createdAt > openedAt)
  const older = alerts.matches.filter((l) => l.createdAt <= openedAt)

  return (
    <>
      <PageHeader title="New for you" />
      <main className="page">
        {!alerts.hasPrefs ? (
          <div className="empty">
            <span className="empty-art"><BellIcon /></span>
            <h2>Tell us what to look out for</h2>
            <p>Add your sizes and favourite brands to your profile. When someone lists a match, it shows up here.</p>
            <a className="btn" href="#/you">Set my brands and sizes</a>
          </div>
        ) : alerts.matches.length === 0 ? (
          <div className="empty">
            <span className="empty-art"><BellIcon /></span>
            <h2>Nothing new yet</h2>
            <p>New outfits from your favourite brands, in your sizes, will show up here and on the bell in the shop.</p>
            <a className="btn" href="#/">Browse the shop</a>
          </div>
        ) : (
          <>
            {fresh.length > 0 && (
              <section aria-labelledby="fresh-h">
                <h2 id="fresh-h" className="section-h">Just listed</h2>
                <ul className="grid">{fresh.map((l) => <Card key={l.id} listing={l} store={store} />)}</ul>
              </section>
            )}
            {older.length > 0 && (
              <section aria-labelledby="older-h">
                <h2 id="older-h" className="section-h">Earlier</h2>
                <ul className="grid">{older.map((l) => <Card key={l.id} listing={l} store={store} />)}</ul>
              </section>
            )}
          </>
        )}
        <p className="fineprint">Matches use the brands and sizes on your profile. They stay on this phone.</p>
      </main>
    </>
  )
}
