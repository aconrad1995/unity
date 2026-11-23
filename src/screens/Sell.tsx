import { useEffect, useState, type FormEvent } from 'react'
import { CameraIcon, CheckIcon, CloseIcon, PlusIcon } from '../art'
import { APP_NAME, BRANDS, cleanBrand, CATEGORIES, CONDITIONS, SHIP_OPTIONS, SIZES, type Category, type ShipDays, type ConditionId, type Listing, type Size } from '../data'
import { answerBackFrom, useGoing, wornLabel } from '../going'
import { lastDay } from '../events'
import { shrinkPhoto, type Store } from '../store'
import { PageHeader } from './PageHeader'

const MAX_PHOTOS = 5
// A half-finished outfit is kept while you look around the app, so tapping away never loses it.
const DRAFT_KEY = 'unity.sellDraft.v1'
type Draft = { photos: string[]; title: string; brand: string; category: Category | ''; size: Size | ''; condition: ConditionId | ''; price: string; description: string; wornAt: string; shipDays: ShipDays | 0 }
const BLANK: Draft = { photos: [], title: '', brand: '', category: '', size: '', condition: '', price: '', description: '', wornAt: '', shipDays: 0 }
function readDraft(): Draft {
  try {
    return { ...BLANK, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}') }
  } catch {
    return BLANK
  }
}
/** Keeps digits and one decimal point, so "45.50" stays 45.50 instead of turning into 4550. */
const cleanPrice = (v: string) => v.replace(/[^\d.]/g, '').replace(/^(\d*\.?\d{0,2}).*$/, '$1').slice(0, 7)

export default function Sell({ store, wornFrom }: { store: Store; wornFrom?: string }) {
  const [draft] = useState(readDraft)
  const going = useGoing()
  // Opened from "Back from…": that festival is filled in.
  const fromEvent = wornFrom ? going.list.find((x) => x.id === wornFrom) : undefined
  const [wornAt, setWornAt] = useState(fromEvent ? wornLabel(fromEvent) : draft.wornAt)
  const today = new Date().toISOString().slice(0, 10)
  const wornChoices = going.list.filter((x) => x.date <= today || lastDay(x) < today).map(wornLabel)
  const [photos, setPhotos] = useState<string[]>(draft.photos)
  const [title, setTitle] = useState(draft.title)
  const [brand, setBrand] = useState(draft.brand)
  const [category, setCategory] = useState<Category | ''>(draft.category)
  const [size, setSize] = useState<Size | ''>(draft.size)
  const [condition, setCondition] = useState<ConditionId | ''>(draft.condition)
  const [price, setPrice] = useState(draft.price)
  const [description, setDescription] = useState(draft.description)
  const [shipDays, setShipDays] = useState<ShipDays | 0>(draft.shipDays)
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  /** Clears a field's error as soon as it is fixed. */
  const fixed = (key: string) => setErrors((e) => (e[key] || e.form ? { ...e, [key]: '', form: '' } : e))

  useEffect(() => {
    const d: Draft = { photos, title, brand, category, size, condition, price, description, wornAt, shipDays }
    try {
      if (JSON.stringify(d) === JSON.stringify(BLANK)) sessionStorage.removeItem(DRAFT_KEY)
      else sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d))
    } catch {
      try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, photos: [] })) } catch { /* the draft is a nicety */ }
    }
  }, [photos, title, brand, category, size, condition, price, description, wornAt, shipDays])

  async function onPhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    const room = MAX_PHOTOS - photos.length
    const added: string[] = []
    let unreadable = 0
    for (const file of Array.from(files).slice(0, room)) {
      try {
        added.push(await shrinkPhoto(file))
      } catch {
        unreadable++
      }
    }
    setPhotos((cur) => [...cur, ...added].slice(0, MAX_PHOTOS))
    if (added.length > 0) fixed('photo')
    const skipped = files.length - room
    setErrors((e) => ({
      ...e,
      photo: unreadable > 0
        ? 'One of those files could not be opened. Try a JPG or PNG photo.'
        : skipped > 0 ? `You can add up to ${MAX_PHOTOS} photos, so the extras were left out.` : '',
    }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = Number(price)
    const next: Record<string, string> = {}
    if (photos.length === 0) next.photo = 'Add at least one photo of your outfit.'
    if (!title.trim()) next.title = 'Give your outfit a short name.'
    if (!cleanBrand(brand)) next.brand = 'Type or pick the brand.'
    if (!category) next.category = 'Pick what kind of item it is.'
    if (!size) next.size = 'Pick the size.'
    if (!condition) next.condition = 'Choose how worn it is.'
    if (!price || !Number.isFinite(amount) || amount < 1) next.price = 'Enter a price of $1 or more.'
    else if (amount > 10000) next.price = 'The most an outfit can be listed for is $10,000.'
    if (!shipDays) next.ship = 'Pick how fast you can send it.'
    setErrors(next)
    if (Object.keys(next).length > 0 || !category || !size || !condition || !shipDays) {
      setTimeout(() => {
        // Put the keyboard and screen reader on the first thing to fix, not the submit button.
        const first = document.querySelector('[data-error="true"]')
        const field = first?.previousElementSibling
        const control = field?.matches('input, textarea, button') ? field : field?.querySelector<HTMLElement>('input, textarea, button')
        ;(control as HTMLElement | null | undefined)?.focus({ preventScroll: true })
        first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 50)
      return
    }

    const listing: Listing = {
      id: `mine-${Date.now()}`,
      title: title.trim(),
      brand: cleanBrand(brand),
      category,
      size,
      condition,
      price: Math.round(amount),
      description: description.trim() || 'No description added.',
      shipDays,
      ...(wornAt.trim() ? { wornAt: wornAt.trim().slice(0, 60) } : {}),
      seller: 'You',
      sample: false,
      createdAt: Date.now(),
    }
    setSending(true)
    const { id: newId, why } = await store.addListing(listing, photos)
    setSending(false)
    if (!newId) {
      setErrors({ form: why })
      return
    }
    if (wornFrom) answerBackFrom(wornFrom)
    try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* nothing to clear */ }
    try { sessionStorage.setItem('unity.justListed', newId) } catch { /* banner is optional */ }
    window.location.hash = `#/item/${newId}`
  }

  // Field errors are tied to their field and read when it gets focus; only a failed send interrupts.
  const err = (key: string) => errors[key]
    ? <p className="error" id={`sell-err-${key}`} data-error="true" role={key === 'form' ? 'alert' : undefined}>{errors[key]}</p>
    : null
  const about = (key: string) => errors[key] ? { 'aria-invalid': true, 'aria-describedby': `sell-err-${key}` } : {}

  return (
    <>
      <PageHeader title="Sell an outfit" noBack />
      <main className="page">
        {fromEvent && <p className="sell-from">Back from <strong>{fromEvent.name}</strong>. This outfit will be tagged as worn there.</p>}
        <form className="sell" onSubmit={submit} noValidate>
          <fieldset className="step">
            <legend><span className="step-n">1</span> Add your photos</legend>
            {photos.length === 0 ? (
              <label className="photo-drop">
                <span className="photo-drop-empty">
                  <CameraIcon />
                  <strong>Tap to add photos</strong>
                  <span>Add a clear picture of the outfit you’re selling, taken in good lighting. Up to {MAX_PHOTOS} photos; the first one is the cover.</span>
                </span>
                <input type="file" accept="image/*" multiple className="sr-only" {...about('photo')} onChange={(e) => { void onPhotos(e.target.files); e.target.value = '' }} />
              </label>
            ) : (
              <ul className="photo-grid" aria-label="Your photos">
                {photos.map((p, i) => (
                  <li key={p.slice(-40) + i} className="photo-tile">
                    <img src={p} alt={`Photo ${i + 1}`} />
                    {i === 0 ? <span className="cover-tag">Cover</span> : (
                      <button type="button" className="cover-btn" onClick={() => setPhotos((cur) => [cur[i], ...cur.filter((_, j) => j !== i)])}>Make cover</button>
                    )}
                    <button type="button" className="tile-x" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos((cur) => cur.filter((_, j) => j !== i))}><CloseIcon /></button>
                  </li>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <li className="photo-tile photo-add">
                    <label>
                      <PlusIcon />
                      <span>Add more</span>
                      <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void onPhotos(e.target.files); e.target.value = '' }} />
                    </label>
                  </li>
                )}
              </ul>
            )}
            {err('photo')}
          </fieldset>

          <fieldset className="step">
            <legend><span className="step-n">2</span> Tell us what it is</legend>
            <label className="field">
              <span>Name</span>
              <input value={title} onChange={(e) => { setTitle(e.target.value); fixed('title') }} placeholder="Pink sparkle two-piece set" maxLength={60} {...about('title')} />
            </label>
            {err('title')}
            <label className="field">
              <span>Brand</span>
              <input
                list="brand-list"
                value={brand}
                onChange={(e) => { setBrand(e.target.value); fixed('brand') }}
                onBlur={() => setBrand(cleanBrand(brand))}
                placeholder="Start typing, like Badinka"
                maxLength={40}
                autoComplete="off"
                {...about('brand')}
              />
              <datalist id="brand-list">
                {BRANDS.map((b) => <option key={b} value={b} />)}
              </datalist>
              <span className="hint">Pick from the list, or type any brand that isn’t on it.</span>
            </label>
            {err('brand')}
            <div className="field" role="group" aria-labelledby="kind-l" {...about('category')}>
              <span id="kind-l">Kind of item</span>
              <div className="bubbles bubbles-wrap">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" className="bubble" aria-pressed={category === c} onClick={() => { setCategory(c); fixed('category') }}>{c}</button>
                ))}
              </div>
            </div>
            {err('category')}
            <div className="field" role="group" aria-labelledby="size-l" {...about('size')}>
              <span id="size-l">Size</span>
              <div className="bubbles bubbles-wrap">
                {SIZES.map((s) => (
                  <button key={s} type="button" className="bubble" aria-pressed={size === s} onClick={() => { setSize(s); fixed('size') }}>{s}</button>
                ))}
              </div>
            </div>
            {err('size')}
          </fieldset>

          <fieldset className="step">
            <legend><span className="step-n">3</span> How worn is it?</legend>
            <div className="choices" role="radiogroup" aria-label="How worn is it?" {...about('condition')}>
              {CONDITIONS.map((c) => (
                <label key={c.id} className={`choice${condition === c.id ? ' is-on' : ''}`}>
                  <input type="radio" name="condition" className="sr-only" checked={condition === c.id} onChange={() => { setCondition(c.id); fixed('condition') }} />
                  <span className="choice-check"><CheckIcon /></span>
                  <span>
                    <strong>{c.label}</strong>
                    <span className="choice-help">{c.help}</span>
                  </span>
                </label>
              ))}
            </div>
            {err('condition')}
            <label className="field">
              <span>Anything buyers should know? (optional)</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={400} placeholder="Fit, flaws, how it was washed" />
            </label>
            <label className="field">
              <span>Worn at a festival? (optional)</span>
              <input list="worn-list" value={wornAt} onChange={(e) => setWornAt(e.target.value)} placeholder="Like Tahoe Live 2026" maxLength={60} autoComplete="off" />
              <datalist id="worn-list">
                {wornChoices.map((w) => <option key={w} value={w} />)}
              </datalist>
              <span className="hint">Shoppers can search by festival, and it shows on your listing.</span>
            </label>
          </fieldset>

          <fieldset className="step">
            <legend><span className="step-n">4</span> Price and shipping</legend>
            <label className="field price-field">
              <span>Price in dollars</span>
              <span className="price-input">
                <span aria-hidden="true">$</span>
                <input inputMode="decimal" value={price} onChange={(e) => { setPrice(cleanPrice(e.target.value)); fixed('price') }} placeholder="e.g. 30" maxLength={7} {...about('price')} />
              </span>
            </label>
            <span className="hint">Whole dollars work best. Cents are rounded, so $45.50 lists as $46.</span>
            {err('price')}
            <div className="field" role="group" aria-labelledby="ship-l" {...about('ship')}>
              <span id="ship-l">How fast can you send it?</span>
              <span className="hint">Buyers heading to a festival filter by what arrives in time.</span>
              <div className="bubbles bubbles-wrap">
                {SHIP_OPTIONS.map((o) => (
                  <button key={o.days} type="button" className="bubble" aria-pressed={shipDays === o.days} onClick={() => { setShipDays(o.days); fixed('ship') }}>{o.label}</button>
                ))}
              </div>
            </div>
            {err('ship')}
          </fieldset>

          {err('form')}
          <button type="submit" className="btn btn-wide btn-big" disabled={sending}>{sending ? 'Listing your outfit' : 'List my outfit'}</button>
          <p className="fineprint">Your outfit shows in the shop for everyone using {APP_NAME}. You can edit it, or mark it sold, from its page.</p>
        </form>
      </main>
    </>
  )
}
