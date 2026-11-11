# Lodelicious Gifts & Sweets — online store

Source for the souset-pink.com store: **Payload 3 + Next.js 16**, hosted on **Cloudflare**: Workers
(through OpenNext), D1 for the database and R2 for uploaded photos (decision D51). Local development
and the tests run the same code on plain Node with a SQLite file. Going live:
`docs/cloudflare-go-live.md`.

**AI agents and new developers: start with [`docs/AI-HANDOFF.md`](docs/AI-HANDOFF.md).**

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
| `src/lib/inventory/` | Stock ledger, atomic write batches, holds, sellable stock, curated-basket components, restock, outbox retry rules and the cron lock (D40) |
| `src/lib/clover/` | Clover inventory sync: adapter interface, fake adapter, refusing HTTP stub, push and pull workers, sync health (D43) |
| `src/lib/email/` | Transactional email templates, adapter selection (console; SMTP stub), exactly-once sending and retry (D44) |
| `src/lib/rewards/` | Member rewards (D47): program rules, member passwords and sessions, the points ledger, settling points when payments change, account service. Off until Lody approves |
| `src/lib/inquiries/` | Inquiry topics, form parsing, the fountain estimate and the inquiry service (D37) |
| `src/lib/catalog/` | Catalog queries, availability, price display (unapproved prices show as "Price to be confirmed"), the create-only seed and its guard, gift-basket grouping |
| `src/lib/payments/` | Payment provider interface. Only a test provider exists, never in production, until Clover (milestone 6) |
| `components/rewards/` | Member sign-in, join and reset forms; reward choice at checkout; program blocks |
| `components/brand/`, `components/checkout/` | SOUSET-PINK lockup, bow and awning; bag, checkout and reservation UI (forms keep entries after an error) |
| `components/inquiries/`, `components/policies/` | Inquiry and fountain forms; policy pages |
| `src/access/roles.ts` | Staff roles: owner (Lody), manager (Faisal), fulfillment |
| `migrations/` | Database migrations — production never auto-pushes schema |
| `data/source/` | Verbatim source evidence (Clover, price screenshot, DoorDash, owner product cards, allergen chart, supplier specs, basket chart) |
| `data/catalog/catalog.json` | Starting catalog for `npm run seed:catalog` |
| `data/assets/` | Logo master, product photos, product cards, supplier images (see its README) |
| `scripts/` | Run via `npx payload run scripts/<name>.ts`: `doctor`, `check-migrations`, `seed-source-records`, `seed-catalog` (refuses a live database that has products unless `SEED_FORCE=1`), `create-owner` (first owner from env), `purge-carts` (daily), `release-expired-holds` (every 5 minutes), `send-pending-emails` (every 10 minutes), `clover-push` / `clover-pull` (once the sync is verified; `CLOVER_DRY_RUN=1` for trials). On Cloudflare the scheduled ones run as Cron Triggers instead (D51). Also `export-for-d1.sh` and `upload-media-to-r2.mjs` for the move to Cloudflare |
| `tests/` | Source-data guard tests, page-render tests and Payload integration tests (catalog, checkout, reservations, gift baskets, inquiries, policies, security fixes, permissions) |
| `src/platform/` | The two hosts (D51): `node.ts` (SQLite file, uploads on disk, sharp) and `cloudflare.ts` (D1, R2) |
| `src/lib/jobs/` | The scheduled jobs as functions, shared by `scripts/` and Cloudflare's Cron Triggers |
| `wrangler.jsonc`, `open-next.config.ts`, `cloudflare-worker.mjs` | Cloudflare: bindings and schedules, OpenNext settings, the Worker entry (requests plus the cron handler) |
| `server.js` | Plain Node server for the staging preview on this Mac (`npm run serve`); not used on Cloudflare |

## Local development

Node 24 (anything ≥ 20.9 works). This runs on plain Node with a SQLite file in `.data/`.

```bash
npm ci
cp .env.example .env               # then set PAYLOAD_SECRET
mkdir -p .data/media
npm run seed:catalog               # migrate + source records, 7 categories, photos, 80 products, closed dates (create-only)
npm run dev                        # http://localhost:3000, admin at /admin (first account becomes owner)
```

Production-like run on Node: `npm run build && NODE_ENV=production npx payload migrate && npm run serve`.

## Hosting: Cloudflare Workers, D1 and R2

`DEPLOY_TARGET=cloudflare` (set by the `cf:*` scripts) builds the same app for Workers. Everything
here runs against wrangler's local emulation; only the `:remote` and `deploy` commands touch a real
Cloudflare account. The full runbook, including moving an existing database and photos, is
`docs/cloudflare-go-live.md`.

```bash
cp .dev.vars.example .dev.vars     # then set PAYLOAD_SECRET (the preview's settings)
npm run cf:migrate                 # migrations on the local D1
npm run cf:build                   # OpenNext build into .open-next/
npm run cf:preview                 # the Worker on http://localhost:8799 with local D1 and R2
npm run cf:size                    # compressed size (limit: 10 MB on the paid plan)
npm run cf:migrate:remote          # migrations on the real D1 (needs `wrangler login`)
npm run cf:deploy                  # production build and deploy
```

What differs from a Node host (D51): photos uploaded on Cloudflare get no resized copies (no sharp),
the rate limiter uses Cloudflare's bindings, the cron scripts run as Cron Triggers, logs go to
Workers Logs, and the Workers Paid plan is required (the Worker is about 4.7 MB compressed).
`@opennextjs/cloudflare` is pinned to 1.20.7 because newer releases need a newer Next.js.

**Environment:** `.env.example` documents every variable. The important ones:
- `APP_ENV` is `local`, `staging` or `test` for anything that isn't the live store. Only those values
  enable the test payment provider, unapproved photos, draft policies, the staging banner and
  `PREVIEW_ASSUME_STOCK`. Unset or anything else counts as live (D41).
- `NEXT_PUBLIC_SITE_URL` turns on the CSRF allowlist. Leave it unset locally and on tunnels.
- `FIRST_OWNER_EMAIL` (or `OWNER_EMAIL` / `OWNER_PASSWORD` with `scripts/create-owner.ts`) secures
  the first owner account. Deploy steps are in `STATUS.md` → "Deploying".
- Email: `EMAIL_TRANSPORT` (unset = console), `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SMTP_*`, and
  `EMAIL_SEND_LIVE=1` on a live host. Nothing is sent until a service is installed (D44).
- Clover: `CLOVER_ENVIRONMENT`, `CLOVER_MERCHANT_ID`, `CLOVER_API_TOKEN`, plus `CLOVER_SYNC_LIVE=1`
  for production and `CLOVER_ADAPTER=fake` for local trials (D43).
- Secrets (`PAYLOAD_SECRET`, Clover token, SMTP password) are set on the Worker with
  `npx wrangler secret put <NAME>`, never in the repo; non-secret settings are `"vars"` in
  `wrangler.jsonc`. Generate `PAYLOAD_SECRET` with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

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

The admin is grouped by task (D45):

| Group | What's there |
| --- | --- |
| Orders | Orders, basket reservations and inquiries. Each order and reservation opens on a plain summary; the stored snapshot is on its Record data tab |
| Catalog | Products and categories |
| Inventory | Stock adjustments (the only way to change stock: counts, adjustments, restocks), stock history and checkout holds |
| Website | Photos, store details (contact, opening hours, story, allergy notice), the home page and the customer policies |
| Settings | Tax classes, checkout & reservations (pickup times, closed dates, deposits), gift builder rules, the chocolate fountain, inventory settings |
| Staff | Staff accounts and the audit log |
| System | The Clover outbox and sync jobs (read-only, for monitoring), and the imported source records the catalog was reconciled from |

Only the owner can approve a policy, and only approved text shows live. The product form's stock fields are
read-only; every stock change is a ledger row and queues a Clover update in the outbox.

The security and accessibility review and what was fixed are in `docs/audit-2026-10-06.md`.

## Rules this codebase follows

- Money is integer cents (`src/lib/money.ts`). No floats in prices, budgets or packaging.
- Source prices (Clover, screenshot, DoorDash) are evidence, never website prices, until approved.
- Source evidence is immutable after import; only review fields change, and every change is audited.
- No secrets in the repository. Production secrets are Worker secrets (`wrangler secret put`).
- Nothing here activates live payments, changes DNS, buys services or replaces the live site.
