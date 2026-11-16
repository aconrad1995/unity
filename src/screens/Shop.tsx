import { useEffect, useMemo, useState } from 'react'
import { BellIcon, HeartIcon, SearchIcon, Sparkle } from '../art'
import type { Alerts } from '../alerts'
import { APP_NAME, CATEGORIES, FEATURED, SIZES, conditionLabel, featuredFor } from '../data'
import { bumpStat, readProfile, type Store } from '../store'
import { hasSignals, note, noteSearch, readTaste, score } from '../taste'
import { Card } from './Card'

type Sort = 'you' | 'new' | 'low' | 'high'

export default function Shop({ store, alerts, initialBrand = '' }: { store: Store; alerts: Alerts; initialBrand?: string }) {
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState(initialBrand)
  const [category, setCategory] = useState('')
  const [size, setSize] = useState('')
  // What this shopper is into, read once per visit so the order doesn't jump while they browse.
  const [taste] = useState(readTaste)
  const [profile] = useState(readProfile)
  const personal = hasSignals(taste, profile)
  const [sort, setSort] = useState<Sort>(personal ? 'you' : 'new')

  // Remember a search once they pause typing.
  useEffect(() => {
    if (query.trim().length < 3) return
    const timer = setTimeout(() => noteSearch(query), 1200)
    return () => clearTimeout(timer)
  }, [query])

  // Only brands that someone has actually listed appear in the row.
  const listedBrands = useMemo(
    () => [...new Set(store.listings.map((l) => l.brand))].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' })),
    [store.listings],
  )
  useEffect(() => {
    if (brand && !listedBrands.includes(brand) && !featuredFor(brand)) setBrand('')
  }, [brand, listedBrands])

  // Featured brands come first and show even with nothing listed.
  const brandRow = useMemo(
    () => [...FEATURED.map((f) => f.brand), ...listedBrands.filter((b) => !featuredFor(b))],
    [listedBrands],
  )
  const featured = brand ? featuredFor(brand) : undefined
  useEffect(() => {
    if (featured) bumpStat(featured.brand, 'bannerViews')
  }, [featured])

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const out = store.listings.filter((l) => {
      if (brand && l.brand !== brand) return false
      if (category && l.category !== category) return false
      if (size && l.size !== size) return false
      const hay = `${l.title} ${l.brand} ${l.category} ${l.size} ${conditionLabel(l.condition)} ${l.description}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
    if (sort === 'you') out.sort((a, b) => score(b, taste, profile) - score(a, taste, profile) || b.createdAt - a.createdAt)
    else if (sort === 'low') out.sort((a, b) => a.price - b.price)
    else if (sort === 'high') out.sort((a, b) => b.price - a.price)
    else out.sort((a, b) => b.createdAt - a.createdAt)
    return out
  }, [store.listings, query, brand, category, size, sort, taste, profile])

  const filtered = Boolean(query || brand || category || size)
  const clear = () => {
    setQuery('')
    setBrand('')
    setCategory('')
    setSize('')
  }

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <div className="top-brand">
            <a href="#/" className="wordmark">
              {APP_NAME}
              <Sparkle size={18} className="wordmark-star" />
            </a>
            <span className="top-links">
              <a href="#/alerts" className="saved-link bell-link" aria-label={alerts.fresh > 0 ? `New for you: ${alerts.fresh} new ${alerts.fresh === 1 ? 'outfit' : 'outfits'}` : 'New for you'}>
                <BellIcon />
                {alerts.fresh > 0 && <span className="tab-count bell-count" aria-hidden="true">{alerts.fresh}</span>}
              </a>
              <a href="#/saved" className="saved-link">
                <HeartIcon filled={store.saved.length > 0} />
                <span>Saved{store.saved.length > 0 ? ` (${store.saved.length})` : ''}</span>
              </a>
            </span>
          </div>
          <label className="search">
            <span className="sr-only">Search outfits</span>
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a brand, style or size"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="cloud-edge" aria-hidden="true" />
      </header>

      <main className="page">
        <InspoStrip store={store} />
        <section aria-labelledby="brands-h">
          <h2 id="brands-h" className="row-h">Shop by brand</h2>
          <div className="bubbles" role="group" aria-label="Brand">
            <button type="button" className="bubble" aria-pressed={brand === ''} onClick={() => setBrand('')}>All brands</button>
            {brandRow.map((b) => {
              const isFeatured = Boolean(featuredFor(b))
              return (
                <button
                  key={b}
                  type="button"
                  className={`bubble${isFeatured ? ' bubble-featured' : ''}`}
                  aria-pressed={brand === b}
                  aria-label={isFeatured ? `${b}, featured brand` : undefined}
                  onClick={() => {
                    if (brand !== b) note('brands', b)
                    setBrand(brand === b ? '' : b)
                  }}
                >
                  {isFeatured && <Sparkle size={14} />}
                  {b}
                </button>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="type-h">
          <h2 id="type-h" className="row-h">What are you looking for?</h2>
          <div className="bubbles" role="group" aria-label="Type">
            <button type="button" className="bubble bubble-blue" aria-pressed={category === ''} onClick={() => setCategory('')}>Everything</button>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className="bubble bubble-blue" aria-pressed={category === c} onClick={() => { if (category !== c) note('categories', c); setCategory(category === c ? '' : c) }}>
                {c}
              </button>
            ))}
          </div>
        </section>

        {featured && (
          <aside className="brand-banner" aria-label={`Sponsored: ${featured.brand}`}>
            <div className="brand-banner-head">
              <h2>{featured.brand}</h2>
              <span className="sponsored-tag">{featured.example ? 'Sponsored · Example' : 'Sponsored'}</span>
            </div>
            <p>{featured.blurb}</p>
            <a
              className="btn"
              href={featured.storeUrl}
              {...(featured.storeUrl.startsWith('#') ? {} : { target: '_blank', rel: 'sponsored noopener' })}
              onClick={() => bumpStat(featured.brand, 'storeClicks')}
            >
              Shop new at their store
            </a>
          </aside>
        )}

        <div className="selects">
          <label className="field-inline">
            <span>Size</span>
            <select value={size} onChange={(e) => { note('sizes', e.target.value); setSize(e.target.value) }}>
              <option value="">Any size</option>
              {SIZES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="field-inline">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="you">Picked for you</option>
              <option value="new">Newest first</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          </label>
        </div>

        <div className="results-bar" aria-live="polite">
          <p>{results.length} {results.length === 1 ? 'outfit' : 'outfits'}{brand ? ` from ${brand}` : ''}</p>
          {filtered && <button type="button" className="link-btn" onClick={clear}>Clear filters</button>}
        </div>

        {sort === 'you' && results.length > 0 && (
          <p className="for-you">
            <Sparkle size={16} />
            {personal
              ? 'Best matches first, based on your searches, taps and profile.'
              : 'Search, tap brands or fill in your profile and your best matches will show first.'}
          </p>
        )}

        {results.length > 0 ? (
          <ul className="grid">
            {results.map((l) => <Card key={l.id} listing={l} store={store} />)}
          </ul>
        ) : (
          <div className="empty">
            <h2>Nothing matches yet</h2>
            <p>Try a different brand or size, or clear your filters to see everything.</p>
            <button type="button" className="btn" onClick={clear}>Show all outfits</button>
          </div>
        )}

        <p className="fineprint">
          This is a preview of {APP_NAME}. Listings marked “Sample” are made-up examples, not real items,
          and {APP_NAME} is not affiliated with the brands listed.
        </p>
        <p className="fineprint fineprint-link">
          Run a rave brand? <a href="#/for-brands">Feature your brand on {APP_NAME}</a>
        </p>
      </main>
    </>
  )
}

/** A small doorway to Inspo at the top of the shop: the fit of the week when there is one. */
function InspoStrip({ store }: { store: Store }) {
  const fit = store.fit ? store.looks.find((l) => l.id === store.fit!.lookId) : undefined
  const who = fit ? store.people[fit.ownerId]?.name.trim() : ''
  return (
    <a className="inspo-strip" href="#/inspo">
      {fit ? <img src={`/api/photo/${fit.id}/0`} alt="" /> : <span className="inspo-strip-art"><Sparkle size={26} /></span>}
      <span>
        <strong>{fit ? 'Fit of the week' : 'Inspo'}</strong>
        <span>{fit ? `${who || 'Someone'} wearing ${fit.brands.slice(0, 2).join(' and ') || 'their best look'}` : 'See how people style their outfits, and post yours'}</span>
      </span>
    </a>
  )
}
