# Project status

Last updated: 2026-09-25 · Branch: `claude/sweet-meitner-2hnl84`

**Stack:** Payload 3.90.2 + Next.js 16.3.6 + SQLite on a cPanel Node app (see `docs/decisions.md`
D9). Replaces the first WooCommerce build (commit 5c36c77, kept in history). SKU IQ replaced by an
in-house Clover sync (D10).

## Milestones

| # | Milestone | State |
| --- | --- | --- |
| 1 | Project setup | **Done** (rebuilt on Payload) |
| 2 | Gift-builder rules engine (presentations, counts, premium caps, budget, repeats, fit) | Next |
| 3 | Catalog + storefront (products from reviewed source records, pages, search/filters) | Not started |
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

## Test results (2026-09-25)

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
- Node version offered by the cPanel Node.js selector on this account (needs ≥ 20.9).
- All other PRD "Remaining inputs" (cowboy/Baby White prices, ceramic basis, scheduling cutoffs, shipping data, fountain terms, tax/policies).

## Next concrete step

Milestone 2: `src/lib/gifts/` — presentation definitions seeded from `data/source/basket-chart.csv`
plus cowboy/Baby White/ceramic special rules, a validator returning explainable violations
(count range, premium cap, budget incl. packaging, repeat groups, exclusions, unknown stock), a
`presentations` collection so Lody can edit rules, and vitest coverage for PRD AC 02/AC 03
(large sympathy 13–16, no duplicate packaging on curated baskets).
