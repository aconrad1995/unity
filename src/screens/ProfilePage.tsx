import { useState } from 'react'
import { InstallCard } from './InstallCard'
import { PushCard } from './PushCard'
import { CameraIcon, CloseIcon, InstagramIcon, ProfileIcon } from '../art'
import { APP_NAME, BRANDS, SIZES, UP_FOR, VIBES, cleanBrand } from '../data'
import { instagramOf, shrinkPhoto, useProfile, type Store } from '../store'
import { readTaste, resetTaste, topOf } from '../taste'
import { AccountPage } from './Account'
import { Card } from './Card'
import { BackFrom, Countdown } from './Countdown'
import { PageHeader } from './PageHeader'
import { RatingLine } from './Seller'
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

function Picks({ label, hint, options, chosen, onChange }: {
  label: string; hint?: string; options: readonly string[]; chosen: string[]; onChange: (next: string[]) => void
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
            <button key={o} type="button" className="bubble" aria-pressed={on}
              onClick={() => onChange(on ? chosen.filter((x) => x !== o) : [...chosen, o])}>
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** "#/you" and its parts: profile, sizes and style, closet, account. */
export default function ProfilePage({ store, section }: { store: Store; section?: string }) {
  if (section === 'profile') return <ProfileEdit store={store} />
  if (section === 'style' || section === 'prefs') return <StyleEdit />
  if (section === 'closet') return <Closet store={store} />
  if (section === 'account') return <AccountPage store={store} />
  return <YouHome store={store} />
}

function Row({ href, title, detail }: { href: string; title: string; detail?: string }) {
  return (
    <li>
      <a className="you-row" href={href}>
        <span><strong>{title}</strong>{detail && <span>{detail}</span>}</span>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
      </a>
    </li>
  )
}

function YouHome({ store }: { store: Store }) {
  const { profile } = useProfile()
  const name = profile.name.trim()
  const listed = store.mine.filter((l) => l.status !== 'sold').length
  return (
    <>
      <PageHeader title="You" noBack />
      <main className="page profile">
        <BackFrom />

        <a className="you-card" href="#/you/profile">
          <Avatar profile={profile} size={72} />
          <span className="you-card-text">
            <strong className="you-name">{name || 'Add your name'}</strong>
            <RoleBadge role={store.myRole} />
            {store.mine.length > 0 && <RatingLine summary={store.ratings[store.me]} />}
            <span className="hint">{profile.instagram ? `@${profile.instagram} · ` : ''}Edit profile</span>
          </span>
        </a>

        {!store.account && (
          <section className="account-nudge" aria-labelledby="nudge-h">
            <h2 id="nudge-h">Keep your shop safe</h2>
            <p>Your listings and chats live in this browser. Add an email and password so you can sign in on any phone, and never lose them.</p>
            <div className="actions-row">
              <a className="btn" href="#/you/account">Create account</a>
              <a className="btn btn-soft" href="#/you/account/signin">Sign in</a>
            </div>
          </section>
        )}

        <ul className="you-rows">
          <Row href="#/you/closet" title="My closet" detail={store.mine.length ? `${listed} for sale${store.mine.length > listed ? `, ${store.mine.length - listed} sold` : ''}` : 'Nothing listed yet'} />
          <Row href="#/saved" title="Saved outfits" detail={store.saved.length ? `${store.saved.length} saved` : 'Tap the heart on any outfit'} />
          <Row href="#/you/style" title="My sizes and style" detail={profile.sizes.length ? `Size ${profile.sizes.join(', ')}${profile.brands.length ? ` · ${profile.brands.slice(0, 2).join(', ')}` : ''}` : 'Sets your shop and Matches'} />
          <Row href="#/alerts" title="Matches" detail="New outfits in your sizes and brands" />
          <Row href="#/inspo" title="Inspo and looks" detail="See how people style their fits" />
          <Row href="#/you/account" title="Account" detail={store.account ? `Signed in as ${store.account}` : 'Not signed in'} />
        </ul>

        <Countdown prompt />
        <InstallCard />
        <PushCard />

        <p className="fineprint">
          Other people see your name, picture, Instagram, listings, ratings and “say hi about” picks. Your sizes, style,
          favorite brands and what the shop has learned stay private on this phone.
        </p>
        <p className="fineprint fineprint-link"><a className="tap-link" href="#/team">{store.myRole ? 'Team tools' : 'Team? Sign in'}</a></p>
      </main>
    </>
  )
}

function ProfileEdit({ store }: { store: Store }) {
  const { profile, update, saveFailed } = useProfile()
  const [photoProblem, setPhotoProblem] = useState('')
  async function onPhoto(file: File | undefined) {
    if (!file) return
    try {
      update({ photo: await shrinkPhoto(file, 400) })
      setPhotoProblem('')
    } catch {
      setPhotoProblem('That file could not be opened. Try a JPG or PNG photo.')
    }
  }
  return (
    <>
      <PageHeader title="Profile" back="#/you" backLabel="Back to You" />
      <main className="page profile">
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
          {store.nameRefused && <p className="error" role="alert">That name is kept for the {APP_NAME} team, so others can’t pretend to be them. Pick a different name.</p>}
          {photoProblem && <p className="error" role="alert">{photoProblem}</p>}
          {saveFailed && <p className="error" role="alert">This device is out of storage space, so your changes may not be kept. Try a smaller picture.</p>}
        </section>

        <section className="step" aria-labelledby="friends-h">
          <h2 id="friends-h" className="section-h section-h-in">Making friends</h2>
          <p>{APP_NAME} isn’t a social feed. No followers, no like counts. Friendships start in a message, from an outfit or an event you’re both into.</p>
          <Picks label="Say hi to me about" hint="This shows on your listings so people know what you’re up for. Leave it empty to keep messages about outfits only."
            options={UP_FOR} chosen={profile.upFor} onChange={(upFor) => update({ upFor })} />
        </section>

        {store.me && <a className="btn btn-soft btn-wide" href={`#/seller/${store.me}`}>See your seller page</a>}
      </main>
    </>
  )
}

function StyleEdit() {
  const { profile, update } = useProfile()
  const [brandText, setBrandText] = useState('')
  const [taste, setTaste] = useState(readTaste)
  const learned = [
    ['Brands', topOf(taste.brands)],
    ['Types', topOf(taste.categories)],
    ['Sizes', topOf(taste.sizes)],
    ['Searches', topOf(taste.words)],
  ].filter(([, list]) => list.length > 0) as [string, string[]][]
  function addBrand() {
    const b = cleanBrand(brandText)
    if (b && !profile.brands.some((x) => x.toLowerCase() === b.toLowerCase())) update({ brands: [...profile.brands, b] })
    setBrandText('')
  }
  return (
    <>
      <PageHeader title="Sizes and style" back="#/you" backLabel="Back to You" />
      <main className="page profile">
        <section className="step" aria-labelledby="prefs-h">
          <h2 id="prefs-h" className="section-h section-h-in">What you’re shopping for</h2>
          <p className="hint">The shop starts in your sizes, and Matches tells you when your sizes and brands are listed. This stays private on this phone.</p>
          <Picks label="My sizes" options={SIZES} chosen={profile.sizes} onChange={(sizes) => update({ sizes })} />
          <Picks label="My style" hint="Pick as many as you like." options={VIBES} chosen={profile.vibes} onChange={(vibes) => update({ vibes })} />
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

        {learned.length > 0 && (
          <section className="step" aria-labelledby="learned-h">
            <h2 id="learned-h" className="section-h section-h-in">What {APP_NAME} has picked up</h2>
            <p>The shop puts your best matches first, from what you search, tap, open and save.</p>
            <dl className="learned">
              {learned.map(([label, list]) => (
                <div key={label}><dt>{label}</dt><dd>{list.join(', ')}</dd></div>
              ))}
            </dl>
            <button type="button" className="link-btn" onClick={() => { resetTaste(); setTaste(readTaste()) }}>Forget what you’ve learned</button>
          </section>
        )}
      </main>
    </>
  )
}

function Closet({ store }: { store: Store }) {
  return (
    <>
      <PageHeader title="My closet" back="#/you" backLabel="Back to You" />
      <main className="page profile">
        {store.mine.length > 0 ? (
          <>
            <a className="btn btn-wide" href="#/sell">List another outfit</a>
            <ul className="grid">
              {store.mine.map((l) => <Card key={l.id} listing={l} store={store} />)}
            </ul>
          </>
        ) : (
          <div className="empty">
            <h2>Nothing listed yet</h2>
            <p>Outfits you put up for sale show here, with sold ones kept for your records.</p>
            <a className="btn" href="#/sell">Sell an outfit</a>
          </div>
        )}
      </main>
    </>
  )
}
