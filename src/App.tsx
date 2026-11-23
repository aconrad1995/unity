import { CalendarIcon, ChatIcon, PlusIcon, ProfileIcon, ShopIcon } from './art'
import { useRoute, useStore } from './store'
import Shop from './screens/Shop'
import ListingPage from './screens/ListingPage'
import Sell from './screens/Sell'
import Saved from './screens/Saved'
import ForBrands from './screens/ForBrands'
import Events from './screens/Events'
import ProfilePage from './screens/ProfilePage'
import { ChatList, ChatThread } from './screens/Chats'
import { ReportsPage, TeamPage } from './screens/Team'
import { InspoPage, LookPage, PostLook } from './screens/Inspo'
import AlertsPage from './screens/AlertsPage'
import { SellerPage } from './screens/Seller'
import { useAlerts } from './alerts'

export default function App() {
  const store = useStore()
  const alerts = useAlerts(store)
  const [page, id, extra] = useRoute()
  const tab = page === 'sell' ? 'sell' : page === 'chats' ? 'chats' : page === 'events' ? 'events' : page === 'you' || page === 'team' ? 'you' : 'shop'
  // Inside a chat the bottom bar steps aside so it never covers the message box.
  const inThread = page === 'chats' && !!id

  let screen
  if (page === 'item' && id) screen = <ListingPage store={store} id={id} />
  else if (page === 'sell') screen = <Sell store={store} wornFrom={id === 'worn' && extra ? decodeURIComponent(extra) : undefined} />
  else if (page === 'saved') screen = <Saved store={store} />
  else if (page === 'for-brands') screen = <ForBrands />
  else if (page === 'events') screen = <Events />
  else if (page === 'chats') screen = id ? <ChatThread key={id} store={store} user={id} listingId={extra} /> : <ChatList store={store} />
  else if (page === 'team') screen = id === 'reports' ? <ReportsPage store={store} /> : <TeamPage store={store} />
  else if (page === 'inspo') screen = id === 'new' ? <PostLook store={store} /> : <InspoPage store={store} />
  else if (page === 'look' && id) screen = <LookPage key={id} store={store} id={id} />
  else if (page === 'seller' && id) screen = <SellerPage key={id} store={store} id={id} />
  else if (page === 'alerts') screen = <AlertsPage store={store} alerts={alerts} />
  else if (page === 'brand' && id) screen = <Shop key={id} store={store} alerts={alerts} initialBrand={decodeURIComponent(id)} />
  else if (page === 'shop-for' && id) screen = <Shop key={`for-${id}`} store={store} alerts={alerts} forEvent={decodeURIComponent(id)} />
  else if (page === 'you') screen = <ProfilePage store={store} />
  else screen = <Shop store={store} alerts={alerts} />

  return (
    <div className="app">
      {screen}
      {!inThread && <nav className="tabbar" aria-label="Main">
        <a href="#/" className="tab" aria-current={tab === 'shop' ? 'page' : undefined}>
          <ShopIcon />
          <span>Shop</span>
        </a>
        <a href="#/events" className="tab" aria-current={tab === 'events' ? 'page' : undefined}>
          <CalendarIcon />
          <span>Events</span>
        </a>
        <a href="#/sell" className="tab tab-sell" aria-current={tab === 'sell' ? 'page' : undefined}>
          <span className="tab-sell-bubble"><PlusIcon /></span>
          <span>Sell</span>
        </a>
        <a href="#/chats" className="tab" aria-current={tab === 'chats' ? 'page' : undefined}>
          <ChatIcon />
          <span>Chats</span>
          {store.unread > 0 && <span className="tab-count" aria-label={`${store.unread} new messages`}>{store.unread}</span>}
        </a>
        <a href="#/you" className="tab" aria-current={tab === 'you' ? 'page' : undefined}>
          <ProfileIcon />
          <span>You</span>
        </a>
      </nav>}
    </div>
  )
}
