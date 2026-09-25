# Project status

Last updated: 2026-09-25 · Branch: `claude/sweet-meitner-2hnl84`

**Stack:** Payload 3.90.2 + Next.js 16.3.6 + SQLite on a cPanel Node app running **Node 24**
(confirmed from pasto-hair's live deployment; see `docs/decisions.md` D9, D14). Replaces the first WooCommerce build (commit 5c36c77, kept in history). SKU IQ replaced by an
in-house Clover sync (D10).

## Milestones

| # | Milestone | State |
| --- | --- | --- |
| 1 | Project setup | **Done** (rebuilt on Payload) |
| 2 | Gift-builder rules engine (presentations, counts, premium caps, budget, repeats, fit) | **Done** |
| 3 | Catalog + storefront (products from reviewed source records, pages, search/filters) | Next |
| 4 | Cart, checkout, order snapshots, staff assembly views | Not started |
| 5 | Inventory: BOM, atomic reservations, expiring holds, outbox, Clover sync | Not started |
| 6 | Clover embedded payments, USPS rates — fixture-tested until credentials exist | Not started |

## Milestone 1 — completed

- App skeleton on the pasto-hair pattern: `server.js` for Passenger/LiteSpeed, `payload.config.ts` with private `DATA_DIR`, `/healthz`.
- Collections: `users` (roles owner/manager/fulfillment; first account forced to owner), `media` (alt text required, "approved for launch" flag), `source-records` (51 observations, evidence immutable, audited review), `audit-log` (append-only, hook-written), `sync-jobs` (lock + checkpoint for restartable jobs). Global: `store-settings` (confirmed address/phone/email/hours/closures as defaults, audited).
- `src/lib`: integer-cent money, CSV parser, runtime system check, audit diff, idempotent source import.
- `npm run seed:sources`, `npm run doctor`, `/ops/system-check` (owner/manager only).
- Initial migration (`migrations/20260925_182201_initial.ts`).
- Storefront shell: black/cream/gold tokens (AA contrast), bundled OFL fonts, skip link, staging banner, footer from `store-settings`.
- CI: install, types, typecheck, lint, tests, migration-on-empty-DB, build.

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

Screenshots: `docs/screenshots/m1-home-desktop.png`, `m1-home-mobile.png`, `m1-home-text-200.png`,
`m1-admin-dashboard.png`, `m1-admin-source-records.png`.

## Unresolved inputs (blocking only the affected feature)

- Authorized Clover export (native IDs, SKUs, variants, stock, inactive items) — not received.
- Clover API access for the in-house sync (merchant API token; sandbox merchant for testing) — needed by milestone 5.
- Corrected price/name form, original logo, product photos, sourcing/allergen info — not received.
- Price conflict: screenshot P01–P03 ($5.95) equal DoorDash prices while P13/P15 are $4.25; observed DoorDash gaps are 30–40%, not the stated 3%.
- Physical fit: only basket sizes are known; per-product sizes are not, so fit limits will be staff-configurable counts.
- OMNIYA: confirm it is not one of the in-store-only Lebanese chocolates.
- Sympathy packaging and premium caps: assumed equal to the standard size (D15) — confirm with Lody.
- Cowboy / Baby White: price, premium cap, and whether chosen items are charged on top of the base price (D18).
- Product categories for Baby White choices (defaults "candy", "chocolate") must match milestone-3 product categories.
- All other PRD "Remaining inputs" (cowboy/Baby White prices, ceramic basis, scheduling cutoffs, shipping data, fountain terms, tax/policies).

## Next concrete step

Milestone 3: a `products` collection (approved direct-site price in cents, channel, gift types,
premium flag, category, max per gift, fit units, stock state, link to reviewed source records) whose
documents map to the engine's `BuilderProduct`; curated baskets as products with bills of
materials (price includes packaging); storefront pages (Home, Shop with search/filters, Gift
Baskets, Build a Basket UI on `validateGift`/`checkForPicker`/`assessFeasibility`, Baby Gifts,
Events, About, Contact, policies).
