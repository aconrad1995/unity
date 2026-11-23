import { useEffect, useState, type FormEvent } from 'react'
import { ChatIcon, ListingImage, SendIcon } from '../art'
import { APP_NAME } from '../data'
import { NO_ONE, nameOf, readProfile, type Store } from '../store'
import { Avatar } from './ProfilePage'
import { PageHeader } from './PageHeader'
import { RoleBadge } from './Team'
import { InstagramLink, RateCard, RatingLine } from './Seller'

function when(at: number): string {
  const d = new Date(at)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}

export function ChatList({ store }: { store: Store }) {
  const nameless = !readProfile().name.trim()
  return (
    <>
      <PageHeader title="Chats" noBack />
      <main className="page chats">
        {nameless && store.chats.length > 0 && (
          <p className="notice">People see you as “Someone new”. <a className="inline-link" href="#/you">Add your name</a></p>
        )}
        {store.chats.length > 0 ? (
          <ul className="chat-list">
            {store.chats.map((c) => {
              const person = store.people[c.user] ?? NO_ONE
              const topic = [...c.messages].reverse().find((m) => m.about || m.listingId)
              const topicName = topic && (store.listings.find((l) => l.id === topic.listingId)?.title ?? topic.about)
              return (
                <li key={c.user}>
                  <a className="chat-row" href={`#/chats/${c.user}`}>
                    <Avatar profile={person} size={56} />
                    <span className="chat-row-text">
                      <strong>{nameOf(person)} <RoleBadge role={store.roles[c.user]} /></strong>
                      {topicName && <span className="chat-topic">About {topicName}</span>}
                      <span className="chat-preview">{c.last.from === store.me ? 'You: ' : ''}{c.last.text}</span>
                    </span>
                    <span className="chat-row-side">
                      <span className="chat-time">{when(c.last.at)}</span>
                      {c.unread > 0 && <span className="chat-unread" aria-label={`${c.unread} new`}>{c.unread}</span>}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="empty">
            <span className="empty-art"><ChatIcon /></span>
            <h2>No chats yet</h2>
            <p>Find an outfit you like and tap “Message seller to buy”. Your chats will wait for you here.</p>
            <a className="btn" href="#/">Browse the shop</a>
          </div>
        )}
        <p className="fineprint">Only you and the person you’re chatting with can see a chat. No followers, no public feed.</p>
      </main>
    </>
  )
}

export function ChatThread({ store, user, listingId }: { store: Store; user: string; listingId?: string }) {
  const [draft, setDraft] = useState('')
  const [reason, setReason] = useState('')
  const [reported, setReported] = useState(false)

  const person = store.people[user] ?? NO_ONE
  const name = nameOf(person)
  const chat = store.chats.find((c) => c.user === user)
  const messages = chat?.messages ?? []
  const isBlocked = store.blocked.includes(user)
  const lastTopic = [...messages].reverse().find((m) => m.listingId)
  const aboutId = listingId ?? lastTopic?.listingId
  const about = aboutId ? store.listings.find((l) => l.id === aboutId) : undefined
  // The outfit may have been sold and removed; its name was kept with the messages.
  const goneTitle = !about && aboutId ? messages.find((m) => m.listingId === aboutId && m.about)?.about : undefined
  const topicOf = (id?: string) => (id ? store.listings.find((l) => l.id === id)?.title ?? messages.find((m) => m.listingId === id && m.about)?.about : undefined)

  useEffect(() => {
    store.markRead(user)
    window.scrollTo(0, document.body.scrollHeight)
  }, [messages.length, user])

  if (!/^[0-9a-f]{16}$/.test(user) || user === store.me) {
    return (
      <>
        <PageHeader title="Chat" back="#/chats" backLabel="Back to chats" />
        <main className="page">
          <div className="empty">
            <h2>{user === store.me ? 'This is you' : 'Chat not found'}</h2>
            <p>{user === store.me ? 'You can’t message yourself.' : 'This person could not be found.'}</p>
            <a className="btn" href="#/chats">Back to chats</a>
          </div>
        </main>
      </>
    )
  }

  function send(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    // It shows in the chat straight away and is kept until the server confirms it.
    store.sendMessage(user, text, messages.length === 0 || listingId ? aboutId : undefined)
    setDraft('')
  }

  const starters = [
    ...(about ? ['Hi! Is this still available?', 'Would you trade for it?'] : []),
    ...person.upFor.map((u) => `Hi! I’m up for ${u.toLowerCase()} too.`),
  ].slice(0, 4)

  return (
    <>
      <PageHeader title={name} back="#/chats" backLabel="Back to chats" />
      <main className="page thread">

        {(() => {
          const sells = store.listings.some((l) => l.ownerId === user)
          if (!sells && !person.photo && !person.upFor.length && !store.roles[user] && !person.instagram) return null
          return (
            <div className="thread-who">
              <Avatar profile={person} size={52} />
              <div className="thread-who-text">
                <RoleBadge role={store.roles[user]} />
                {sells && <a className="thread-seller" href={`#/seller/${user}`}><RatingLine summary={store.ratings[user]} /> <span className="inline-link">Seller page</span></a>}
                <InstagramLink handle={person.instagram} />
                {person.upFor.length > 0 && <p className="seller-upfor">{name} is up for: {person.upFor.join(', ').toLowerCase()}</p>}
              </div>
            </div>
          )
        })()}

        {about && (
          <a className="thread-about" href={`#/item/${about.id}`}>
            <span className="thread-about-photo"><ListingImage listing={about} /></span>
            <span>
              <span className="hint">Chatting about</span>
              <strong>{about.title}</strong>
              <span>${about.price} · {about.brand} · {about.size}{about.status ? ` · ${about.status === 'sold' ? 'Sold' : 'Reserved'}` : ''}</span>
            </span>
          </a>
        )}
        {goneTitle && (
          <p className="thread-about thread-about-gone"><span><span className="hint">Chatting about</span><strong>{goneTitle}</strong><span>No longer listed</span></span></p>
        )}

        {messages.length > 0 ? (
          <ol className="msgs" aria-label={`Messages with ${name}`}>
            {messages.map((m, i) => {
              // When a chat moves on to a different outfit, a small marker says which one.
              const prevTopic = messages.slice(0, i).reverse().find((x) => x.listingId)?.listingId
              const topic = m.listingId && m.listingId !== prevTopic && (i > 0 || messages.some((x) => x.listingId && x.listingId !== m.listingId)) ? topicOf(m.listingId) : undefined
              return (
              <li key={m.id} className={m.from === store.me ? 'msg msg-me' : 'msg'}>
                {topic && <span className="msg-topic">About {topic}</span>}
                <p>{m.text}</p>
                {m.state === 'sending' && <span className="msg-state">Sending…</span>}
                {(m.state === 'failed' || m.state === 'rejected') && (
                  <span className="msg-state msg-bad" role="alert">
                    {m.why ?? 'Not sent.'}{' '}
                    {m.state === 'failed' && <button type="button" className="link-btn" onClick={() => store.retryMessage(m.id)}>Try again</button>}
                    <button type="button" className="link-btn" onClick={() => store.discardMessage(m.id)}>Delete</button>
                  </span>
                )}
                {!m.state && <time dateTime={new Date(m.at).toISOString()}>{m.from === store.me ? 'You' : name} · {when(m.at)}</time>}
              </li>
              )
            })}
          </ol>
        ) : (
          !isBlocked && <p className="thread-start">Say hi to {name}. Only the two of you can see this chat.</p>
        )}
        {about && !isBlocked && messages.length < 4 && (
          <p className="buy-how buy-how-chat">Agree the price and shipping here. {APP_NAME} doesn’t take payment yet, so pay with buyer protection, like PayPal Goods &amp; Services. Never pay as “friends and family”.</p>
        )}

        {!isBlocked && <RateCard key={user} store={store} user={user} />}

        {isBlocked ? (
          <div className="notice blocked-note">
            <p>You blocked {name}. They can’t message you, and their messages are hidden.</p>
            <button type="button" className="btn btn-soft" onClick={() => store.setBlocked(user, false)}>Unblock {name}</button>
          </div>
        ) : (
          <div className="composer-wrap">
            {messages.length === 0 && starters.length > 0 && (
              <div className="bubbles bubbles-wrap starters" role="group" aria-label="Quick ways to start">
                {starters.map((s) => (
                  <button key={s} type="button" className="bubble" onClick={() => setDraft(s)}>{s}</button>
                ))}
              </div>
            )}
            <form className="composer" onSubmit={send}>
              <label className="sr-only" htmlFor="chat-draft">Write a message to {name}</label>
              <input id="chat-draft" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message" maxLength={1000} autoComplete="off" />
              <button type="submit" className="send" disabled={!draft.trim()} aria-label="Send message"><SendIcon /></button>
            </form>
            {draft.length > 800 && <p className="hint counter" aria-live="polite">{draft.length} of 1000</p>}
          </div>
        )}

        <details className="safety">
          <summary>Staying safe, blocking and reporting</summary>
          <ul className="safety-tips">
            <li>{APP_NAME} doesn’t take payment yet. Pay with buyer protection, like PayPal Goods &amp; Services. Never pay as “friends and family”, by gift card or in crypto.</li>
            <li>Meeting up? Pick a busy public spot and tell a friend.</li>
            <li>Never share passwords, codes or card numbers in a chat.</li>
          </ul>
          {!isBlocked && (
            <button type="button" className="btn btn-soft" onClick={() => {
              if (window.confirm(`Block ${name}? They won’t be able to message you.`)) store.setBlocked(user, true)
            }}>
              Block {name}
            </button>
          )}
          {reported ? (
            <p className="success" role="status">Report saved for the {APP_NAME} team.</p>
          ) : (
            <form className="report" onSubmit={async (e) => {
              e.preventDefault()
              if (reason.trim() && (await store.report(user, reason))) setReported(true)
            }}>
              <label className="field">
                <span>Report {name}</span>
                <span className="hint">Tell us what happened. They won’t be told.</span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
              </label>
              <button type="submit" className="btn btn-soft" disabled={!reason.trim()}>Send report</button>
            </form>
          )}
        </details>
      </main>
    </>
  )
}
