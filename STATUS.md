# Project status

Last updated: 2026-10-06 · `main` at 99362a3 (PR #4 merged, CI green)

**Stack:** Payload 3.90.2 + Next.js 16.3.6 + SQLite on a cPanel Node app running **Node 24**
(confirmed from pasto-hair's live deployment; see `docs/decisions.md` D9, D14). Replaces the first
WooCommerce build (commit 5c36c77, kept in history). SKU IQ replaced by an in-house Clover sync
(D10). Storefront design: the SOUSET-PINK mood board (D31).

## Where we left off

**Built and merged:**
- **Admin:**
  - Every product, price, stock count, photo, basket rule, setting and order is editable in /admin.
  - Staff roles: owner, manager and fulfillment.
  - Changes are audited.
- **Catalog:**
  - 71 products, reconciled against Lody's cards and her Clover export.
  - Clover's price wins (D25).
  - Each product has an in-store reserve (D26).
- **Storefront:**
  - Pages: home, shop, product pages, Baby Gifts, Build a Basket, About.
  - SOUSET-PINK design (D31).
  - Mood-board placeholder photos, shown on staging only (D32).
  - Shop Favorites layout choice (D33).
- **Milestone 4:**
  - Bag → checkout → order, for pickup only.
  - Custom baskets are reserved with an admin-set deposit (D36).
  - Admin Orders and Reservations tabs.
  - Tax classes (D34).
- **Checks:** 232 automated tests, plus browser-checked flows.

**What a customer can do today:**
- **Live site:** nothing can be bought yet, for two reasons:
  1. Stock is uncounted, so every product shows "Currently unavailable".
  2. There is no payment provider in production, so checkout and reservations show "call to order".
  (Tax is settled: 6.25% on all products, confirmed by Lody — D34. If the live database was seeded
  earlier, tick "approved" on the tax class in /admin.)
- **Staging:** with `PREVIEW_ASSUME_STOCK=true`, staging treats stock as available. There,
  checkout and basket reservations run end to end with a **test payment**, and no money moves.

**Waiting on Lody** (details in "Unresolved inputs" below and `docs/clover-sync-needs.md`):
1. **Clover stock:**
   - Stock counts in Clover.
   - Split the Dark/Milk bars and the two Princess box styles into separate Clover items.
   - Add the ceramics, bassinet and fudges to Clover.
   - Say which teddy the card shows.
2. **Clover access:** an inventory-only API token for the sync (milestone 5). Later, the ecommerce
   keys and her approval of Clover's fees (milestone 6).
3. **Pickup and deposits:** pickup hours, notice periods, closed dates and the basket deposit
   amount.
4. **Store settings:** the DoorDash link and her "Our story" text.
5. **Photos:** her own photos to replace the placeholders; photos and allergen info for the 49
   products added from Clover.
6. **Home page:** 8–12 Shop Favorites ticked.
7. **Design:** acceptance of the gold-text contrast deviation (D31).

**Next build, in recommended order:**
1. **Finish milestone 3.** None of it needs inputs from Lody:
   - Gift Baskets (curated baskets as products)
   - Events (chocolate-fountain inquiry)
   - Contact and policy pages
   - An inquiry form for Baby White, Cowboy and filled ceramics
2. **Milestone 5, inventory and the Clover sync:**
   - component stock deductions
   - holds during checkout
   - an outbox to Clover
   - scheduled stock reads

   Needs Lody's counts and token.
3. **Milestone 6, payments and shipping:**
   - Clover payments, replacing the test provider behind `src/lib/payments`
   - USPS rates
   - order emails

   Needs keys, fee approval and email sending.

## Milestones

| # | Milestone | State |
| --- | --- | --- |
| 1 | Project setup | **Done** (rebuilt on Payload) |
| 2 | Gift-builder rules engine (presentations, counts, premium caps, budget, repeats, fit) | **Done** |
| 3 | Catalog + storefront (products from reviewed source records, pages, search/filters) | **Mostly done**: catalog, Shop, product pages, Baby Gifts, Build a Basket and About are built. Remaining: Gift Baskets, Events, Contact, policies, inquiry form |
| 4 | Cart, checkout, order snapshots, staff assembly views | **Done (test payments)**: bag, checkout, orders, basket reservations with deposits (D34–D36) |
| 5 | Inventory: BOM, atomic reservations, expiring holds, outbox, Clover sync | Not started: needs Clover stock counts and an inventory-only token |
| 6 | Clover embedded payments, USPS rates, fixture-tested until credentials exist | Not started: needs Clover ecommerce keys, fee approval, USPS credentials |

## Milestone 1 — completed

- App skeleton on the pasto-hair pattern: `server.js` for Passenger/LiteSpeed, `payload.config.ts` with private `DATA_DIR`, `/healthz`.
- Collections: `users` (roles owner/manager/fulfillment; first account forced to owner), `media` (alt text required, "approved for launch" flag), `source-records` (51 observations, evidence immutable, audited review), `audit-log` (append-only, hook-written), `sync-jobs` (lock + checkpoint for restartable jobs). Global: `store-settings` (confirmed address/phone/email/hours/closures as defaults, audited).
- `src/lib`: integer-cent money, CSV parser, runtime system check, audit diff, idempotent source import.
- `npm run seed:sources`, `npm run doctor`, `/ops/system-check` (owner/manager only).
- Initial migration (`migrations/20260925_182201_initial.ts`).
- Storefront shell: black/cream/gold tokens (AA contrast), bundled OFL fonts, skip link, staging banner, footer from `store-settings`.
- CI: install, types, typecheck, lint, tests, migration-on-empty-DB, build.

## Milestone 4 — bag, checkout, basket reservations — 2026-10-05 (D34–D36)

- **Shop products:**
  - Product pages have "Add to bag".
  - The bag (/cart) re-prices every time.
  - Checkout takes contact details and a pickup time, then places a test order and shows a
    confirmation page with a private link.
  - /admin → Orders holds the immutable snapshots.
- **Custom baskets:**
  - "Reserve this basket" leads to /reserve, where the customer pays a deposit (or the full amount,
    if allowed) and picks a pickup time.
  - A confirmation page follows, and /admin → **Reservations** holds the assembly instructions,
    deposit and balance due.
  - Deposit type and value, pay-in-full and notice period are all set in /admin.
- **Admin settings:**
  - Tax classes; the seeded 6.25% applies to all products and is approved (D34).
  - Pickup hours, slot length, notice, days ahead and closed dates.
- **Live site:** payments are test-only, so ordering is closed there until Clover is connected.
  There is no stock movement yet (milestone 5) and no order emails yet.
- **Checks:**
  - 232 tests pass.
  - The browser flow covers product → bag → checkout → confirmation, a wrong link → 404, and
    builder → reserve → deposit → confirmation.
  - The live site shows no order buttons.
  - No overflow at 390 px or with 200% text.

## Shop Favorites layouts — 2026-10-04 (D33)

- **Layout choice:** /admin → Home page lets Lody pick a slider (the default), a 2 × 2 grid or a
  3 × 2 grid.
- **Slider controls:** it auto-plays, with Pause/Play and arrows. It stops on hover or focus, and for
  people who prefer reduced motion.
- **Checks:**
  - 204 tests pass.
  - Browser checks cover auto-play, pause, focus hold, arrows and reduced motion.
  - No overflow in any layout at 390 px or with 200% text.

## Mood-board photos as placeholders — 2026-10-03 (D32)

- **Photo strip:** the original five-box strip now holds the board's flowers, truffles and gift boxes.
  The top keeps the drawn awning.
- **Editing:** everything is editable in /admin → Home page.
- **Staging only:** the photos are seeded unapproved, so the live site shows the bow panels until
  Lody approves or replaces them.
- **Tests:** 200 pass.

## Exact mood-board match — SOUSET-PINK, 2026-10-03 (D31)

- **Board match:**
  - Board-sampled palette.
  - SOUSET-PINK lockup with a gold bow.
  - The board's nav bar with four icons.
  - A scalloped awning hero.
  - A five-photo strip (admin-editable, with placeholders).
  - New About and coming-soon pages for account, wishlist and bag.
- **Accessibility:** gold text is below WCAG AA by client decision. This is recorded in D31 and needs
  Lody's acceptance.
- **Checks:**
  - 197 tests pass.
  - No horizontal scroll at 390 px or with 200% text.
  - The phone menu works by keyboard.

## Re-theme to Lody's mood board — 2026-10-03 (superseded by D31)

- Ivory, linen and blush surfaces, with gold headings, nav, prices and buttons.
- Double gold frames on products, basket choices and the Baby White panel.
- Coastal-blue band and footer at the bottom (D30). AA contrast is enforced by
  `tests/theme-contrast.test.ts`.
- "Our story" footer column, editable in Store settings and hidden until Lody writes it (migration
  `store_story`).
- 193 tests pass. No horizontal scroll at 390 px or with 200% text, and focus outlines are visible.

## Lody's answers + Clover export — 2026-09-30

- **Clover export imported** as evidence (`data/source/clover-export-2026-09-30.csv`, 105 items, X001–X105). The 14 matching website products carry their Clover ID. The export has **no stock counts and no SKUs**.
- **Clover price wins** (D25): Dr. Seuss Book $6.25 and Greeting Cards $2.95. The teddy is unresolved because there are two Clover teddies.
- **49 Clover sweets and gifts added as products** (D29): Clover price, "Photo coming soon", allergens "unknown", not in custom gifts yet. Left out for now: coffee, drinks, gelato, ice-cream truck, Dubai cups, savory, OMNIYA.
- **In-store reserve** (D26): each product has a "Keep for in-store" number (default 1), and the website sells only what is above it.
- **Extra Large off** (D27): sizes have an "Offered to customers" switch, and Extra Large is off in the defaults and in existing databases.
- **Local delivery = DoorDash** (D28): the product "Local delivery" flag was removed. The DoorDash link goes in Store settings, and the home page and footer show it.
- Migration `clover_reserve_sizes_doordash`. 180 tests pass. Catalog: 71 products (67 published, 4 Cape Cod drafts).

## Milestone 3 (part 2) — Build a Basket, 2026-09-26

- `/build-a-basket`: gift type → size (item range, basket size, packaging, premium cap) → optional budget (budget rule shown first; "needs at least $X" / smaller-size suggestions) → item picker with reasons for unavailable items → gift message and requests (not guarantees). Live summary (items, premium, contents, packaging, total, budget left) announced to screen readers; "Review my basket" re-validates on the server with fresh data (`checkBasket` server action → `validateGift`). No cart yet (milestone 4): a valid basket tells the customer to call.
- Staging-only `PREVIEW_ASSUME_STOCK=true` lets Lody try the builder before stock is counted (ignored in production; the page says it's a preview).
- Large sympathy now shows the chart's 16" basket (count overrides carry a basket size; migration `sympathy_basket_size`).
- Staging is `noindex` (robots.txt + meta) so shared preview links stay out of search.
- Docs: `docs/preview-and-sharing.md` (free tunnel preview; Namecheap staging), `docs/clover-sync-needs.md` (sync status + what Lody must provide).

Browser test (Playwright, preview stock): small basket, $100 budget → "$80.05 for contents"; 2nd premium item blocked with reason; 6 items = $62.00 + $19.95 = $81.95, budget left $18.05; server check agrees; $60 budget → "$21.95 over your budget"; mobile 390 px and 200% text: no horizontal scroll, every input labelled. 169 tests pass.

Content gap found: **Extra large can't be completed** — it needs 18 distinct items and the catalog has ~14 sweet items; **Savory has no products at all**. The builder says so instead of failing.

## Milestone 3 (part 1) — 2026-09-26

- **Logo** from `Sticker_2.5_inch.pdf` → header, home hero, favicon and apple icon (D21).
- **Catalog in /admin**: `products` (drafts + 25 versions; tabs for details, price, availability & stock with pink/blue-style options, gift builder, allergens, fulfillment, records) and `categories`; owner/manager edit, fulfillment read-only; changes audited; prices shown as dollars in lists.
- **22 products seeded** from Lody's product zip: 15 from her product cards (prices, descriptions, photos), 3 baby ceramics (pink/blue options, assumed unapproved prices, per-shape photos), 4 Cape Cod Provisions fudge flavors as drafts (from the allergen chart; no price/photo). 6 categories, 24 photos. Seed is create-only (D24).
- **Allergen chart** transcribed per product (nut-free / vegan / notes); store-wide allergy notice editable in Store settings.
- **Baby line**: white wicker bassinet = Baby White container (no rattle); ceramics split into bowl/shoes/block presentations with pink/blue variants (engine: `VARIANT_REQUIRED` / `UNKNOWN_VARIANT`).
- **Storefront**: Home (favorites), Shop (category filter + search), product pages (options, allergens), Baby Gifts. Supplier photos are staging-only (D20). Everything shows "Currently unavailable" until stock is counted.
- **Reliability fixes**: schema push disabled, `npm run migrate` verifies every migration (D23); audit diff no longer logs null-vs-missing as a change.
- **Reconciliation**: `docs/reconciliation.md` lists every card price that differs from the screenshot/Clover/DoorDash.

| Check | Result |
| --- | --- |
| `npm test` | 17 files, **155 tests pass** (incl. catalog seed idempotency, admin-edit survives re-seed, drafts hidden, fulfillment blocked, fractional cents rejected) |
| typecheck, lint, build | Clean |
| Fresh DB: `npm run seed:catalog` twice | 73 source records, 6 categories, 24 media, 22 products; second run creates nothing |
| `migrate:check` on an unmigrated DB | exits 1 (as intended); after `npm run migrate` exits 0 |
| Storefront HTTP | `/`, `/shop`, filters, search, product pages, `/baby-gifts`, `/icon.png` 200; draft product 404; 18 published products listed |
| Accessibility (1280 & 390 px) | 1 h1 per page, no images without alt, no broken images, skip link first, no horizontal scroll incl. 200% text (two reflow bugs found and fixed) |
| Third-party requests | None |
| Server memory (RSS) | ~197 MB after storefront + admin use |

Screenshots: `docs/screenshots/m3-*` (home, shop, product, baby gifts × desktop/mobile; admin product list and editor).

## Milestone 2 — completed

- `src/lib/gifts/` (no framework imports; integer cents):
  - `validateGift` — one server-authoritative check for preview, add-to-cart and checkout. Returns `valid` (no rule broken) and `complete` (ready for the cart), totals (items, premium, contents, packaging, total, remaining budget, fit used) and explainable violations.
  - `checkProduct` / `checkForPicker` — why a product can't be chosen (in-store only, hidden, inquiry only, exclusive to Baby White, price not confirmed, stock unknown/stale/out, wrong gift type/category, already chosen, premium limit, over budget). Customers see "Currently unavailable" for stock/approval causes, never internal detail.
  - `assessFeasibility` — cheapest valid fill for a size/type/budget; suggests the minimum budget and smaller sizes that fit.
  - `defaults.ts` + `parseSettings` — PRD/chart defaults and validation of admin edits.
- Admin **Gift builder → Gift builder rules** (`gift-builder-settings` global): sizes, fees, premium caps, fit capacity, count exceptions (large sympathy 13–16), special presentations (Cowboy, Baby White: inquiry; filled ceramics: disabled), customer budget notice. Owner/manager edit; every save validated by the engine and audited. Migration `20260925_184633_gift_builder_settings`.
- CI on Node 24; decisions D14–D18 recorded.

## Milestone 2 test results (2026-09-25)

| Check | Result |
| --- | --- |
| `npm test` | 13 files, **125 tests pass** (79 new for gift rules incl. 6 Payload integration) |
| Mutation: remove the sympathy 13–16 override | 4 tests fail |
| Mutation: premium cap off by one | 5 tests fail |
| Mutation: charge packaging on curated/special | 3 tests fail (first attempt survived → fixed by routing specials through `packagingFor` and adding direct tests) |
| Performance: 2,000-product catalog, 20-item gift | well under the 50 ms/validation guard (PRD target p95 < 1 s) |
| HTTP (production `server.js`): anonymous read / write of rules | 200 / 403 |
| HTTP: owner saves min 15 > max 14 | 400 "Basket size 3: minimum (15) is above maximum (14)" |
| HTTP: owner changes small packaging to 2095 | 200; audit entry with before/after |
| Migration on existing milestone-1 DB | Applied on rerun; first run silently applied nothing (not reproduced) → README now requires `migrate:status` check |
| `npm ci` with npm 10 and 11 | Both install a valid tree |
| typecheck, lint, build | Clean |

Screenshot: `docs/screenshots/m2-admin-gift-rules.png`.

## Milestone 1 test results (2026-09-25)

| Check | Result |
| --- | --- |
| `npm test` (vitest) | 7 files, **46 tests pass** (unit + Payload integration on throwaway SQLite) |
| Mutation check: give fulfillment price rights | 4 tests fail as expected (then reverted) |
| `npm run typecheck`, `npm run lint` | Clean |
| `npm run build` (webpack) | Passes |
| `payload migrate` on an empty DB, `NODE_ENV=production` | Creates all 16 tables |
| `npm run seed:sources` twice | 51 created, then 51 unchanged, 0 conflicts |
| `server.js` production run, heap capped at 768 MB | `/`, `/admin`, `/healthz` 200; `/api/source-records` 403 anonymous; `/ops/system-check` 404 anonymous |
| First-register via API submitting `fulfillment` | Account created as `owner` |
| `/ops/system-check` as owner | Correctly fails `DATA_DIR private` for the local relative path; rest pass |
| Resident memory (RSS) after admin + storefront use | ~215 MB |
| Keyboard: first Tab → skip link (1280 and 390 wide) | Pass |
| Horizontal scroll at 390px, and at 200% text on 1280px and 390px | None (footer reflow fixed during QA) |
| Third-party requests from storefront | None |

Screenshots (home shell since replaced by `m3-*`):
`m1-admin-dashboard.png`, `m1-admin-source-records.png`.

## Unresolved inputs (blocking only the affected feature)

- **Stock counts in Clover**: the export has none. Also: split the shared Phillips bar and Princess items, add the ceramics, bassinet and fudges to Clover, and say which teddy the card shows (`docs/clover-sync-needs.md`).
- Clover API access for the in-house sync (inventory-only token Lody creates) — needed by milestone 5.
- DoorDash page link for local delivery.
- Pickup hours, notice periods and closed dates; basket deposit amount (D36).
- "Our story" text for the footer, in her own words (Store settings).
- Her own photos for the home-page photo strip (Home page settings), and acceptance of the gold-text contrast deviation (D31).
- Photos, descriptions, allergen info and basket eligibility for the 49 products added from Clover.
- Corrected price form for items without a card (almonds, bark, tulips, cherries, pretzels, Dubai items, macarons, curated baskets).
- Price conflict: screenshot P01–P03 ($5.95) equal DoorDash prices while P13/P15 are $4.25; observed DoorDash gaps are 30–40%, not the stated 3%.
- Physical fit: only basket sizes are known; per-product sizes are not, so fit limits will be staff-configurable counts.
- OMNIYA: confirm it is not one of the in-store-only Lebanese chocolates.
- **Savory products**: Lody will name them later (cheese, salami). Extra Large stays off until there is enough variety (D27).
- **Stock counts** for every product (and each pink/blue option) — nothing is purchasable until entered.
- Ceramic prices (bowl/block $14.95, shoes $19.95) and whether they are empty-container prices; item counts for filled ceramics.
- Publishing rights for supplier photos (bassinet, planters).
- Price differences in `docs/reconciliation.md`: the Clover price now wins (D25). Only the teddy is still open.
- Cape Cod Provisions fudge: prices, sizes, photos (4 drafts waiting).
- Allergen data for Lodelicious-bagged items (raisins, gummy bears, Swedish candy) and add-ons.
- Sympathy packaging and premium caps: assumed equal to the standard size (D15) — confirm with Lody.
- Cowboy / Baby White: price, premium cap, and whether chosen items are charged on top of the base price (D18).
- Product categories for Baby White choices (defaults "candy", "chocolate") must match milestone-3 product categories.
- All other PRD "Remaining inputs" (cowboy/Baby White prices, ceramic basis, scheduling cutoffs, shipping data, fountain terms, policies).

## Next concrete step

Finish milestone 3. These need no inputs from Lody:
- Gift Baskets: curated baskets as products.
- Events: the chocolate-fountain inquiry.
- Contact and policy pages.
- An inquiry form for Baby White, Cowboy and filled ceramics.

Then:
- milestone 5 (Clover sync), once Lody's stock counts and token arrive
- milestone 6 (payments, shipping, emails)

See "Where we left off" at the top.
