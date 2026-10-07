# Lodelicious Gifts & Sweets — online store

Source for the souset-pink.com store: **Payload 3 + Next.js 16** on SQLite, run as a cPanel Node.js
app (Passenger/LiteSpeed) on Namecheap Stellar Business. Same architecture as `Farhanx64/pasto-hair`.

Requirements: `Lodelicious-Gifts-and-Sweets-PRD.docx` v2.0 (September 25, 2026). Progress, test
results and open inputs: [`STATUS.md`](STATUS.md). Engineering decisions, including why this is not
the PRD's WooCommerce baseline: [`docs/decisions.md`](docs/decisions.md).

## Layout

| Path | What it is |
| --- | --- |
| `app/(frontend)/` | Customer storefront (server components) |
| `app/(payload)/` | Payload admin (`/admin`) and REST API — generated, do not hand-edit (GraphQL is disabled, D41) |
| `app/healthz`, `app/ops/system-check` | Health probe (public) and runtime checks (owner/manager only) |
| `collections/`, `globals/` | Payload schema and access rules |
| `src/lib/` | Framework-free logic with unit tests: money in cents, CSV, system checks, audit diff, import, `app-env.ts` (the APP_ENV allowlist), `rate-limit.ts`, `password-policy.ts`, `policies.ts` (policy drafts and approval) |
| `src/lib/gifts/` | Gift-builder rules engine: counts, packaging, premium caps, budget, repeats, stock, fit, special presentations |
| `src/lib/checkout/` | Bag pricing, tax classes, basket deposits, pickup slots, and the order and reservation services (D34–D36) |
| `src/lib/inquiries/` | Inquiry topics, form parsing, the fountain estimate and the inquiry service (D37) |
| `src/lib/catalog/` | Catalog queries, availability, price display (unapproved prices show as "Price to be confirmed"), the create-only seed and its guard, gift-basket grouping |
| `src/lib/payments/` | Payment provider interface. Only a test provider exists, never in production, until Clover (milestone 6) |
| `components/brand/`, `components/checkout/` | SOUSET-PINK lockup, bow and awning; bag, checkout and reservation UI (forms keep entries after an error) |
| `components/inquiries/`, `components/policies/` | Inquiry and fountain forms; policy pages |
| `src/access/roles.ts` | Staff roles: owner (Lody), manager (Faisal), fulfillment |
| `migrations/` | Database migrations — production never auto-pushes schema |
| `data/source/` | Verbatim source evidence (Clover, price screenshot, DoorDash, owner product cards, allergen chart, supplier specs, basket chart) |
| `data/catalog/catalog.json` | Starting catalog for `npm run seed:catalog` |
| `data/assets/` | Logo master, product photos, product cards, supplier images (see its README) |
| `scripts/` | Run via `npx payload run scripts/<name>.ts`: `doctor`, `check-migrations`, `seed-source-records`, `seed-catalog` (refuses a live database that has products unless `SEED_FORCE=1`), `create-owner` (first owner from env), `purge-carts` (daily cron) |
| `tests/` | Source-data guard tests, page-render tests and Payload integration tests (catalog, checkout, reservations, gift baskets, inquiries, policies, security fixes, permissions) |
| `server.js` | Passenger/LiteSpeed entry point (no top-level await — see comment) |

## Local development

Node 24 (what the cPanel host runs; anything ≥ 20.9 works).

```bash
npm ci
cp .env.example .env               # then set PAYLOAD_SECRET
npm run seed:catalog               # migrate + source records, 7 categories, photos, 80 products, closed dates (create-only)
npm run dev                        # http://localhost:3000, admin at /admin (first account becomes owner)
```

Production-like run: `npm run build && NODE_ENV=production npx payload migrate && npm run serve`.

**Environment:** `.env.example` documents every variable. The important ones:
- `APP_ENV` is `local`, `staging` or `test` for anything that isn't the live store. Only those values
  enable the test payment provider, unapproved photos, draft policies, the staging banner and
  `PREVIEW_ASSUME_STOCK`. Unset or anything else counts as live (D41).
- `NEXT_PUBLIC_SITE_URL` turns on the CSRF allowlist. Leave it unset locally and on tunnels.
- `FIRST_OWNER_EMAIL` (or `OWNER_EMAIL` / `OWNER_PASSWORD` with `scripts/create-owner.ts`) secures
  the first owner account. Deploy steps are in `STATUS.md` → "Deploying".

**Dependencies:** change them with npm 11 (bundled with Node 24; on older Node use
`npx npm@11 install <pkg>`). npm 10 crashes while resolving this tree, but `npm ci` works with
either version against the committed lockfile.

**Migrations:** always `npm run migrate` (never bare `payload migrate`): it migrates and then fails
loudly if anything is still pending — bare `payload migrate` has exited 0 without applying anything.
Schema push is disabled (decision D23); after changing a collection run
`npx payload migrate:create <name>` and commit the generated files.

**Managing the catalog:** everything customers see is edited in `/admin` — Products (draft/publish,
price, options such as pink/blue, stock, gift-builder settings, allergens), Categories, Media,
Gift builder rules and Store settings. The seed never overwrites those edits. Curated gift baskets
are products in the Gift Baskets category: inquiry-only until Lody approves the price and they are
switched to "Sold online" (D38).

## Checks

```bash
npm run typecheck
npm run lint
npm test                 # unit + integration (each test file gets a throwaway SQLite DB)
npm run doctor           # this shell's runtime vs host requirements + DB reachability
```

The web process can have different env/NODE_OPTIONS from SSH: log in to `/admin`, then open
`/ops/system-check`.

Orders, basket reservations and inquiries are under /admin → Orders. Under /admin → Settings:
- Checkout & reservations: tax classes, pickup hours, closed dates and basket deposits.
- Events: the chocolate fountain price and terms.
- Policies: customer policies. Only the owner can approve them, and only approved text shows live.

The security and accessibility review and what was fixed are in `docs/audit-2026-10-06.md`.

## Rules this codebase follows

- Money is integer cents (`src/lib/money.ts`). No floats in prices, budgets or packaging.
- Source prices (Clover, screenshot, DoorDash) are evidence, never website prices, until approved.
- Source evidence is immutable after import; only review fields change, and every change is audited.
- No secrets in the repository. Production env lives in the cPanel Node app settings.
- Nothing here activates live payments, changes DNS, buys services or replaces the live site.
