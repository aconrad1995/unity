import { useEffect, useState } from 'react'
import { InstallCard } from './InstallCard'
import { PushCard } from './PushCard'
import { CameraIcon, CloseIcon, InstagramIcon, ProfileIcon } from '../art'
import { APP_NAME, BRANDS, SIZES, UP_FOR, VIBES, cleanBrand } from '../data'
import { applyMoveCode, instagramOf, moveCode, shrinkPhoto, useProfile, type Store } from '../store'
import { readTaste, resetTaste, topOf } from '../taste'
import { Card } from './Card'
import { BackFrom, Countdown } from './Countdown'
import { PageHeader } from './PageHeader'
import { RoleBadge } from './Team'

export function Avatar({ profile, size = 96 }: { profile: { photo: string }; size?: number }) {
  return profile.photo ? (
    <img className="avatar" src={profile.photo} alt="" width={size} height={size} />
  ) : (
    <span className="avatar avatar-empty" style={{ width: size, height: size }} aria-hidden="true">
      <ProfileIcon />
    </span>
  )
}

function Picks({ label, hint, options, chosen, onChange, blue }: {
  label: string; hint?: string; options: readonly string[]; chosen: string[]; onChange: (next: string[]) => void; blue?: boolean
}) {
  const id = label.replace(/\W+/g, '-').toLowerCase()
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <span id={id}>{label}</span>
      {hint && <span className="hint">{hint}</span>}
      <div className="bubbles bubbles-wrap">
        {options.map((o) => {
          const on = chosen.includes(o)
          return (
            <button key={o} type="button" className={`bubble${blue ? ' bubble-blue' : ''}`} aria-pressed={on}
              onClick={() => onChange(on ? chosen.filter((x) => x !== o) : [...chosen, o])}>
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ProfilePage({ store }: { store: Store }) {
  const { profile, update, saveFailed } = useProfile()
  const [brandText, setBrandText] = useState('')
  const [photoProblem, setPhotoProblem] = useState('')
  const mine = store.mine
  const [taste, setTaste] = useState(readTaste)
  const learned = [
    ['Brands', topOf(taste.brands)],
    ['Types', topOf(taste.categories)],
    ['Sizes', topOf(taste.sizes)],
    ['Searches', topOf(taste.words)],
  ].filter(([, list]) => list.length > 0) as [string, string[]][]

  // "#/you/prefs" (from New for you) opens straight at the brands and sizes.
  useEffect(() => {
    if (window.location.hash.endsWith('/prefs')) setTimeout(() => document.getElementById('prefs-h')?.scrollIntoView({ block: 'start' }), 60)
  }, [])

  async function onPhoto(file: File | undefined) {
    if (!file) return
    try {
      update({ photo: await shrinkPhoto(file, 400) })
      setPhotoProblem('')
    } catch {
      setPhotoProblem('That file could not be opened. Try a JPG or PNG photo.')
    }
  }

  function addBrand() {
    const b = cleanBrand(brandText)
    if (b && !profile.brands.some((x) => x.toLowerCase() === b.toLowerCase())) update({ brands: [...profile.brands, b] })
    setBrandText('')
  }

  return (
    <>
      <PageHeader title="You" noBack />
      <main className="page profile">
        <BackFrom />
        <Countdown prompt />
        <InstallCard />
        <PushCard />
        <section className="step me">
          <label className="me-photo">
            <Avatar profile={profile} />
            <span className="me-photo-badge"><CameraIcon /></span>
            <span className="sr-only">{profile.photo ? 'Change your picture' : 'Add your picture'}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
          <div className="me-name">
            <label className="field">
              <span>Your name</span>
              <input value={profile.name} onChange={(e) => update({ name: e.target.value })} placeholder="What should people call you?" maxLength={30} autoComplete="nickname" />
            </label>
            <RoleBadge role={store.myRole} />
            {profile.photo && <button type="button" className="link-btn" onClick={() => update({ photo: '' })}>Remove picture</button>}
          </div>
          <label className="field me-insta">
            <span>Instagram</span>
            <span className="hint">Shows on your listings and seller page, so buyers can see how you style your fits.</span>
            <span className="insta-input"><InstagramIcon /><span aria-hidden="true">@</span>
              <input value={profile.instagram} onChange={(e) => update({ instagram: e.target.value.replace(/^@/, '') })}
                placeholder="yourhandle" maxLength={80} autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </span>
          </label>
          {profile.instagram.trim() && !instagramOf(profile.instagram) && <p className="error" role="alert">That doesn’t look like an Instagram handle. Use letters, numbers, dots and underscores, like glitter.babe_</p>}
          {store.handleRefused && <p className="error" role="alert">That Instagram name belongs to the {APP_NAME} team. Use your own handle.</p>}
          {store.me && <a className="inline-link me-seller-link" href={`#/seller/${store.me}`}>See your seller page and ratings</a>}
          {store.nameRefused && <p className="error" role="alert">That name is kept for the {APP_NAME} team, so others can’t pretend to be them. Pick a different name.</p>}
          {photoProblem && <p className="error" role="alert">{photoProblem}</p>}
          {saveFailed && <p className="error" role="alert">This device is out of storage space, so your changes may not be kept. Try a smaller picture.</p>}
        </section>

        <section aria-labelledby="closet-h">
          <h2 id="closet-h" className="section-h">My closet</h2>
          {mine.length > 0 ? (
            <ul className="grid">
              {mine.map((l) => <Card key={l.id} listing={l} store={store} />)}
            </ul>
          ) : (
            <div className="empty">
              <h2>Nothing listed yet</h2>
              <p>Outfits you put up for sale show here.</p>
              <a className="btn" href="#/sell">Sell an outfit</a>
            </div>
          )}
        </section>

        <section className="step" aria-labelledby="prefs-h">
          <h2 id="prefs-h" className="section-h section-h-in">My outfit preferences</h2>
          <Picks label="My sizes" options={SIZES} chosen={profile.sizes} onChange={(sizes) => update({ sizes })} />
          <Picks label="My style" hint="Pick as many as you like." options={VIBES} chosen={profile.vibes} onChange={(vibes) => update({ vibes })} blue />
          <div className="field">
            <label htmlFor="fav-brand">Favorite brands</label>
            {profile.brands.length > 0 && (
              <ul className="chips">
                {profile.brands.map((b) => (
                  <li key={b}>
                    {b}
                    <button type="button" aria-label={`Remove ${b}`} onClick={() => update({ brands: profile.brands.filter((x) => x !== b) })}><CloseIcon /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="add-row">
              <input id="fav-brand" list="fav-brand-list" value={brandText} onChange={(e) => setBrandText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBrand() } }}
                placeholder="Start typing a brand" maxLength={40} autoComplete="off" />
              <datalist id="fav-brand-list">{BRANDS.map((b) => <option key={b} value={b} />)}</datalist>
              <button type="button" className="btn btn-soft" onClick={addBrand} disabled={!brandText.trim()}>Add</button>
            </div>
          </div>
        </section>

        <section className="step" aria-labelledby="learned-h">
          <h2 id="learned-h" className="section-h section-h-in">What {APP_NAME} thinks you like</h2>
          <p>
            The shop puts your best matches first. It learns from what you search, the brands and types
            you tap, what you open and save, and the preferences above.
          </p>
          {learned.length > 0 ? (
            <>
              <dl className="learned">
                {learned.map(([label, list]) => (
                  <div key={label}><dt>{label}</dt><dd>{list.join(', ')}</dd></div>
                ))}
              </dl>
              <button type="button" className="link-btn" onClick={() => { resetTaste(); setTaste(readTaste()) }}>Forget what you’ve learned</button>
            </>
          ) : (
            <p className="hint">Nothing learned from your browsing yet.</p>
          )}
        </section>

        <section className="step" aria-labelledby="friends-h">
          <h2 id="friends-h" className="section-h section-h-in">Making friends</h2>
          <p>
            {APP_NAME} isn’t a social feed. No followers, no like counts. Friendships start in a message,
            from an outfit or an event you’re both into.
          </p>
          <Picks label="Say hi to me about" hint="This shows on your listings so people know what you’re up for. Leave it empty to keep messages about outfits only."
            options={UP_FOR} chosen={profile.upFor} onChange={(upFor) => update({ upFor })} />
          <a className="btn btn-soft" href="#/chats">Open my chats</a>
        </section>

        <div className="profile-links">
          <a className="btn btn-soft" href="#/inspo">Inspo and looks</a>
          <a className="btn btn-soft" href="#/alerts">New for you</a>
        </div>
        <a className="btn btn-soft" href="#/saved">My saved outfits{store.saved.length > 0 ? ` (${store.saved.length})` : ''}</a>

        <p className="fineprint">
          Other people can see your name, picture, Instagram, listings, ratings and “say hi about” picks. Your sizes, style,
          favorite brands and what the shop has learned stay private on this device.
        </p>
        <MoveAccount />

        <a className="btn btn-soft" href="#/team">{store.myRole ? 'Team tools' : `${APP_NAME} team sign-in`}</a>
      </main>
    </>
  )
}

/** Moves this account (listings, chats, team access) to Safari, the home-screen app or a new phone. */
function MoveAccount() {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState('')
  return (
    <details className="safety move">
      <summary>Use {APP_NAME} on another phone or browser</summary>
      <p>
        Your listings and chats belong to this phone’s browser. To keep them when you switch between Safari and the
        home-screen app, or move to a new phone, copy your move code here and paste it there.
      </p>
      <p className="hint">Keep this code private, like a password. Anyone with it can act as you.</p>
      {shown ? (
        <div className="move-code">
          <code>{moveCode()}</code>
          <button type="button" className="btn btn-soft" onClick={async () => {
            try { await navigator.clipboard.writeText(moveCode()); setCopied(true) } catch { setCopied(false) }
          }}>{copied ? 'Copied' : 'Copy my move code'}</button>
        </div>
      ) : (
        <button type="button" className="btn btn-soft" onClick={() => setShown(true)}>Show my move code</button>
      )}
      <form className="report" onSubmit={(e) => {
        e.preventDefault()
        if (!window.confirm('Switch this browser to the account from that code? Anything listed from this browser stays with its old account.')) return
        if (applyMoveCode(code)) window.location.reload()
        else setProblem('That code isn’t right. It is 64 letters and numbers, copied from your other browser.')
      }}>
        <label className="field">
          <span>Paste a move code from your other browser</span>
          <input value={code} onChange={(e) => { setCode(e.target.value); setProblem('') }} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={80} />
        </label>
        {problem && <p className="error" role="alert">{problem}</p>}
        <button type="submit" className="btn btn-soft" disabled={!code.trim()}>Move my account here</button>
      </form>
    </details>
  )
}
