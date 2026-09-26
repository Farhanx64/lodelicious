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
| `app/(payload)/` | Payload admin (`/admin`) and REST/GraphQL API — generated, do not hand-edit |
| `app/healthz`, `app/ops/system-check` | Health probe (public) and runtime checks (owner/manager only) |
| `collections/`, `globals/` | Payload schema and access rules |
| `src/lib/` | Framework-free logic (money in cents, CSV, system checks, audit diff, import) with unit tests |
| `src/lib/gifts/` | Gift-builder rules engine: counts, packaging, premium caps, budget, repeats, stock, fit, special presentations |
| `src/access/roles.ts` | Staff roles: owner (Lody), manager (Faisal), fulfillment |
| `migrations/` | Database migrations — production never auto-pushes schema |
| `data/source/` | Verbatim source evidence (Clover, price screenshot, DoorDash, owner product cards, allergen chart, supplier specs, basket chart) |
| `data/catalog/catalog.json` | Starting catalog for `npm run seed:catalog` |
| `data/assets/` | Logo master, product photos, product cards, supplier images (see its README) |
| `scripts/` | `doctor.ts`, `check-migrations.ts`, `seed-source-records.ts`, `seed-catalog.ts` (run via `payload run`) |
| `tests/` | Source-data guard tests and Payload integration tests |
| `server.js` | Passenger/LiteSpeed entry point (no top-level await — see comment) |

## Local development

Node 24 (what the cPanel host runs; anything ≥ 20.9 works).

```bash
npm ci
cp .env.example .env               # then set PAYLOAD_SECRET
npm run seed:catalog               # migrate + source records, categories, photos, 22 products (create-only)
npm run dev                        # http://localhost:3000, admin at /admin (first account becomes owner)
```

Production-like run: `npm run build && NODE_ENV=production npx payload migrate && npm run serve`.

**Dependencies:** change them with npm 11 (bundled with Node 24; on older Node use
`npx npm@11 install <pkg>`). npm 10 crashes while resolving this tree, but `npm ci` works with
either version against the committed lockfile.

**Migrations:** always `npm run migrate` (never bare `payload migrate`): it migrates and then fails
loudly if anything is still pending — bare `payload migrate` has exited 0 without applying anything.
Schema push is disabled (decision D23); after changing a collection run
`npx payload migrate:create <name>` and commit the generated files.

**Managing the catalog:** everything customers see is edited in `/admin` — Products (draft/publish,
price, options such as pink/blue, stock, gift-builder settings, allergens), Categories, Media,
Gift builder rules and Store settings. The seed never overwrites those edits.

## Checks

```bash
npm run typecheck
npm run lint
npm test                 # unit + integration (each test file gets a throwaway SQLite DB)
npm run doctor           # this shell's runtime vs host requirements + DB reachability
```

The web process can have different env/NODE_OPTIONS from SSH: log in to `/admin`, then open
`/ops/system-check`.

## Rules this codebase follows

- Money is integer cents (`src/lib/money.ts`). No floats in prices, budgets or packaging.
- Source prices (Clover, screenshot, DoorDash) are evidence, never website prices, until approved.
- Source evidence is immutable after import; only review fields change, and every change is audited.
- No secrets in the repository. Production env lives in the cPanel Node app settings.
- Nothing here activates live payments, changes DNS, buys services or replaces the live site.
