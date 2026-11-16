import { useEffect, useState } from 'react'
import { ListingImage, Sparkle } from '../art'
import { APP_NAME, CONDITIONS, featuredFor, type Listing } from '../data'
import { NO_ONE, bumpStat, nameOf, type Store } from '../store'
import { Avatar } from './ProfilePage'
import { noteListing } from '../taste'
import { SaveButton } from './Card'
import { RoleBadge } from './Team'
import { PageHeader } from './PageHeader'

export default function ListingPage({ store, id }: { store: Store; id: string }) {
  const listing: Listing | undefined = store.listings.find((l) => l.id === id)
  const [note, setNote] = useState<'' | 'buy' | 'chat'>('')
  const [shot, setShot] = useState(0)
  const [justListed] = useState(() => {
    try {
      return sessionStorage.getItem('unity.justListed') === id
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      sessionStorage.removeItem('unity.justListed')
    } catch {
      /* banner is optional */
    }
  }, [])

  const sponsor = listing ? featuredFor(listing.brand) : undefined
  useEffect(() => {
    if (sponsor) bumpStat(sponsor.brand, 'listingViews')
  }, [sponsor])

  useEffect(() => {
    if (listing && listing.sample) noteListing(listing, 1)
  }, [listing?.id])

  if (!listing) {
    return (
      <>
        <PageHeader title="Outfit not found" />
        <main className="page">
          <div className="empty">
            <h2>This outfit is gone</h2>
            <p>It may have been removed. There is plenty more to see in the shop.</p>
            <a className="btn" href="#/">Back to the shop</a>
          </div>
        </main>
      </>
    )
  }

  const condition = CONDITIONS.find((c) => c.id === listing.condition)!
  const isMine = !!listing.ownerId && listing.ownerId === store.me
  const seller = listing.ownerId ? store.people[listing.ownerId] ?? NO_ONE : undefined

  return (
    <>
      <PageHeader title={listing.brand} />
      <main className="page detail">
        {justListed && (
          <p className="success" role="status"><Sparkle size={22} /> Your outfit is listed. This is how buyers will see it.</p>
        )}
        <div className="detail-gallery">
          <div className="detail-photo">
            <ListingImage listing={listing} index={shot} />
            {listing.sample && <span className="sample-flag">Sample listing</span>}
          </div>
          {(listing.photoCount ?? 0) > 1 && (
            <ul className="thumbs" aria-label="More photos">
              {Array.from({ length: listing.photoCount! }, (_, i) => (
                <li key={i}>
                  <button type="button" aria-label={`Show photo ${i + 1} of ${listing.photoCount}`} aria-current={i === shot ? 'true' : undefined} onClick={() => setShot(i)}>
                    <img src={`/api/photo/${listing.id}/${i}`} alt="" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="detail-info">
          <h1 className="detail-title">{listing.title}</h1>
          <p className="detail-price">${listing.price}</p>

          <dl className="facts">
            <div><dt>Brand</dt><dd>{listing.brand}</dd></div>
            <div><dt>Size</dt><dd>{listing.size}</dd></div>
            <div><dt>Type</dt><dd>{listing.category}</dd></div>
          </dl>

          <div className={`cond-card cond-${listing.condition}`}>
            <p className="cond-card-label">{condition.label}</p>
            <p>{condition.help}</p>
          </div>

          <p className="detail-desc">{listing.description}</p>
          {seller ? (
            <a className="seller-card" href={isMine ? '#/you' : `#/chats/${listing.ownerId}/${listing.id}`}>
              <Avatar profile={seller} size={52} />
              <span>
                <strong>Sold by {isMine ? 'you' : nameOf(seller)}</strong>
                <RoleBadge role={store.roles[listing.ownerId!]} />
                {seller.upFor.length > 0
                  ? <span className="seller-upfor">Say hi about: {seller.upFor.join(', ').toLowerCase()}</span>
                  : isMine && <span className="seller-upfor">Tap to edit your profile</span>}
              </span>
            </a>
          ) : (
            <p className="detail-seller">Sold by {listing.seller}</p>
          )}

          <div className="actions">
            {!isMine && <button type="button" className="btn btn-wide" onClick={() => setNote('buy')}>Buy now</button>}
            <div className="actions-row">
              {!isMine && (listing.ownerId
                ? <a className="btn btn-soft" href={`#/chats/${listing.ownerId}/${listing.id}`}>Message seller</a>
                : <button type="button" className="btn btn-soft" onClick={() => setNote('chat')}>Message seller</button>)}
              <SaveButton store={store} id={listing.id} big />
            </div>
            {note && (
              <p className="notice" role="status">
                {note === 'buy'
                  ? `Checkout isn’t switched on yet. This is a preview of ${APP_NAME}, so nothing can be bought for real.`
                  : 'This is a sample listing, so there is no real seller to message. Outfits listed by real people can be messaged.'}
              </p>
            )}
          </div>

          {sponsor && (
            <div className="buy-new">
              <a
                className="btn btn-soft"
                href={sponsor.storeUrl}
                {...(sponsor.storeUrl.startsWith('#') ? {} : { target: '_blank', rel: 'sponsored noopener' })}
                onClick={() => bumpStat(sponsor.brand, 'storeClicks')}
              >
                Buy it new from {sponsor.brand}
              </a>
              <span className="sponsored-tag">{sponsor.example ? 'Sponsored · Example' : 'Sponsored'}</span>
            </div>
          )}

          {!isMine && !listing.sample && store.myRole && (
            <button
              type="button"
              className="link-btn danger"
              onClick={() => {
                if (window.confirm('Remove this listing for breaking the rules? This cannot be undone.')) {
                  store.removeListing(listing.id).then((ok) => { if (ok) window.location.hash = '#/' })
                }
              }}
            >
              Remove this listing (team)
            </button>
          )}
          {isMine && (
            <button
              type="button"
              className="link-btn danger"
              onClick={() => {
                if (window.confirm('Remove this listing? This cannot be undone.')) {
                  store.removeListing(listing.id).then((ok) => {
                    if (ok) window.location.hash = '#/'
                    else window.alert('Your listing could not be removed right now. Try again in a moment.')
                  })
                }
              }}
            >
              Remove my listing
            </button>
          )}
        </div>
      </main>
    </>
  )
}
