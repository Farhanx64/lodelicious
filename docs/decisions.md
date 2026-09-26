# Engineering decisions

Reversible choices made during implementation. Each notes what would change it.

## D9 — Payload 3 + Next.js 16 instead of the PRD's WooCommerce baseline (2026-09-25)

**Decision (project lead):** build on Payload 3.90.2 + Next 16.3.6 with SQLite, the stack already
running in production for `Farhanx64/pasto-hair` on cPanel/Passenger. The PRD (INF 02) lists
WordPress/WooCommerce as a proposed engineering baseline, not a client requirement; the build
prompt requires the migration implications to be recorded. They are:

| Area | WooCommerce gave us | Now |
| --- | --- | --- |
| Cart, checkout, orders, refunds, order emails, tax | Built in | Built here (milestones 4–6). `@payloadcms/plugin-ecommerce` exists but ships only a Stripe adapter and generic carts; gift snapshots, BOM reservations and price approval need our own collections |
| Clover payments | Third-party gateway plugins (not evaluated) | Custom integration with Clover's tokenized fields (same PRD rules) |
| Database | MySQL (host native) | SQLite via libSQL — Payload has no MySQL adapter. Single writer, which makes atomic stock reservations simpler; backups will be taken with SQLite's online backup (planned in the deployment milestone; a plain file copy of a live database is not safe) |
| Memory | Per-request PHP | Resident Node process: measured **~215 MB RSS** after admin + storefront use, with the V8 heap capped at 768 MB (`NODE_OPTIONS=--max-old-space-size=768`) inside the 2 GB account limit |
| Builds | None | `next build` is OOM-killed by the host's limits (pasto-hair runbook) → build on GitHub Actions, deploy source + `.next` tarball |
| Maintainers | Large WordPress pool | TypeScript/Payload developers |

Owner impact to tell Lody: no change to what she approves or pays for; the admin is at `/admin`
instead of `/wp-admin`.

## D10 — In-house Clover inventory sync instead of SKU IQ (2026-09-25)

SKU IQ is a paid subscription and its connector targets WooCommerce. We sync directly with the
Clover REST API using a merchant-scoped API token: Clover inventory webhooks (to be verified in a
Clover sandbox) plus a cPanel cron poll as a safety net, an outbox for website sales, and our own
component (BOM) deductions. Recorded against PRD INF 01–06; the reconciliation, freshness and
"unknown stock blocks purchase" rules are unchanged.

## D11 — Source evidence is immutable; review is audited

`source-records` evidence fields (ref, source, name, brand, price, dates) cannot be edited through
the admin or API by anyone, including the owner. Re-importing a changed file reports a conflict
instead of overwriting (PRD CAT 02). Disposition, duplicate link and review notes are editable by
owner/manager only; each change stamps the reviewer and writes an `audit-log` entry.

## D12 — First account becomes owner

Payload's create-first-user screen bypasses access control, so a hook forces the first account's
role to `owner`. Afterwards only the owner creates staff and changes roles. Price/refund rights
(`canManageCommerce`) are owner + manager only (PRD OPS 01).

## D13 — Bundled fonts, no third-party requests

Cormorant Garamond and Source Sans 3 (SIL OFL) are committed as latin woff2 files and loaded with
`next/font/local`. No Google Fonts request at build or run time; the admin uses Payload's built-in
avatar instead of Gravatar, so staff email hashes never leave the site.

## D14 — Node 24; lockfile written by npm 11

The host runs Node 24 (pasto-hair's live `/healthz` reports v24.16.0 on the same Namecheap cPanel
setup), which bundles npm 11; CI uses Node 24 too. npm 10 crashes resolving this dependency tree,
so dependencies are changed with npm 11; vite 8's optional peers (`esbuild`, `yaml`) are declared
as dev dependencies so the hoisted versions are valid. `npm ci` works with npm 10 and 11.

## D15 — Sympathy baskets reuse standard packaging and premium caps (assumption)

The chart gives sympathy counts (small 6–8, medium 10–12, large 13–16) but no separate packaging
fee or premium cap. Sympathy uses the standard size's fee and cap (large sympathy: $29.95, 3
premium items, 13–16 items). Editable in **Gift builder rules**; confirm with Lody.

## D16 — Premium is a verified per-product flag

The engine never infers premium status (or anything else) from a product name or brand text
(PRD GFT 05); a test renames a product and expects identical results. Whether OMNIYA conflicts with
the in-store-only Lebanese chocolates is still open.

## D17 — Fit = product fit units vs optional container capacity

Each product has `fitUnits` (default 1) and each size/presentation an optional capacity. Until
products are measured, capacity stays empty and only counts apply — the builder never claims a
physical fit it hasn't been told about.

## D18 — Special presentations: pricing basis configurable, purchase blocked until priced

Cowboy and Baby White have no price, premium cap or confirmed pricing basis (base + chosen items vs
fixed). They are inquiry-only; the settings screen refuses to mark one "available" without a price
and premium maximum. Filled ceramics are disabled until the empty-vs-filled basis is confirmed. No
special presentation is ever charged the standard packaging fee.

## D19 — Baby ceramics: three shapes, pink/blue options, assumed prices

The supplied planters are three separate shapes (bowl, shoes, "BABY" block) in pink and blue. The
brief's "small 5×5×4 $14.95 / large 8×4×4 $19.95" matches none of them; the project lead assigned
**bowl & block $14.95, shoes $19.95** (2026-09-26). Seeded as three products with pink/blue options,
`priceApproved: false` until Lody confirms the prices and that they are empty-container prices.
Filled versions are three gift presentations (`ceramic_bowl/shoes/block`), disabled until item
counts for each opening are confirmed. "Approximately 5 of each" is not a count → stock unknown.

## D20 — Photo publishing

Photos from Lody's product zip are approved for launch. Supplier catalog images (bassinet, planters
and their per-shape crops) are `approvedForLaunch: false`: shown in staging, replaced by "Photo
coming soon" when `APP_ENV=production`, until Lody confirms rights. The bassinet photo includes a
rattle that is not included; the Baby White description says so.

## D21 — Logo derivation

Master kept at `data/assets/brand/Sticker_2.5_inch.pdf`. The artwork contains two raster CMYK images,
so an SVG export would only wrap a 5 MB bitmap; instead it is rendered at 600 dpi with transparency
and exported as `public/brand/logo-{512,1024}.png`. The favicon/apple icon use the central basket
mark on a white roundel (the ring text is unreadable at 32 px). The wordmark reads "LODELICIOUS /
GIFTS & SWEETS" — consistent with the final store name.

## D22 — Owner product cards are approved prices; stock still blocks purchase

Lody's product cards (2026-09-26) are her own direct-price material, newer than the price-list
screenshot, Clover and DoorDash observations. Seeded products use card prices with
`priceApproved: true` and link to every source row they reconcile (`sourceRecords`). All differences
are listed in `docs/reconciliation.md`. Nothing is purchasable until stock is counted (stock state
"unknown" by default). Allergen/dietary fields come only from Lody's allergen chart; products without
a chart row stay "unknown".

## D23 — Migrations only; no schema push anywhere

Payload's dev-mode schema push on SQLite failed on alternate runs (re-creating existing indexes) and
marks the database so that a later non-interactive `payload migrate` can exit 0 without applying
anything. `push: false` everywhere; `npm run migrate` = `payload migrate` + `scripts/check-migrations.ts`,
which exits 1 if any migration file is not recorded in the database. `dev`, seed scripts, CI and
integration tests (via `db.migrate()`) all use migrations. A silent no-op migrate was reproduced once
more even on a fresh file (cause not isolated), which is why the check — not migrate's exit code —
is the gate.

## D24 — Catalog is admin-owned; the seed is create-only

`npm run seed:catalog` creates categories, media and products that don't exist yet and never
updates or deletes anything, so edits in /admin always win. Products use Payload drafts (publish /
unpublish) and keep 25 versions. Owner and manager can create, edit, publish and delete products
and categories; fulfillment staff can read but not change them. Price, stock, channel, premium,
gift-type and status changes are audited.

## Superseded (WooCommerce build, commit 5c36c77)

D1–D8 described the WordPress 7.1.2 / WooCommerce 11.1.2 baseline (PHP plugin, classic theme,
MariaDB local preview). Superseded by D9. Still applicable in spirit: integer cents (D5 → `money.ts`),
configured-vs-effective runtime checks (now `system-check.ts`), tax off until owner-approved classes
exist (D7), bundled/self-hosted fonts (D8 → D13).
