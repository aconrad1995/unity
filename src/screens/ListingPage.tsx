import { useEffect, useState, type FormEvent } from 'react'
import { CheckIcon, CloseIcon, ListingImage, PlusIcon } from '../art'
import { APP_NAME, CONDITIONS, SHIP_OPTIONS, SIZES, arrivesBefore, arrivesBy, featuredFor, money, photoSrc, type ConditionId, type Listing, type Size } from '../data'
import { useGoing } from '../going'
import { NO_ONE, bumpStat, nameOf, shrinkPhoto, type Store } from '../store'
import { Avatar } from './ProfilePage'
import { noteListing } from '../taste'
import { SaveButton } from './Card'
import { RoleBadge } from './Team'
import { PageHeader } from './PageHeader'
import { RatingLine } from './Seller'

export default function ListingPage({ store, id }: { store: Store; id: string }) {
  const listing: Listing | undefined = store.listings.find((l) => l.id === id)
  const [editing, setEditing] = useState(false)
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
    // Every outfit opened teaches "Picked for you" a little about this shopper's taste.
    if (listing) noteListing(listing, 1)
  }, [listing?.id])

  if (!listing) {
    // Until the first sync answers, a shared link hasn't been checked yet, so don't call it gone.
    const state = store.online === null ? 'loading' : store.online === false ? 'offline' : 'gone'
    return (
      <>
        <PageHeader title={state === 'gone' ? 'Outfit not found' : 'Outfit'} />
        <main className="page">
          {state === 'loading' ? (
            <p className="loading" role="status">Loading this outfit</p>
          ) : (
            <div className="empty">
              <h2>{state === 'offline' ? 'This outfit can’t load right now' : 'This outfit is gone'}</h2>
              <p>{state === 'offline' ? `${APP_NAME} can’t be reached. Check your connection, and it will load by itself.` : 'It may have been removed. There is plenty more to see in the shop.'}</p>
              <a className="btn" href="#/">Back to the shop</a>
            </div>
          )}
        </main>
      </>
    )
  }

  const condition = CONDITIONS.find((c) => c.id === listing.condition)!
  const isMine = !!listing.ownerId && listing.ownerId === store.me
  const seller = listing.ownerId ? store.people[listing.ownerId] ?? NO_ONE : undefined

  return (
    <>
      <PageHeader title={listing.brand} heading={false} docTitle={`${listing.title}, ${listing.brand}`} />
      <main className="page detail">
        {justListed && (
          <div className="success listed-next" role="status">
            <p><CheckIcon /> Your outfit is listed. This is how buyers will see it.</p>
            <a className="btn" href="#/sell">List another outfit</a>
          </div>
        )}
        <div className="detail-gallery">
          <div className="detail-photo">
            <ListingImage listing={listing} index={shot} />
            {listing.sample && <span className="sample-flag">Sample listing</span>}
            {listing.status && <span className={`status-flag status-${listing.status}`}>{listing.status === 'sold' ? 'Sold' : 'Reserved'}</span>}
          </div>
          {(listing.photoCount ?? 0) > 1 && (
            <ul className="thumbs" aria-label="More photos">
              {Array.from({ length: listing.photoCount! }, (_, i) => (
                <li key={i}>
                  <button type="button" aria-label={`Show photo ${i + 1} of ${listing.photoCount}`} aria-current={i === shot ? 'true' : undefined} onClick={() => setShot(i)}>
                    <img src={photoSrc(listing, i)} alt="" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="detail-info">
          <h1 className="detail-title">{listing.title}</h1>
          <p className="detail-price">{money(listing.price)}</p>

          <dl className="facts">
            <div><dt>Brand</dt><dd>{listing.brand}</dd></div>
            <div><dt>Size</dt><dd>{listing.size}</dd></div>
            <div><dt>Type</dt><dd>{listing.category}</dd></div>
            {listing.wornAt && <div><dt>Worn at</dt><dd>{listing.wornAt}</dd></div>}
          </dl>
          <Shipping listing={listing} />

          <div className={`cond-card cond-${listing.condition}`}>
            <p className="cond-card-label">{condition.label}</p>
            <p>{condition.help}</p>
          </div>

          <p className="detail-desc">{listing.description}</p>
          {seller ? (
            <a className="seller-card" href={`#/seller/${listing.ownerId}`}>
              <Avatar profile={seller} size={52} />
              <span>
                <strong>Sold by {isMine ? 'you' : nameOf(seller)}</strong>
                <RoleBadge role={store.roles[listing.ownerId!]} />
                <RatingLine summary={store.ratings[listing.ownerId!]} />
                {seller.instagram && <span className="seller-insta">@{seller.instagram}</span>}
                {seller.upFor.length > 0
                  ? <span className="seller-upfor">Say hi about: {seller.upFor.join(', ').toLowerCase()}</span>
                  : isMine && <span className="seller-upfor">Tap to see your seller page</span>}
              </span>
            </a>
          ) : (
            <p className="detail-seller">Sold by {listing.seller}</p>
          )}

          {isMine ? (
            editing
              ? <EditListing store={store} listing={listing} done={() => setEditing(false)} />
              : (
                <div className="actions seller-tools">
                  <button type="button" className="btn btn-wide" onClick={() => setEditing(true)}>Edit photos or details</button>
                  <div className="actions-row">
                    {listing.status === 'sold'
                      ? <button type="button" className="btn btn-soft" onClick={() => store.editListing(listing.id, { status: null })}>Not sold after all</button>
                      : <button type="button" className="btn btn-soft" onClick={() => store.editListing(listing.id, { status: 'sold' })}>Mark as sold</button>}
                    {listing.status !== 'sold' && (listing.status === 'reserved'
                      ? <button type="button" className="btn btn-soft" onClick={() => store.editListing(listing.id, { status: null })}>Not reserved</button>
                      : <button type="button" className="btn btn-soft" onClick={() => store.editListing(listing.id, { status: 'reserved' })}>Mark reserved</button>)}
                  </div>
                  <p className="hint">Sold outfits leave the shop after a day and stay in your closet. Chats about them are kept.</p>
                </div>
              )
          ) : (
            <div className="actions">
              {listing.status === 'sold' ? (
                <p className="notice">This outfit has sold. Save it to find similar ones, or message the seller about other pieces.</p>
              ) : listing.ownerId ? (
                <>
                  {/* Paying inside the app isn't switched on yet, so buying starts as a chat with the seller. */}
                  <div className="buy-row">
                    <a className="btn" href={`#/chats/${listing.ownerId}/${listing.id}`}>Message seller to buy</a>
                    <SaveButton store={store} id={listing.id} big />
                  </div>
                  <p className="buy-how">You’ll agree the price and shipping in the chat. {APP_NAME} doesn’t take payment yet, so pay with something that has buyer protection, like PayPal Goods &amp; Services.</p>
                </>
              ) : (
                <div className="sample-cta">
                  <p><strong>This is an example listing.</strong> It shows how outfits look on {APP_NAME}, and it isn’t for sale.</p>
                  <a className="btn btn-wide" href="#/sell">List yours in 2 minutes</a>
                </div>
              )}
              {!listing.sample && (!listing.ownerId || listing.status === 'sold') && (
                <div className="actions-row">
                  <SaveButton store={store} id={listing.id} big />
                </div>
              )}
            </div>
          )}

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

const MAX_EDIT_PHOTOS = 5

/** The seller changes the photos, name, price, size, condition or description without listing it again. */
function EditListing({ store, listing, done }: { store: Store; listing: Listing; done: () => void }) {
  const [title, setTitle] = useState(listing.title)
  const [price, setPrice] = useState(String(listing.price))
  const [size, setSize] = useState<Size>(listing.size)
  const [condition, setCondition] = useState<ConditionId>(listing.condition)
  const [description, setDescription] = useState(listing.description === 'No description added.' ? '' : listing.description)
  const [shipDays, setShipDays] = useState(listing.shipDays)
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  // Each photo is either one already on the listing (its number) or a new one (its data URL).
  const original = Array.from({ length: listing.photoCount ?? 0 }, (_, i) => i)
  const [pics, setPics] = useState<(number | string)[]>(original)
  const [picProblem, setPicProblem] = useState('')
  const picsChanged = pics.length !== original.length || pics.some((p, i) => p !== original[i])

  async function addPics(files: FileList | null) {
    if (!files || files.length === 0) return
    const room = MAX_EDIT_PHOTOS - pics.length
    const added: string[] = []
    let unreadable = 0
    for (const file of Array.from(files).slice(0, room)) {
      try { added.push(await shrinkPhoto(file)) } catch { unreadable++ }
    }
    setPics((cur) => [...cur, ...added].slice(0, MAX_EDIT_PHOTOS))
    setPicProblem(unreadable > 0
      ? 'One of those files could not be opened. Try a JPG or PNG photo.'
      : files.length > room ? `You can have up to ${MAX_EDIT_PHOTOS} photos, so the extras were left out.` : '')
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const amount = Math.round(Number(price))
    if (picsChanged && pics.length === 0) return setProblem('Keep at least one photo of your outfit.')
    if (!title.trim()) return setProblem('Give your outfit a short name.')
    if (!(amount >= 1 && amount <= 10000)) return setProblem('Enter a price between $1 and $10,000.')
    setBusy(true)
    const why = await store.editListing(listing.id, { title: title.trim(), price: amount, size, condition, description: description.trim() || 'No description added.', ...(shipDays ? { shipDays } : {}), ...(picsChanged ? { photos: pics } : {}) })
    setBusy(false)
    if (why) setProblem(why)
    else done()
  }

  return (
    <form className="step edit-listing" onSubmit={save}>
      <h2 className="section-h section-h-in">Edit your outfit</h2>
      {(listing.photoCount ?? 0) > 0 && (
        <div className="field" role="group" aria-labelledby="edit-photos-l">
          <span id="edit-photos-l">Photos</span>
          <ul className="photo-grid" aria-label="Your photos">
            {pics.map((p, i) => (
              <li key={typeof p === 'number' ? `keep-${p}` : `add-${p.slice(-40)}-${i}`} className="photo-tile">
                <img src={typeof p === 'number' ? photoSrc(listing, p) : p} alt={`Photo ${i + 1}`} />
                {i === 0 ? <span className="cover-tag">Cover</span> : (
                  <button type="button" className="cover-btn" onClick={() => setPics((cur) => [cur[i], ...cur.filter((_, j) => j !== i)])}>Make cover</button>
                )}
                <button type="button" className="tile-x" aria-label={`Remove photo ${i + 1}`} onClick={() => setPics((cur) => cur.filter((_, j) => j !== i))}><CloseIcon /></button>
              </li>
            ))}
            {pics.length < MAX_EDIT_PHOTOS && (
              <li className="photo-tile photo-add">
                <label>
                  <PlusIcon />
                  <span>Add more</span>
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void addPics(e.target.files); e.target.value = '' }} />
                </label>
              </li>
            )}
          </ul>
          {picProblem && <p className="error" role="alert">{picProblem}</p>}
        </div>
      )}
      <label className="field"><span>Name</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} /></label>
      <label className="field price-field">
        <span>Price in dollars</span>
        <span className="price-input"><span aria-hidden="true">$</span>
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, '').slice(0, 7))} />
        </span>
      </label>
      <div className="field" role="group" aria-labelledby="edit-size-l">
        <span id="edit-size-l">Size</span>
        <div className="bubbles bubbles-wrap">
          {SIZES.map((s) => <button key={s} type="button" className="bubble" aria-pressed={size === s} onClick={() => setSize(s)}>{s}</button>)}
        </div>
      </div>
      <div className="field" role="group" aria-labelledby="edit-cond-l">
        <span id="edit-cond-l">How worn is it?</span>
        <div className="bubbles bubbles-wrap">
          {CONDITIONS.map((c) => <button key={c.id} type="button" className="bubble" aria-pressed={condition === c.id} onClick={() => setCondition(c.id)}>{c.label}</button>)}
        </div>
      </div>
      <div className="field" role="group" aria-labelledby="edit-ship-l">
        <span id="edit-ship-l">How fast can you send it?</span>
        <div className="bubbles bubbles-wrap">
          {SHIP_OPTIONS.map((o) => <button key={o.days} type="button" className="bubble" aria-pressed={shipDays === o.days} onClick={() => setShipDays(o.days)}>{o.label}</button>)}
        </div>
      </div>
      <label className="field"><span>Anything buyers should know?</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={400} /></label>
      {problem && <p className="error" role="alert">{problem}</p>}
      <div className="actions-row">
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving' : 'Save changes'}</button>
        <button type="button" className="btn btn-soft" onClick={done}>Cancel</button>
      </div>
    </form>
  )
}

/** When it ships and roughly when it lands, and whether that beats your next festival. */
function Shipping({ listing }: { listing: Listing }) {
  const { nextDated: ev } = useGoing()
  const by = arrivesBy(listing)
  if (!by || listing.status === 'sold') return null
  const label = SHIP_OPTIONS.find((o) => o.days === listing.shipDays)?.label ?? ''
  const when = by.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const inTime = ev ? arrivesBefore(listing, ev.date) : false
  return (
    <div className="ship-card">
      <p><strong>Ships {label.toLowerCase()}.</strong> Ordered today, it should arrive by about {when}.</p>
      {ev && <p className={inTime ? 'ship-ok' : 'ship-late'}>{inTime ? `In time for ${ev.name}` : `Might not arrive before ${ev.name}`}</p>}
    </div>
  )
}
