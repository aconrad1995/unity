import { useState } from 'react'
import { HeartIcon, ListingImage, Sparkle } from '../art'
import { conditionLabel, type Listing } from '../data'
import type { Store } from '../store'
import { noteListing } from '../taste'

export function SaveButton({ store, id, big }: { store: Store; id: string; big?: boolean }) {
  const saved = store.saved.includes(id)
  const [burst, setBurst] = useState(0)
  return (
    <button
      type="button"
      className={`save${saved ? ' is-saved' : ''}${big ? ' save-big' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save this outfit'}
      onClick={(e) => {
        e.preventDefault()
        if (!saved) {
          setBurst((b) => b + 1)
          const l = store.listings.find((x) => x.id === id)
          if (l) noteListing(l, 3)
        }
        store.toggleSaved(id)
      }}
    >
      <HeartIcon filled={saved} />
      {big && <span>{saved ? 'Saved' : 'Save'}</span>}
      {burst > 0 && (
        <span className="burst" key={burst} aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Sparkle key={i} size={14} className={`burst-s burst-${i}`} />
          ))}
        </span>
      )}
    </button>
  )
}

export function Card({ listing, store }: { listing: Listing; store: Store }) {
  return (
    <li className="card">
      <a href={`#/item/${listing.id}`} className="card-link">
        <div className="card-photo">
          <ListingImage listing={listing} />
          <span className="price-bubble">${listing.price}</span>
          {listing.sample && <span className="sample-flag">Sample</span>}
        </div>
        <div className="card-body">
          <p className="card-brand">{listing.brand}</p>
          <h3 className="card-title">{listing.title}</h3>
          <p className="card-meta">
            <span className="size-pill">{listing.size}</span>
            <span className={`cond cond-${listing.condition}`}>{conditionLabel(listing.condition)}</span>
          </p>
        </div>
      </a>
      <SaveButton store={store} id={listing.id} />
    </li>
  )
}
