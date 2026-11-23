import { HeartIcon, ListingImage } from '../art'
import { arrivesBy, conditionLabel, money, type Listing } from '../data'
import type { Store } from '../store'
import { noteListing } from '../taste'

export function SaveButton({ store, id, big }: { store: Store; id: string; big?: boolean }) {
  const saved = store.saved.includes(id)
  return (
    <button
      type="button"
      className={`save${saved ? ' is-saved' : ''}${big ? ' save-big' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save this outfit'}
      onClick={(e) => {
        e.preventDefault()
        if (!saved) {
          const l = store.listings.find((x) => x.id === id)
          if (l) noteListing(l, 3)
        }
        store.toggleSaved(id)
      }}
    >
      <HeartIcon filled={saved} />
      {big && <span>{saved ? 'Saved' : 'Save'}</span>}
    </button>
  )
}

export function Card({ listing, store }: { listing: Listing; store: Store }) {
  const by = listing.status !== 'sold' ? arrivesBy(listing) : null
  return (
    <li className="card">
      <a href={`#/item/${listing.id}`} className="card-link">
        <div className="card-photo">
          <ListingImage listing={listing} />
          <span className="price-bubble">{money(listing.price)}</span>
          {listing.status && <span className={`status-flag status-${listing.status}`}>{listing.status === 'sold' ? 'Sold' : 'Reserved'}</span>}
        </div>
        <div className="card-body">
          <p className="card-brand">{listing.brand}</p>
          <h3 className="card-title">{listing.title}</h3>
          {listing.wornAt && <p className="card-worn">Worn at {listing.wornAt}</p>}
          <p className="card-meta">
            <span className="size-pill">{listing.size}</span>
            <span className={`cond cond-${listing.condition}`}>{conditionLabel(listing.condition)}</span>
          </p>
          {by && <p className="card-arrives">Arrives by {by.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
        </div>
      </a>
      {listing.ownerId !== store.me && <SaveButton store={store} id={listing.id} />}
    </li>
  )
}
