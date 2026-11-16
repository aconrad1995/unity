import { HeartIcon } from '../art'
import type { Store } from '../store'
import { Card } from './Card'
import { PageHeader } from './PageHeader'

export default function Saved({ store }: { store: Store }) {
  const items = store.saved.map((id) => store.listings.find((l) => l.id === id)).filter((l) => l !== undefined)
  return (
    <>
      <PageHeader title="Saved outfits" />
      <main className="page">
        {items.length > 0 ? (
          <ul className="grid">
            {items.map((l) => <Card key={l.id} listing={l} store={store} />)}
          </ul>
        ) : (
          <div className="empty">
            <span className="empty-art"><HeartIcon filled /></span>
            <h2>No saved outfits yet</h2>
            <p>Tap the heart on any outfit and it will wait for you here.</p>
            <a className="btn" href="#/">Browse the shop</a>
          </div>
        )}
      </main>
    </>
  )
}
