import { useState, type FormEvent } from 'react'
import { CameraIcon, CloseIcon, PlusIcon, Sparkle } from '../art'
import { APP_NAME, BRANDS, cleanBrand } from '../data'
import { NO_ONE, nameOf, shrinkPhoto, type Look, type Store } from '../store'
import { Avatar } from './ProfilePage'
import { PageHeader } from './PageHeader'
import { RoleBadge } from './Team'

const MAX_LOOK_PHOTOS = 4
const photoUrl = (look: Look, n = 0) => `/api/photo/${look.id}/${n}`

function Poster({ store, id }: { store: Store; id: string }) {
  const person = store.people[id] ?? NO_ONE
  return (
    <span className="poster">
      <Avatar profile={person} size={28} />
      <span>{id === store.me ? 'You' : nameOf(person)}</span>
      <RoleBadge role={store.roles[id]} />
    </span>
  )
}

function LookTile({ store, look }: { store: Store; look: Look }) {
  return (
    <li className="look-tile">
      <a href={`#/look/${look.id}`}>
        <img src={photoUrl(look)} alt={look.caption || 'An outfit look'} loading="lazy" decoding="async" />
        <span className="look-tile-foot">
          <Poster store={store} id={look.ownerId} />
          {look.brands.length > 0 && <span className="look-brands">{look.brands.join(' · ')}</span>}
        </span>
      </a>
    </li>
  )
}

export function InspoPage({ store }: { store: Store }) {
  const fitLook = store.fit ? store.looks.find((l) => l.id === store.fit!.lookId) : undefined
  const ownerIds = Object.entries(store.roles).filter(([, r]) => r === 'owner').map(([id]) => id)
  const ownerLooks = store.looks.filter((l) => ownerIds.includes(l.ownerId))
  const ownerName = ownerIds.map((id) => store.people[id]?.name.trim()).find(Boolean)
  const rest = store.looks.filter((l) => !ownerIds.includes(l.ownerId) && l.id !== fitLook?.id)

  return (
    <>
      <PageHeader title="Inspo" />
      <main className="page inspo">
        <a className="btn btn-wide" href="#/inspo/new"><PlusIcon /> Post your look</a>

        {fitLook && (
          <section aria-labelledby="fit-h" className="fit-week">
            <h2 id="fit-h" className="section-h section-h-in"><Sparkle size={20} /> Fit of the week</h2>
            <a href={`#/look/${fitLook.id}`} className="fit-card">
              <img src={photoUrl(fitLook)} alt={fitLook.caption || 'Fit of the week'} />
              <span className="fit-body">
                <Poster store={store} id={fitLook.ownerId} />
                {store.fit!.note && <span className="fit-note">“{store.fit!.note}”</span>}
                {fitLook.brands.length > 0 && <span className="look-brands">Wearing {fitLook.brands.join(', ')}</span>}
              </span>
            </a>
          </section>
        )}

        {ownerLooks.length > 0 && (
          <section aria-labelledby="owner-h">
            <h2 id="owner-h" className="section-h">{ownerName ? `${ownerName}’s favourites` : 'The owner’s favourites'}</h2>
            <p className="hint section-sub">Outfits and styling picked by the shop owner.</p>
            <ul className="look-row">
              {ownerLooks.map((l) => <LookTile key={l.id} store={store} look={l} />)}
            </ul>
          </section>
        )}

        <section aria-labelledby="latest-h">
          <h2 id="latest-h" className="section-h">Latest looks</h2>
          {rest.length > 0 ? (
            <ul className="look-grid">
              {rest.map((l) => <LookTile key={l.id} store={store} look={l} />)}
            </ul>
          ) : (
            <div className="empty">
              <h2>No looks yet</h2>
              <p>Share what you wore and the brands you put together. The team picks a fit of the week from these.</p>
              <a className="btn" href="#/inspo/new">Post your look</a>
            </div>
          )}
        </section>
        <p className="fineprint">No likes, no follower counts. Just outfits worth stealing ideas from.</p>
      </main>
    </>
  )
}

export function LookPage({ store, id }: { store: Store; id: string }) {
  const look = store.looks.find((l) => l.id === id)
  const [shot, setShot] = useState(0)
  const [note, setNote] = useState('')
  if (!look) {
    return (
      <>
        <PageHeader title="Look" back="#/inspo" backLabel="Back to Inspo" />
        <main className="page">
          <div className="empty">
            <h2>{store.online === null ? 'Loading…' : 'This look is gone'}</h2>
            {store.online !== null && <a className="btn" href="#/inspo">Back to Inspo</a>}
          </div>
        </main>
      </>
    )
  }
  const mine = look.ownerId === store.me
  const isFit = store.fit?.lookId === look.id
  const poster = store.people[look.ownerId] ?? NO_ONE

  return (
    <>
      <PageHeader title={mine ? 'Your look' : nameOf(poster)} back="#/inspo" backLabel="Back to Inspo" />
      <main className="page detail">
        <div className="detail-gallery">
          <div className="detail-photo">
            <img className="photo" src={photoUrl(look, shot)} alt={look.caption || 'An outfit look'} />
            {isFit && <span className="fit-flag"><Sparkle size={14} /> Fit of the week</span>}
          </div>
          {look.photoCount > 1 && (
            <ul className="thumbs" aria-label="More photos">
              {Array.from({ length: look.photoCount }, (_, i) => (
                <li key={i}>
                  <button type="button" aria-label={`Show photo ${i + 1} of ${look.photoCount}`} aria-current={i === shot ? 'true' : undefined} onClick={() => setShot(i)}>
                    <img src={photoUrl(look, i)} alt="" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="detail-info">
          <Poster store={store} id={look.ownerId} />
          {look.caption && <p className="detail-desc">{look.caption}</p>}
          {look.brands.length > 0 && (
            <div className="field">
              <span>Brands in this look</span>
              <div className="bubbles bubbles-wrap">
                {look.brands.map((b) => <a key={b} className="bubble" href={`#/brand/${encodeURIComponent(b)}`}>{b}</a>)}
              </div>
            </div>
          )}
          {!mine && look.ownerId && <a className="btn btn-soft" href={`#/chats/${look.ownerId}`}>Say hi to {nameOf(poster)}</a>}

          {store.myRole && (
            <section className="step team-box" aria-label="Team tools">
              <h2 className="section-h section-h-in">Team tools</h2>
              {isFit ? (
                <button type="button" className="btn btn-soft" onClick={() => store.pickFit(null)}>Stop featuring as fit of the week</button>
              ) : (
                <>
                  <label className="field">
                    <span>Why it’s the fit of the week (optional)</span>
                    <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder="The layering on this is unreal" />
                  </label>
                  <button type="button" className="btn" onClick={() => store.pickFit(look.id, note)}>Make this the fit of the week</button>
                </>
              )}
            </section>
          )}
          {(mine || store.myRole) && (
            <button type="button" className="link-btn danger" onClick={() => {
              if (window.confirm('Remove this look? This cannot be undone.')) store.removeLook(look.id).then(() => { window.location.hash = '#/inspo' })
            }}>
              {mine ? 'Remove my look' : 'Remove this look (team)'}
            </button>
          )}
        </div>
      </main>
    </>
  )
}

export function PostLook({ store }: { store: Store }) {
  const [photos, setPhotos] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [brands, setBrands] = useState<string[]>([])
  const [brandText, setBrandText] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  async function onPhotos(files: FileList | null) {
    if (!files) return
    const added: string[] = []
    for (const f of Array.from(files).slice(0, MAX_LOOK_PHOTOS - photos.length)) {
      try {
        added.push(await shrinkPhoto(f))
      } catch {
        setProblem('One of those files could not be opened. Try a JPG or PNG photo.')
      }
    }
    setPhotos((cur) => [...cur, ...added].slice(0, MAX_LOOK_PHOTOS))
  }
  function addBrand() {
    const b = cleanBrand(brandText)
    if (b && !brands.some((x) => x.toLowerCase() === b.toLowerCase())) setBrands([...brands, b].slice(0, 8))
    setBrandText('')
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (photos.length === 0) {
      setProblem('Add at least one photo of your look.')
      return
    }
    setBusy(true)
    const all = brandText.trim() ? [...brands, cleanBrand(brandText)] : brands
    const id = await store.addLook({ caption, brands: all, photos })
    setBusy(false)
    if (id) window.location.hash = `#/look/${id}`
    else setProblem(`Your look could not be posted. Check your connection and try again.`)
  }

  return (
    <>
      <PageHeader title="Post a look" back="#/inspo" backLabel="Back to Inspo" />
      <main className="page">
        <form className="sell" onSubmit={submit} noValidate>
          <fieldset className="step">
            <legend><span className="step-n">1</span> Your photos</legend>
            <p className="hint">A clear, well-lit picture of the whole outfit. Up to {MAX_LOOK_PHOTOS}.</p>
            {photos.length === 0 ? (
              <label className="photo-drop">
                <span className="photo-drop-empty">
                  <CameraIcon />
                  <strong>Tap to add photos</strong>
                  <span>Only post photos of yourself, or of people who said yes.</span>
                </span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void onPhotos(e.target.files); e.target.value = '' }} />
              </label>
            ) : (
              <ul className="photo-grid">
                {photos.map((p, i) => (
                  <li key={p.slice(-40) + i} className="photo-tile">
                    <img src={p} alt={`Photo ${i + 1}`} />
                    <button type="button" className="tile-x" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos(photos.filter((_, j) => j !== i))}><CloseIcon /></button>
                  </li>
                ))}
                {photos.length < MAX_LOOK_PHOTOS && (
                  <li className="photo-tile photo-add">
                    <label><PlusIcon /><span>Add more</span>
                      <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void onPhotos(e.target.files); e.target.value = '' }} />
                    </label>
                  </li>
                )}
              </ul>
            )}
          </fieldset>

          <fieldset className="step">
            <legend><span className="step-n">2</span> Tell people about it</legend>
            <label className="field">
              <span>Caption</span>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={300} placeholder="Where you wore it, how you styled it" />
            </label>
            <div className="field">
              <label htmlFor="look-brand">Brands you’re wearing</label>
              {brands.length > 0 && (
                <ul className="chips">
                  {brands.map((b) => (
                    <li key={b}>{b}<button type="button" aria-label={`Remove ${b}`} onClick={() => setBrands(brands.filter((x) => x !== b))}><CloseIcon /></button></li>
                  ))}
                </ul>
              )}
              <div className="add-row">
                <input id="look-brand" list="look-brand-list" value={brandText} onChange={(e) => setBrandText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBrand() } }} placeholder="Start typing a brand" maxLength={40} autoComplete="off" />
                <datalist id="look-brand-list">{BRANDS.map((b) => <option key={b} value={b} />)}</datalist>
                <button type="button" className="btn btn-soft" onClick={addBrand} disabled={!brandText.trim()}>Add</button>
              </div>
            </div>
          </fieldset>

          {problem && <p className="error" role="alert">{problem}</p>}
          <button type="submit" className="btn btn-wide btn-big" disabled={busy}>{busy ? 'Posting your look' : 'Post my look'}</button>
          <p className="fineprint">Your look shows on {APP_NAME}’s Inspo page. The team may pick it as fit of the week.</p>
        </form>
      </main>
    </>
  )
}
