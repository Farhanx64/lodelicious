# Project status

Last updated: 2026-09-25 · Branch: `claude/sweet-meitner-2hnl84`

## Milestones

| # | Milestone | State |
| --- | --- | --- |
| 1 | Project setup | **Done** — see below |
| 2 | Gift-builder rules engine (presentations, counts, premium caps, budget, repeats, fit) | Next |
| 3 | Catalog + storefront (source-record import, dispositions, pages, search/filters) | Not started |
| 4 | Cart, checkout, order snapshots, staff roles, assembly views | Not started |
| 5 | Inventory: BOM, atomic reservations, expiring holds, outbox, stock freshness | Not started |
| 6 | Payments (Clover embedded) and shipping (USPS) adapters — fixture-tested only until credentials exist | Not started |

## Milestone 1 — completed

- Repository layout: `plugins/lodelicious-gifts` (rules/operations), `themes/lodelicious` (presentation), `data/source` (evidence), `bin` (local preview), `docs`.
- Local preview: WordPress 7.1.2 + WooCommerce 11.1.2 + WP-CLI 2.12.0, MariaDB in `.local/`, PHP built-in server with production limits. `bin/setup-local.sh` is idempotent (verified by re-running).
- Plugin: bootstrap with WooCommerce dependency and HPOS/block-checkout compatibility declarations; PSR-4 autoloader (no vendor on host); integer-cent `Money`; versioned schema with `ldl_audit_log` and `ldl_jobs`; `AuditLog::record`; `SystemCheck` + `wp lodelicious doctor` (CLI) + Tools → Lodelicious system check (web).
- Theme: black/cream/gold tokens (contrast verified: 5.8:1 to 17.1:1), skip link, visible focus, staging banner outside production, footer with confirmed address/hours/closures/contact.
- Source evidence transcribed: 20 Clover, 19 screenshot, 12 DoorDash rows, 9-row basket chart (matches the owner's chart image, including large sympathy 13–16).
- CI workflow: lint + PHPUnit on PHP 8.1 and 8.3.

## Test results (2026-09-25)

| Command | Result |
| --- | --- |
| `vendor/bin/phpunit` (plugin) | OK — 23 tests, 214 assertions |
| `composer lint` | OK |
| `wp lodelicious doctor` with `-d memory_limit=512M -d max_execution_time=300` | All checks pass (configured 512M; effective -1 set by WP-CLI, see D5) |
| `wp lodelicious doctor` with `-d memory_limit=256M` | Fails `memory_limit` as expected |
| Web: Tools → Lodelicious system check | PHP 8.4.19, 512M, 300 — pass |
| HTTP smoke: `/`, `/shop/`, `/cart/`, `/my-account/` | 200; `/checkout/` 302 (empty cart) |
| Keyboard: first Tab → skip link (desktop 1280, mobile 390) | Pass |
| Horizontal scroll at 390px and at 200% root text size | None |
| Debug log after page loads | Clean (only wordpress.org update-check warnings caused by the build sandbox's egress policy) |

Screenshots: `docs/screenshots/m1-home-desktop.png`, `m1-home-mobile.png`, `m1-home-text-200.png`
(shell only — nav menu and pages arrive in milestone 3).

## Assumptions (reversible)

See `docs/decisions.md` D1–D8. Key ones: PHP 8.1 floor for the plugin; no paid extensions; tax off
until configured; fonts to be self-hosted.

## Unresolved inputs (blocking only the affected feature)

- Authorized Clover export (native IDs, SKUs, variants, stock, inactive items) — the brief says "will attach below"; not received.
- Corrected price/name form (Q8), original logo, product photos (Q10), sourcing/allergen info (Q11) — not received.
- Price conflict: screenshot rows P01–P03 ($5.95) equal DoorDash prices, while P13/P15 are $4.25; observed DoorDash gaps are 30–40%, not the stated 3%. Direct-site prices for these bars need Lody's confirmation.
- Physical fit: the chart gives basket diameters only; no per-product size data exists, so fit limits will be staff-configurable counts until measured.
- OMNIYA: confirm it is not one of the in-store-only Lebanese chocolates (premium list vs exclusion).
- All other PRD "Remaining inputs" items stand (cowboy/Baby White prices, ceramic basis, scheduling cutoffs, shipping data, fountain terms, tax/policies, SKU IQ plan).

## Next concrete step

Milestone 2: add `src/Domain/Gift/` — presentation definitions seeded from `data/source/basket-chart.csv`
plus cowboy/Baby White/ceramic special rules; a `BasketValidator` that returns explainable violations
(count range, premium cap, budget incl. packaging, repeat groups, exclusions, unknown stock); and
PHPUnit coverage for every PRD AC 02/AC 03 rule, including large sympathy 13–16 and no duplicate
packaging on curated baskets.
