import { APP_NAME, BRAND_CONTACT_EMAIL, FEATURED } from '../data'
import { readStats } from '../store'
import { PageHeader } from './PageHeader'

export default function ForBrands() {
  const stats = readStats()
  return (
    <>
      <PageHeader title="Feature your brand" />
      <main className="page prose">
        <h2>Put your brand in front of ravers shopping for their next look</h2>
        <p>
          {APP_NAME} is where ravers buy and sell lightly worn outfits. A featured spot keeps your brand
          at the front of the shop for a flat monthly fee.
        </p>

        <h3>What a featured brand gets</h3>
        <ul className="ticks">
          <li><strong>First place in the brand row.</strong> Your brand shows first, with a sparkle, even when none of your pieces are listed.</li>
          <li><strong>Your own banner.</strong> When a shopper picks your brand they see your message and a button to your store.</li>
          <li><strong>A “Buy it new” link.</strong> Every resale listing of your pieces links back to your store.</li>
        </ul>

        <h3>How it works</h3>
        <p>
          One flat monthly fee. Featured spots are always labelled “Sponsored” so shoppers
          know what they are looking at. Pricing is being finalised.
        </p>
        <p className="notice">
          {BRAND_CONTACT_EMAIL
            ? <>To ask about a spot, write to <a href={`mailto:${BRAND_CONTACT_EMAIL}`}>{BRAND_CONTACT_EMAIL}</a>.</>
            : 'Contact details are coming soon.'}
        </p>

        <h3>Featured brand activity</h3>
        <p className="hint">Counted on this device only while {APP_NAME} is in preview.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th scope="col">Brand</th><th scope="col">Banner views</th><th scope="col">Store clicks</th><th scope="col">Listing views</th></tr>
            </thead>
            <tbody>
              {FEATURED.map((f) => (
                <tr key={f.brand}>
                  <th scope="row">{f.brand}{f.example ? ' (example)' : ''}</th>
                  <td>{stats[f.brand]?.bannerViews ?? 0}</td>
                  <td>{stats[f.brand]?.storeClicks ?? 0}</td>
                  <td>{stats[f.brand]?.listingViews ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}
