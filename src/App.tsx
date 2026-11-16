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

export default function App() {
  const store = useStore()
  const [page, id, extra] = useRoute()
  const tab = page === 'sell' ? 'sell' : page === 'chats' ? 'chats' : page === 'events' ? 'events' : page === 'you' ? 'you' : 'shop'

  let screen
  if (page === 'item' && id) screen = <ListingPage store={store} id={id} />
  else if (page === 'sell') screen = <Sell store={store} />
  else if (page === 'saved') screen = <Saved store={store} />
  else if (page === 'for-brands') screen = <ForBrands />
  else if (page === 'events') screen = <Events />
  else if (page === 'chats') screen = id ? <ChatThread key={id} store={store} user={id} listingId={extra} /> : <ChatList store={store} />
  else if (page === 'you') screen = <ProfilePage store={store} />
  else screen = <Shop store={store} />

  return (
    <div className="app">
      {screen}
      <nav className="tabbar" aria-label="Main">
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
      </nav>
    </div>
  )
}
