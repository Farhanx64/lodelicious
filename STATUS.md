# Project status

Last updated: 2026-10-07 · branch `integration/2026-10-06` (milestone 3 finished, security and
accessibility audit fixes, milestone 5 core in progress). `main` is at f4523fa (PR #7, tax approved).

**Stack:** Payload 3.90.2 + Next.js 16.3.6 + SQLite on a cPanel Node app running **Node 24**
(confirmed from pasto-hair's live deployment; see `docs/decisions.md` D9, D14). Replaces the first
WooCommerce build (commit 5c36c77, kept in history). SKU IQ replaced by an in-house Clover sync
(D10). Storefront design: the SOUSET-PINK mood board (D31).

## Where we left off

**Built (on `main` or the integration branch):**
- **Admin:**
  - Every product, price, stock count, photo, basket rule, setting, policy, order, reservation and
    inquiry is editable in /admin.
  - Staff roles: owner, manager and fulfillment. Only the owner approves policies (D39).
  - Changes are audited.
- **Catalog:**
  - 80 products (76 published, 4 Cape Cod drafts) in 7 categories, reconciled against Lody's cards
    and her Clover export. Clover's price wins (D25).
  - 9 curated gift baskets, inquiry-only, with unapproved prices from the 2026-09-22 public Clover
    listing (D38).
  - Each product has an in-store reserve (D26).
  - An unapproved price is never shown: customers see "Price to be confirmed" (D41, audit A06).
- **Storefront pages:** home, shop, product pages, Gift Baskets, Baby Gifts, Build a Basket, Events
  (chocolate fountain), About, Contact, policies, bag, checkout and confirmations. SOUSET-PINK design
  (D31); mood-board placeholder photos on staging only (D32); Shop Favorites layout choice (D33);
  branded error and not-found pages.
- **Ordering:** bag → checkout → order for pickup, and custom baskets reserved with a deposit (D34–D36),
  with test payments only. Tax: 6.25% on all products, approved by Lody (D34).
- **Inquiries (D37):** /contact, product pages, Baby Gifts and Build a Basket send inquiries to
  /admin → Orders → Inquiries. /events shows a live fountain estimate ($250 + $8.50 × guests). Nothing
  is booked or charged, and no email is sent yet.
- **Policies (D39):** five policies in /admin → Settings → Policies. The live site shows only text Lody
  has approved; staging shows drafts (built only from confirmed facts) with a banner.
- **Security and robustness (D41):** see `docs/audit-2026-10-06.md` for the full list.
  - `APP_ENV` must be exactly `production` live; anything else unset or unknown is treated as live.
  - The first owner account is locked to `FIRST_OWNER_EMAIL` or created by `scripts/create-owner.ts`.
  - Security headers, a Secure login cookie, a CSRF allowlist, GraphQL off, and unapproved photos not
    served live.
  - Per-IP rate limits on every form, and a cart purge script.
  - Password policy (12+ characters) and a 15 MB photo upload limit.
  - Forms keep the customer's entries after an error, and focus moves to the error.
- **Checks:** see the latest milestone entry below for counts. CI also fails if the schema and
  migrations drift apart.

**What a customer can do today:**
- **Live site:** browse, and send inquiries. Nothing can be bought yet, for two reasons:
  1. Stock is uncounted, so every product shows "Currently unavailable".
  2. There is no payment provider in production, so checkout and reservations show "call to order".
- **Staging:** with `APP_ENV=staging` and `PREVIEW_ASSUME_STOCK=true`, checkout and basket
  reservations run end to end with a **test payment**, and no money moves.

**Waiting on Lody** (details in "Unresolved inputs" below and `docs/clover-sync-needs.md`):
1. **Clover stock:** stock counts; split the Dark/Milk bars and the two Princess box styles; add the
   ceramics, bassinet and fudges to Clover; say which teddy the card shows.
2. **Clover access:** an inventory-only API token for the sync (milestone 5). Later, the ecommerce
   keys and her approval of Clover's fees (milestone 6).
3. **Pickup and deposits:** pickup hours, notice periods, closed dates after Jan 2028 (the seed adds
   Dec 25, Jan 1 and Labor Day until then) and the basket deposit amount.
4. **Policies:** write and approve the five policies (each staging draft lists exactly what she must
   decide).
5. **Gift baskets:** approve each price, say what each basket contains (its component list) and
   send photos. Decide on a verifiable nut-free basket.
6. **Chocolate fountain:** whether it is taxable, the deposit basis and balance due, cancellation
   wording, service area, minimum guests and extensions.
7. **Store settings:** the DoorDash link and her "Our story" text.
8. **Photos:** her own photos to replace the placeholders; photos and allergen info for the 49
   products added from Clover.
9. **Home page:** 8–12 Shop Favorites ticked.
10. **Design:** acceptance of the gold-text contrast deviation (D31).

**Next build, in recommended order:**
1. **Milestone 5 core (in progress):** stock movement ledger, atomic deduction of each component
   exactly once, expiring holds during checkout, a component list for curated baskets, and a Clover
   outbox (D40).
2. **Checkout hardening (from the audit):**
   - A04: close anonymous product reads.
   - A05: payment retry defects that would surface with the first real provider.
   - A11: unique submission keys.
   - A12: dietary notes trigger staff review.
   - A14: orders wait for payment before "Preparing".
   - A20: audit deletes.
3. **Clover sync worker** against a fake adapter, then live with Lody's token.
4. **Milestone 6:** Clover payments, USPS rates, and order, reservation and inquiry emails.
   Needs keys, fee approval and email sending.

## Deploying (live or staging)

1. Set `APP_ENV=production` (or `staging`) in the cPanel Node app, and also when running
   `npm run build`, which bakes in the HSTS header.
2. Set `NEXT_PUBLIC_SITE_URL` to the exact https origin (comma-separate to add www). The admin then
   logs in only from that address.
3. Before the site is reachable, set `FIRST_OWNER_EMAIL`, or create the owner with
   `OWNER_EMAIL` / `OWNER_PASSWORD` and `npx payload run scripts/create-owner.ts`, then remove
   `OWNER_PASSWORD`.
4. Run `npm run migrate`. Run `npm run seed:catalog` only on an empty database (`SEED_FORCE=1`
   overrides the guard on a live database that already has products).
5. Cron (cPanel): `npx payload run scripts/purge-carts.ts` daily, plus the inventory jobs from D40
   once merged.
6. Log in and open `/ops/system-check`: every line, including `APP_ENV`, must pass.
7. Confirm LiteSpeed forwards `X-Forwarded-For` and the public host, which the rate limiter and
   server-action origin check rely on.

## Milestones

| # | Milestone | State |
| --- | --- | --- |
| 1 | Project setup | **Done** (rebuilt on Payload) |
| 2 | Gift-builder rules engine (presentations, counts, premium caps, budget, repeats, fit) | **Done** |
| 3 | Catalog + storefront (products from reviewed source records, pages, search/filters) | **Done** on the integration branch: Gift Baskets (D38), Events and Contact with inquiries (D37), and policies (D39). Content still depends on Lody |
| 4 | Cart, checkout, order snapshots, staff assembly views | **Done (test payments)**: bag, checkout, orders, basket reservations with deposits (D34–D36). Hardening from the audit is partly done (D41), the rest is next |
| 5 | Inventory: BOM, atomic reservations, expiring holds, outbox, Clover sync | **In progress**: website-side ledger, holds and outbox (D40). The live Clover sync needs Lody's stock counts and an inventory-only token |
| 6 | Clover embedded payments, USPS rates, fixture-tested until credentials exist | Not started: needs Clover ecommerce keys, fee approval, USPS credentials |

## Milestone 3 finished, plus audit fixes — 2026-10-06/07 (D37–D41)

- **How it was built:** parallel agents in separate worktrees, merged one by one into
  `integration/2026-10-06`, with the full CI chain after each wave.
- **Gift Baskets (D38):** 9 curated baskets seeded create-only from the basket chart and the
  2026-09-22 public Clover prices. They are inquiry-only with unapproved prices and no photos, and
  never get a packaging fee (tests at engine and bag level). The "Medium Nut Free" basket is left out:
  the title is not a verified claim.
- **Inquiries, Events and Contact (D37):**
  - An `inquiries` collection with topics, staff review statuses and frozen customer fields.
  - An `event-settings` global with the fountain terms.
  - The fountain estimate is recomputed on the server.
  - A honeypot, idempotent double submits, and numbering that survives deletes.
- **Policies (D39):**
  - A `policies` global, owner approval, and drafts on staging only.
  - Staff-only API read, so drafts are never public.
  - Checkout and reserve link to the pickup and cancellation policies.
- **Audit (`docs/audit-2026-10-06.md`):** a read-only review found 0 critical, 4 high, 11 medium and
  8 low issues.
  - Fixed in D41: A01, A03, A06, A09, A10, A13, A15, A18, A19, A22; A07, A08, A16 and A23 partly
    (see the doc).
  - Fixed by the integrator: A17 (phone menu), plus the footer part of A18.
  - A02 is fixed in the inventory work (D40).
  - The rest are scheduled under "Next build".
- **Footer:** links to gift baskets, the fountain, contact and policies, with 24 px link targets.
- **Checks after wave 1:** 394 tests pass (up from 232); typecheck, lint, migrations on an empty
  production database, no schema drift, and the production build are all clean.

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
- Pickup hours, notice periods, closed dates after Jan 2028; basket deposit amount (D36).
- Policy terms for all five policies (D39): each staging draft lists what is still open.
- Curated gift baskets: prices, contents (component list), photos; the nut-free basket (D38).
- Chocolate fountain: taxability, deposit basis and balance due, cancellation, service area, minimum guests, extensions (D37).
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

Merge the inventory branch (D40) into `integration/2026-10-06`, run the full CI chain, then open the
PR to `main`. After that: the checkout hardening from the audit, the Clover sync worker against a
fake adapter, and order emails. See "Where we left off" at the top.
