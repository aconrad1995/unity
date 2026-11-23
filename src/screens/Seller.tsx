import { useState, type FormEvent } from 'react'
import { InstagramIcon, StarIcon } from '../art'
import { APP_NAME } from '../data'
import { NO_ONE, nameOf, type RatingSummary, type Store } from '../store'
import { Card } from './Card'
import { PageHeader } from './PageHeader'
import { Avatar } from './ProfilePage'
import { RoleBadge } from './Team'

/** Five stars, filled up to the given number. */
export function Stars({ value, label }: { value: number; label?: string }) {
  return (
    <span className="stars" role="img" aria-label={label ?? `${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <StarIcon key={n} filled={n <= Math.round(value)} />)}
    </span>
  )
}

/** "Selling since Nov 2026 · 3 for sale · 1 sold": a quick sense of who you're buying from. */
export function SellerHistory({ store, id }: { store: Store; id: string }) {
  const facts = store.sellers[id]
  const forSale = store.listings.filter((l) => l.ownerId === id && l.status !== 'sold').length
  const parts = [
    facts?.since ? `Selling since ${new Date(facts.since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : '',
    forSale ? `${forSale} for sale` : '',
    facts?.sold ? `${facts.sold} sold` : '',
  ].filter(Boolean)
  return parts.length ? <span className="seller-history">{parts.join(' · ')}</span> : null
}

/** "4.8 · 12 ratings", or "No ratings yet". */
export function RatingLine({ summary }: { summary: RatingSummary | undefined }) {
  if (!summary?.count) return <span className="rating-line rating-none">No ratings yet</span>
  return (
    <span className="rating-line">
      <Stars value={summary.average} label={`Rated ${summary.average} out of 5`} />
      <span className="rating-figure">{summary.average.toFixed(1)}</span>
      <span className="rating-count">· {summary.count} {summary.count === 1 ? 'rating' : 'ratings'}</span>
    </span>
  )
}

export function InstagramLink({ handle }: { handle?: string }) {
  if (!handle) return null
  return (
    <a className="insta-link" href={`https://www.instagram.com/${handle}/`} target="_blank" rel="noopener noreferrer nofollow ugc">
      <InstagramIcon /> @{handle}
    </a>
  )
}

const day = (at: number) => new Date(at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

/** A seller's public page: who they are, their Instagram, what buyers said, and what they're selling. */
export function SellerPage({ store, id }: { store: Store; id: string }) {
  const person = store.people[id] ?? NO_ONE
  const name = nameOf(person)
  const isMe = id === store.me
  const summary = store.ratings[id]
  const theirs = store.listings.filter((l) => l.ownerId === id && l.status !== 'sold')
  const known = !!store.people[id] || theirs.length > 0

  if (!/^[0-9a-f]{16}$/.test(id) || !known) {
    const waiting = /^[0-9a-f]{16}$/.test(id) && store.online !== true
    return (
      <>
        <PageHeader title="Seller" />
        <main className="page">
          {waiting && store.online === null ? (
            <p className="loading" role="status">Loading this seller</p>
          ) : (
            <div className="empty">
              <h2>{waiting ? 'This seller can’t load right now' : 'Seller not found'}</h2>
              <p>{waiting ? `${APP_NAME} can’t be reached. Check your connection, and it will load by itself.` : `This person may have left ${APP_NAME}.`}</p>
              <a className="btn" href="#/">Back to the shop</a>
            </div>
          )}
        </main>
      </>
    )
  }

  return (
    <>
      <PageHeader title={isMe ? 'Your seller page' : name} heading={false} docTitle={name} />
      <main className="page seller-page">
        <section className="seller-head">
          <Avatar profile={person} size={88} />
          <div className="seller-head-text">
            <h1 className="seller-name">{name} <RoleBadge role={store.roles[id]} /></h1>
            <RatingLine summary={summary} />
            <InstagramLink handle={person.instagram} />
          </div>
        </section>
        {person.upFor.length > 0 && <p className="seller-upfor">Say hi about: {person.upFor.join(', ').toLowerCase()}</p>}
        {isMe ? (
          <p className="notice">This is how buyers see you. <a className="inline-link" href="#/you">Edit your name, picture or Instagram</a></p>
        ) : (
          <a className="btn btn-wide" href={`#/chats/${id}`}>Message {name}</a>
        )}

        <section aria-labelledby="ratings-h">
          <h2 id="ratings-h" className="section-h">What buyers said</h2>
          {summary?.count ? (
            <ul className="reviews">
              {summary.recent.map((r) => (
                <li key={r.by} className="review">
                  <div className="review-top">
                    <Stars value={r.stars} />
                    <span className="review-meta">{nameOf(store.people[r.by])} · {day(r.at)}</span>
                  </div>
                  {r.note && <p>{r.note}</p>}
                  {store.myRole && (
                    <button type="button" className="link-btn danger" onClick={() => {
                      if (window.confirm('Take this rating down for breaking the rules?')) void store.removeRating(id, r.by)
                    }}>Remove this rating (team)</button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">No ratings yet. Buyers can rate {isMe ? 'you' : name} after chatting about an outfit.</p>
          )}
        </section>

        <section aria-labelledby="their-h">
          <h2 id="their-h" className="section-h">{isMe ? 'Your outfits for sale' : `${name}’s outfits`}</h2>
          {theirs.length > 0
            ? <ul className="grid">{theirs.map((l) => <Card key={l.id} listing={l} store={store} />)}</ul>
            : <p className="hint">Nothing for sale right now.</p>}
        </section>

        <p className="fineprint">Only people who’ve chatted with a seller, and heard back, can rate them. One rating each, which they can change. Ratings and names are public.</p>
      </main>
    </>
  )
}

/** In a chat with a seller: leave or change your rating. */
export function RateCard({ store, user }: { store: Store; user: string }) {
  const mine = store.ratings[user]?.recent.find((r) => r.by === store.me)
  const [open, setOpen] = useState(false)
  const [stars, setStars] = useState(mine?.stars ?? 0)
  const [note, setNote] = useState(mine?.note ?? '')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const name = nameOf(store.people[user])

  if (!store.canRate(user)) return null

  if (mine && !open) {
    return (
      <div className="rate-card rate-done">
        <span>You rated {name} <Stars value={mine.stars} /></span>
        <button type="button" className="link-btn" onClick={() => { setStars(mine.stars); setNote(mine.note); setOpen(true) }}>Change</button>
      </div>
    )
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!stars) return setProblem('Pick how many stars.')
    setBusy(true)
    const why = await store.rate(user, stars, note.trim())
    setBusy(false)
    setProblem(why)
    if (!why) setOpen(false)
  }

  if (!open) {
    return (
      <div className="rate-card rate-done">
        <span>Bought from {name}? Help other buyers</span>
        <button type="button" className="btn btn-soft" onClick={() => setOpen(true)}>Rate {name}</button>
      </div>
    )
  }

  return (
    <form className="rate-card" onSubmit={save}>
      <div className="field" role="radiogroup" aria-label={`Rate ${name}`}>
        <span>How was buying from {name}?</span>
        <div className="star-pick">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
              className={n <= stars ? 'on' : undefined} onClick={() => { setStars(n); setProblem('') }}>
              <StarIcon filled={n <= stars} />
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Anything to add?</span>
        <span className="hint">Optional. Shows on {name}’s seller page with your name.</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={200} placeholder="Shipped fast, exactly like the photos" />
      </label>
      {problem && <p className="error" role="alert">{problem}</p>}
      <div className="actions-row">
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving' : mine ? 'Save rating' : 'Post rating'}</button>
        <button type="button" className="btn btn-soft" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {mine && (
        <button type="button" className="link-btn danger" onClick={async () => { await store.unrate(user); setStars(0); setNote(''); setOpen(false) }}>Take my rating back</button>
      )}
    </form>
  )
}
