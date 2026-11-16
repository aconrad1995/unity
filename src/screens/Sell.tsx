import { useState, type FormEvent } from 'react'
import { CameraIcon, CheckIcon } from '../art'
import { APP_NAME, ART_FOR_CATEGORY, BRANDS, cleanBrand, CATEGORIES, CONDITIONS, SIZES, type Category, type ConditionId, type Listing, type Size } from '../data'
import { shrinkPhoto, type Store } from '../store'
import { PageHeader } from './PageHeader'

export default function Sell({ store }: { store: Store }) {
  const [photo, setPhoto] = useState('')
  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState<Category | ''>('')
  const [size, setSize] = useState<Size | ''>('')
  const [condition, setCondition] = useState<ConditionId | ''>('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function onPhoto(file: File | undefined) {
    if (!file) return
    try {
      setPhoto(await shrinkPhoto(file))
      setErrors((e) => ({ ...e, photo: '' }))
    } catch {
      setErrors((e) => ({ ...e, photo: 'That file could not be opened. Try a JPG or PNG photo.' }))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = Number(price)
    const next: Record<string, string> = {}
    if (!title.trim()) next.title = 'Give your outfit a short name.'
    if (!cleanBrand(brand)) next.brand = 'Type or pick the brand.'
    if (!category) next.category = 'Pick what kind of item it is.'
    if (!size) next.size = 'Pick the size.'
    if (!condition) next.condition = 'Choose how worn it is.'
    if (!price || !Number.isFinite(amount) || amount < 1) next.price = 'Enter a price of $1 or more.'
    setErrors(next)
    if (Object.keys(next).length > 0 || !category || !size || !condition) {
      setTimeout(() => document.querySelector('[data-error="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50)
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
      seller: 'You',
      sample: false,
      createdAt: Date.now(),
      photo: photo || undefined,
      art: photo ? undefined : { kind: ART_FOR_CATEGORY[category], bg: '#FFE1EF', fill: '#6BC1FF', accent: '#FFFFFF' },
    }
    setSending(true)
    const newId = await store.addListing(listing)
    setSending(false)
    if (!newId) {
      setErrors({ form: `Your outfit could not be saved because ${APP_NAME} could not be reached. Check your connection and try again.` })
      return
    }
    try { sessionStorage.setItem('unity.justListed', newId) } catch { /* banner is optional */ }
    window.location.hash = `#/item/${newId}`
  }

  const err = (key: string) => errors[key] ? <p className="error" data-error="true" role="alert">{errors[key]}</p> : null

  return (
    <>
      <PageHeader title="Sell an outfit" />
      <main className="page">
        <form className="sell" onSubmit={submit} noValidate>
          <fieldset className="step">
            <legend><span className="step-n">1</span> Add a photo</legend>
            <label className={`photo-drop${photo ? ' has-photo' : ''}`}>
              {photo ? <img src={photo} alt="Your outfit" /> : (
                <span className="photo-drop-empty">
                  <CameraIcon />
                  <strong>Tap to add a photo</strong>
                  <span>Good light, plain background. You can skip this for now.</span>
                </span>
              )}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
            {photo && <button type="button" className="link-btn" onClick={() => setPhoto('')}>Remove photo</button>}
            {err('photo')}
          </fieldset>

          <fieldset className="step">
            <legend><span className="step-n">2</span> Tell us what it is</legend>
            <label className="field">
              <span>Name</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pink sparkle two-piece set" maxLength={60} />
            </label>
            {err('title')}
            <label className="field">
              <span>Brand</span>
              <input
                list="brand-list"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                onBlur={() => setBrand(cleanBrand(brand))}
                placeholder="Start typing, like Badinka"
                maxLength={40}
                autoComplete="off"
              />
              <datalist id="brand-list">
                {BRANDS.map((b) => <option key={b} value={b} />)}
              </datalist>
              <span className="hint">Pick from the list, or type any brand that isn’t on it.</span>
            </label>
            {err('brand')}
            <div className="field" role="group" aria-labelledby="kind-l">
              <span id="kind-l">Kind of item</span>
              <div className="bubbles bubbles-wrap">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" className="bubble bubble-blue" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
                ))}
              </div>
            </div>
            {err('category')}
            <div className="field" role="group" aria-labelledby="size-l">
              <span id="size-l">Size</span>
              <div className="bubbles bubbles-wrap">
                {SIZES.map((s) => (
                  <button key={s} type="button" className="bubble" aria-pressed={size === s} onClick={() => setSize(s)}>{s}</button>
                ))}
              </div>
            </div>
            {err('size')}
          </fieldset>

          <fieldset className="step">
            <legend><span className="step-n">3</span> How worn is it?</legend>
            <div className="choices">
              {CONDITIONS.map((c) => (
                <label key={c.id} className={`choice${condition === c.id ? ' is-on' : ''}`}>
                  <input type="radio" name="condition" className="sr-only" checked={condition === c.id} onChange={() => setCondition(c.id)} />
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
          </fieldset>

          <fieldset className="step">
            <legend><span className="step-n">4</span> Set your price</legend>
            <label className="field price-field">
              <span>Price in dollars</span>
              <span className="price-input">
                <span aria-hidden="true">$</span>
                <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder="30" maxLength={4} />
              </span>
            </label>
            {err('price')}
          </fieldset>

          {err('form')}
          <button type="submit" className="btn btn-wide btn-big" disabled={sending}>{sending ? 'Listing your outfit' : 'List my outfit'}</button>
          <p className="fineprint">This is a preview. Your listing is saved on this device only and no one else can see it yet.</p>
        </form>
      </main>
    </>
  )
}
