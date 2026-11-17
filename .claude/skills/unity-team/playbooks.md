# Unity Rave playbooks

One playbook per run. One deliverable per brief. Status is Andy's to change.

## build

- Status: LIVE.
- Goal: ship one small change to the Unity app from a request by Mary or Andy.
- Allowed sources: this repo, PRODUCT.md, the request.
- Deliverable: one code change on the working branch with tests and build passing, plus a short change note. Not merged, not deployed.
- Scout looks for: the files and lines the change touches, the existing pattern to follow, the tests that cover it, any PRODUCT.md line that limits it.
- Checklist:
  1. `npm test` passes and `npm run build` passes, run by the Checker.
  2. The change does only what the brief says.
  3. Nothing PRODUCT.md lists as undecided was decided in code.
  4. Condition shows on every listing. Featured spots say "Sponsored". Sample data is labelled as sample.
  5. No invented users, reviews, sales or partnerships in the interface text.
  6. No secrets, keys or team codes in code. `.data/` untouched.
  7. Works at phone width.
  8. Nothing committed to main, nothing pushed or deployed.

## content

- Status: DRY RUN (drafts for Mary, nothing posted).
- Goal: give Mary a shortlist to pick from each week.
- Allowed sources: looks posted in the app's Inspo, official event pages (promoter, venue or ticketing page for that event), Mary's own notes.
- Deliverable: one of (a) a fit of the week shortlist of 3 looks with a caption draft each, or (b) an event list for one city with name, date, venue and official link.
- Extra stop: Mary picks the fit of the week. The team never picks.
- Checklist:
  1. Every event name, date and venue matches the official page linked on its card.
  2. Looks come only from Inspo posts in the app. No photos pulled from outside it.
  3. No invented quotes, no likes or follower counts.
  4. Captions sound like the scene, not a brand account.
  5. Nothing posted or edited in the app by the team.

## sellers

- Status: BLOCKED until the app is hosted on the internet and Andy says go. PRODUCT.md says it is not hosted yet, so there is nothing to invite a seller to.
- Goal: open the shop with real outfits by starting conversations with first sellers.
- Allowed sources: public information only (public resale listings and public social profiles where the person shows rave outfits for sale), plus PRODUCT.md.
- Deliverable: per prospect, a fact card and one first message under 90 words.
- Extra stop: after the fact cards, Andy or Mary picks which prospects to pursue.
- Checklist:
  1. Every prospect fact has a public link.
  2. Adults only. No private accounts. No personal details beyond the public profile.
  3. Says plainly that Unity is new. No user counts, no promised sales.
  4. No fee, payout or shipping terms stated. They are undecided.
  5. No claim of affiliation with any brand.
  6. One clear ask and an easy way to say no.
  7. Draft only. Andy or Mary sends it.

## sponsors

- Status: BLOCKED until Mary sets the featured spot price, contract terms and a contact address. PRODUCT.md lists all three as undecided.
- Goal: start conversations with rave brands about the featured spot.
- Allowed sources: the brand's own site and public social profiles, public news, PRODUCT.md, and `src/screens/ForBrands.tsx` for what the spot includes.
- Deliverable: per brand, a fact card and one first message under 90 words.
- Extra stop: after the fact cards, Andy or Mary picks which brands to pursue.
- Checklist:
  1. Every brand fact has a public link.
  2. What the featured spot includes matches PRODUCT.md and ForBrands.tsx, including that it is labelled "Sponsored".
  3. No traffic, user or sales numbers. None exist.
  4. Price and terms match exactly what Mary set. If not set, automatic ESCALATE.
  5. No claim that any other brand has signed up.
  6. One clear ask and an easy way to say no.
  7. Draft only. Andy or Mary sends it.
