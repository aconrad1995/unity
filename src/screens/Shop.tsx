import { useEffect, useMemo, useState } from 'react'
import { BellIcon, CameraIcon, HeartIcon, SearchIcon } from '../art'
import type { Alerts } from '../alerts'
import { APP_NAME, CATEGORIES, FEATURED, SIZES, arrivesBefore, arrivesBy, conditionLabel, featuredFor, type Listing } from '../data'
import { useGoing } from '../going'
import { findEvent } from '../events'
import { bumpStat, readProfile, type Store } from '../store'
import { hasSignals, note, noteSearch, readTaste, score } from '../taste'
import { Card } from './Card'
import { BackFrom, Countdown } from './Countdown'

type Sort = 'you' | 'new' | 'low' | 'high'

export default function Shop({ store, alerts, initialBrand = '', forEvent }: { store: Store; alerts: Alerts; initialBrand?: string; forEvent?: string }) {
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState(initialBrand)
  const [category, setCategory] = useState('')
  // Shoppers who saved their sizes on You start with just those.
  const [profile] = useState(readProfile)
  const [size, setSize] = useState(profile.sizes.length > 0 ? 'mine' : '')
  // With a festival marked, shoppers can keep only what should arrive before it.
  // A festival picked from Events ("Find a fit") wins over the next one on your list.
  const picked = forEvent ? findEvent(forEvent) : undefined
  const goingNext = useGoing().nextDated
  const nextFest = picked && !picked.tba ? picked : goingNext
  const [arrive, setArrive] = useState<'' | 'week' | 'fortnight' | 'fest'>(picked && !picked.tba ? 'fest' : '')
  const timeFilter = arrive === 'fest' && nextFest ? nextFest : undefined
  // What this shopper is into, read once per visit so the order doesn't jump while they browse.
  const [taste] = useState(readTaste)
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
    // Example spots stay on the "Feature your brand" page; only real partners join the brand row.
    () => [...FEATURED.filter((f) => !f.example).map((f) => f.brand), ...listedBrands.filter((b) => !featuredFor(b))],
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
      if (size === 'mine' ? !(profile.sizes.includes(l.size) || l.size === 'One size') : size && l.size !== size) return false
      if (timeFilter && !arrivesBefore(l, timeFilter.date)) return false
      if (arrive === 'week' || arrive === 'fortnight') {
        const by = arrivesBy(l)
        if (!by || by.getTime() > Date.now() + (arrive === 'week' ? 7 : 14) * 86_400_000) return false
      }
      const hay = `${l.title} ${l.brand} ${l.category} ${l.size} ${conditionLabel(l.condition)} ${l.description} ${l.wornAt ?? ''}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
    if (sort === 'you') out.sort((a, b) => score(b, taste, profile) - score(a, taste, profile) || b.createdAt - a.createdAt)
    else if (sort === 'low') out.sort((a, b) => a.price - b.price)
    else if (sort === 'high') out.sort((a, b) => b.price - a.price)
    else out.sort((a, b) => b.createdAt - a.createdAt)
    return out
  }, [store.listings, query, brand, category, size, sort, taste, profile, timeFilter, arrive])

  const filtered = Boolean(query || brand || category || size || arrive)
  const clear = () => {
    setQuery('')
    setBrand('')
    setCategory('')
    setSize('')
    setArrive('')
  }
  // Real outfits first. Samples only fill the shop until there is real stock, under their own heading.
  const real = results.filter((l) => !l.sample)
  const samples = results.filter((l) => l.sample)

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <div className="top-brand">
            <a href="#/" className="wordmark">
              {APP_NAME}
            </a>
            <span className="top-links">
              <a href="#/alerts" className="saved-link bell-link" aria-label={alerts.fresh > 0 ? `Matches: ${alerts.fresh} new ${alerts.fresh === 1 ? 'outfit' : 'outfits'}` : 'Matches'}>
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
      </header>

      <main className="page">
        <BackFrom />
        <Countdown />
        <div className="bubbles brand-row" role="group" aria-label="Brand">
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
                {b}
              </button>
            )
          })}
        </div>

        <div className="filter-row">
          <label className={`chip-select${category ? ' is-set' : ''}`}>
            <span className="sr-only">Type</span>
            <select value={category} onChange={(e) => { if (e.target.value) note('categories', e.target.value); setCategory(e.target.value) }}>
              <option value="">All types</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className={`chip-select${size ? ' is-set' : ''}`}>
            <span className="sr-only">Size</span>
            <select value={size} onChange={(e) => { if (e.target.value && e.target.value !== 'mine') note('sizes', e.target.value); setSize(e.target.value) }}>
              <option value="">Any size</option>
              {profile.sizes.length > 0 && <option value="mine">My sizes ({profile.sizes.join(', ')})</option>}
              {SIZES.map((s) => <option key={s} value={s}>Size {s}</option>)}
            </select>
          </label>
          <label className={`chip-select${arrive ? ' is-set' : ''}`}>
            <span className="sr-only">Arrives</span>
            <select value={arrive} onChange={(e) => setArrive(e.target.value as typeof arrive)}>
              <option value="">Arrives any time</option>
              {nextFest && <option value="fest">Before {nextFest.name}</option>}
              <option value="week">Within a week</option>
              <option value="fortnight">Within 2 weeks</option>
            </select>
          </label>
          <label className="chip-select">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="you">Picked for you</option>
              <option value="new">Newest first</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          </label>
        </div>

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

        <div className="results-bar" aria-live="polite">
          <p>{real.length === 0 ? 'Nothing for sale yet' : `${real.length} ${real.length === 1 ? 'outfit' : 'outfits'}${brand ? ` from ${brand}` : ''}`}</p>
          {filtered && <button type="button" className="link-btn" onClick={clear}>Clear filters</button>}
        </div>

        {real.length > 0 && <Grid items={real.slice(0, 4)} store={store} />}
        {real.length > 0 && <InspoStrip store={store} />}
        {real.length > 4 && <Grid items={real.slice(4)} store={store} />}

        {samples.length > 0 && (
          <section className="samples" aria-labelledby="samples-h">
            <div className="samples-head">
              <h2 id="samples-h">Real outfits land here first</h2>
              <p>Until then, these examples show how a listing looks. None of them are for sale.</p>
              <a className="btn btn-soft" href="#/alerts">Tell me when my size is listed</a>
            </div>
            <Grid items={samples.slice(0, 4)} store={store} />
            {real.length === 0 && <InspoStrip store={store} />}
            {samples.length > 4 && <Grid items={samples.slice(4)} store={store} />}
          </section>
        )}

        {results.length === 0 && (
          <div className="empty">
            <h2>Nothing matches yet</h2>
            <p>{timeFilter || arrive
              ? `Nothing is sure to arrive ${timeFilter ? `before ${timeFilter.name}` : 'that soon'} yet. Some sellers haven’t said how fast they ship, so it’s worth messaging them to ask.`
              : 'Try a different brand or size, or clear your filters to see everything.'}</p>
            <button type="button" className="btn" onClick={clear}>Show all outfits</button>
          </div>
        )}

        <p className="fineprint">
          Outfits are listed by real people. {APP_NAME} is not affiliated with the brands listed.
        </p>
        <a className="btn btn-soft btn-wide" href="#/for-brands">Run a rave brand? Feature it on {APP_NAME}</a>
      </main>
    </>
  )
}

function Grid({ items, store }: { items: Listing[]; store: Store }) {
  return <ul className="grid">{items.map((l) => <Card key={l.id} listing={l} store={store} />)}</ul>
}

/** A small doorway to Inspo at the top of the shop: the fit of the week when there is one. */
function InspoStrip({ store }: { store: Store }) {
  const fit = store.fit ? store.looks.find((l) => l.id === store.fit!.lookId) : undefined
  const who = fit ? store.people[fit.ownerId]?.name.trim() : ''
  return (
    <a className="inspo-strip" href="#/inspo">
      {fit ? <img src={`/api/photo/${fit.id}/0`} alt="" /> : <span className="inspo-strip-art"><CameraIcon /></span>}
      <span>
        <strong>{fit ? 'Fit of the week' : 'Inspo'}</strong>
        <span>{fit ? `${who || 'Someone'} wearing ${fit.brands.slice(0, 2).join(' and ') || 'their best look'}` : 'See how people style their outfits, and post yours'}</span>
      </span>
    </a>
  )
}
