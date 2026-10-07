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

## D25 — Clover's in-store price wins (Lody, 2026-09-30)

When the website and Clover disagree, the current Clover price is correct. Products are matched to
Clover by Clover item ID (`cloverId`), never by name: the export has no SKUs. Applied to the seed:
Dr. Seuss Book $7.95 → $6.25 and Greeting Cards $3.95 → $2.95. Teddy Bear stays $14.95 and unlinked
because Clover has two teddies ($10.95 "Teddy Bear", $14.95 "Teddy Bear Vintage Collection").
Phillips Dark and Milk bars both link to the single Clover item "Philips Chocolate Bar" until Lody
splits it. The later sync (milestone 5) should read prices from Clover rather than overwrite them.

## D26 — In-store reserve per product

Lody wants a few units of each item kept for in-store customers, decided per product. Products have
`onlineReserve` (default 1, editable in /admin, applies to each option). The website sells only
`stockQuantity − onlineReserve`: with the default, it stops when 1 is left. The low-stock label uses
the same sellable figure, and the gift builder sees only the sellable quantity.

## D27 — Extra Large basket off for now

Lody prefers no Extra Large basket rather than padding it with products. Basket sizes have an
"Offered to customers" switch in Gift builder settings. Extra Large keeps its PRD rules (18–20 items,
$37.95, 4 premium) but is off: the builder hides it, never suggests it, and validation refuses it
(`SIZE_UNAVAILABLE`). The migration switches it off in existing databases too. At least one size must
stay offered.

## D28 — Local delivery is DoorDash

Website orders offer in-store pickup and shipping where applicable (shipping arrives with checkout,
milestone 6); local delivery sends customers to the shop's DoorDash page. The product "Local delivery"
flag was removed; Store settings has a "DoorDash store page" link (empty until Lody sends it) shown on
the home page and footer when set. DoorDash prices remain channel prices and never website prices.

## D29 — Clover export items added as products

The project lead chose to add every sweet and gift from Lody's Clover export that wasn't on the site
yet: 49 products with the Clover name (spelling and capitalisation tidied), Clover price (approved per
D25), Clover ID and source record, no description, no photo ("Photo coming soon"), allergen fields
"unknown", and **not** basket-eligible until Lody reviews each one. "(Nut Free)" was dropped from one
title so the name makes no allergen claim. Left out, pending Lody: coffee, drinks, gelato,
ice-cream-truck items, Dubai cups, pancake flavours, savory items (she will name them later), and
OMNIYA chocolates (the Lebanese in-store-only question is still open). The full list is in
`docs/reconciliation.md`.

## D30 — Ivory, linen, gold and coastal blue (Lody's mood board, 2026-10-02)

Replaces the black/cream/gold look (D13's colours). The page is ivory with linen and blush
surfaces. Headings, nav, prices and buttons are gold, products and baskets sit in thin double gold
frames, and coastal blue appears toward the bottom: the "Getting your order" band and the footer.

- **Gold words use `--color-gold-text` `#7A5C22`** (5.9:1 on ivory). The board's antique gold
  `#B08D57` is 2.9:1 on ivory, which fails WCAG for any text, so it is used only for frames, rules
  and ornaments. Coastal blue `#A9C1DB` is never text either.
- Body text stays a warm dark brown `#3B2F25` (12:1) for readability.
- `tests/theme-contrast.test.ts` reads the tokens from `app/globals.css`. It fails if any text
  colour drops below 4.5:1 on any surface, or if antique gold or coastal blue is used as a text
  class.
- The name and sticker logo are unchanged (project lead): the board's "Souset-Pink" bow is
  reference art, not her logo.
- "Our story" is a Store settings field that Lody writes in /admin. The footer shows it only when
  it is filled in; we don't write her story for her.

## D31 — Exact match to the SOUSET-PINK mood board (client-directed, 2026-10-03)

The client asked for the site to be "super accurate" to Lody's mood board. This supersedes D30's
colours and D21's logo-in-header.

- **Colours sampled from the board image:**

  | Board colour | Hex |
  | --- | --- |
  | page | `#F7F2EE` |
  | Ivory | `#F7F0EA` |
  | Linen | `#EADCCF` |
  | Blush | `#EFD5CE` |
  | Coastal Blue | `#98A9B9` |
  | bow and rules | `#B99870` |
  | wordmark gold | `#9C7F5B` |
  | nav lettering | `#605B57` |

  `tests/theme-contrast.test.ts` pins these.
- **Accessibility deviation, accepted by the project lead for the client:** all gold text uses the
  board's wordmark gold, which is 3.4:1 on the page and below WCAG AA's 4.5:1. That covers the
  headings, prices, buttons, labels and icons. The PRD requires AA, so Lody must accept this
  knowingly. Body text (11.7:1), the nav (6.0:1), errors and focus outlines stay AA. The test fails
  if the gold drifts, or if it is ever raised to AA so this note can be retired.
- **Brand:**
  - The brand is **SOUSET-PINK** with a gold bow and "Sweets · Chocolates · Gifts". The name and
    tagline are Store-settings fields, renamed by migration unless staff had changed the name.
  - The bow is our own vector line drawing, not the board's artwork.
  - Lodelicious remains on products whose bags carry that label.
- **Layout from the board:**
  - A centred lockup.
  - A nav bar of SHOP · SWEETS · CHOCOLATES · GIFTS · bow · CUSTOM BASKETS · ABOUT with search,
    account, wishlist and bag icons. Phones get a Menu disclosure.
  - A drawn ivory awning with a scalloped gold hem.
  - A five-photo strip, from /admin → Home page.
- **No AI board photos:**
  - The strip shows palette panels with the bow until Lody uploads her own photos.
  - The awning is an illustration, not a storefront photo.
- **Account, wishlist and bag** lead to "coming soon" pages (noindex) until those features exist.
  Accounts and wishlists are not in the PRD.
- **New `/about` page** shows the Store-settings story, or "coming soon".

## D32 — Mood-board photos as temporary home-page placeholders (2026-10-03)

The project lead asked to use some of the board's own pictures "for now", editable later in /admin.
Only the flower, truffle and gift-box photos are used, in the original five-box strip. The top keeps
the drawn awning, and the board's middle row is not used.

- `scripts/moodboard-crops.ts` cuts five photos into `data/assets/moodboard/`; `SOURCE.md` there
  records the hash and the crop boxes. In strip order:
  1. hydrangea vase
  2. truffles
  3. pink-bow gift box
  4. hydrangeas
  5. blue-ribbon gift boxes
- They are seeded as Media with **"approved for launch" off** and the credit "Placeholder from Lody's
  mood board (AI-generated)". They fill /admin → Home page → Photo strip only while the strip is
  empty, so staff edits are never overwritten.
- **They show on staging/preview only.** `isImagePublishable` hides unapproved images in production,
  so on the live site each box shows the gold-bow panel instead. They are AI-generated and not
  photos of her shop, so the aim is for Lody to replace them with her own photos.
- Home page → "Top photo" is optional: an uploaded and approved shop photo replaces the drawn awning.

## D33 — Shop Favorites layout is Lody's choice; slider by default (2026-10-04)

The project lead didn't like the 4-across grid, where a 5th product sits alone on a second row.
/admin → Home page → "Shop Favorites layout" offers three layouts:

| Layout | Products shown |
| --- | --- |
| **Slider** (default) | up to 12 |
| **2 × 2 grid** | 4 |
| **3 across × 2 rows** | 6 |

On phones the grids show two columns, or one when text is enlarged.

The slider auto-plays at the project lead's request: it advances one card every 5 s and loops.
WCAG 2.2.2 requires that movement can be stopped, so:
- it has a Pause/Play button
- it holds still while hovered or while anything in it has keyboard focus, and while the tab is
  hidden
- it never auto-plays for people who prefer reduced motion
- pressing an arrow pauses it until Play is pressed

Swipe and trackpad scrolling use native scroll-snap. When the cards don't overflow, the controls are
not rendered at all.

## D34 — Tax classes, approved by Lody (2026-10-05, updated 2026-10-06)

Tax comes from **Settings → Tax classes**: each class has a name, a rate in basis points
(625 = 6.25%) and an "approved" tick. Products may name a class; others use the default class in
**Checkout & reservations**, which also names the class for basket packaging.

- Tax is rounded half-up per line.
- The seed creates one class, Clover's 6.25% "Sales Tax", **approved**. On 2026-10-06 Lody confirmed
  it applies to all products; the Clover inventory export v2 lists all 105 items on the default
  Sales Tax with no per-item overrides. It is the default and packaging class.
- Existing databases seeded before this change hold the class unapproved — tick "approved" in
  /admin → Tax classes (the seed is create-only and won't change it).
- While any class in a sale is unapproved, totals say "Estimated tax (to be confirmed)". A real
  (non-test) payment provider will refuse to take orders until tax is approved (PRD: "no pending
  policy becomes a silent checkout default").

## D35 — Bag, checkout and orders; test payments only (2026-10-05)

- **The bag:**
  - It holds shop products only, in a server-side `carts` record that only the server can read.
  - The browser has an httpOnly random token, not a price. Prices, availability, the in-store
    reserve and tax are re-read at every view and at checkout.
  - Unavailable lines block checkout; over-stock quantities are reduced with a note.
- **Checkout:**
  - Fields: contact details, a pickup time from admin-set pickup hours (slot length, hours of
    notice, days ahead, closed dates) and notes.
  - Pickup is the only method: local delivery is DoorDash (D28), and USPS comes with milestone 6.
- **Orders:**
  - An immutable snapshot of what was bought at what price, with separate payment status (pending,
    paid, failed, refunded) and fulfillment status.
  - A double submit is one order: the idempotency key is unique, and a simultaneous duplicate
    returns the winner.
  - Guest confirmation pages need a secret URL token; only its hash is stored.
  - Staff can read orders and fulfillment staff can move them along. Only owner and manager can
    change payment status (OPS 01). Snapshot fields are read-only for everyone.
- **Payments:**
  - A `PaymentProvider` interface. Only a **test provider** exists, and only outside production:
    "Place test order", no money moves, and orders are flagged as test.
  - Production has no provider, so ordering is closed with "call to order" until Clover is
    connected with Lody's approval (milestone 6).
- **Not yet:**
  - stock reservations or decrements (milestone 5)
  - order emails (no sending configured; logged instead)

## D36 — Custom baskets are reservations with a deposit (2026-10-05)

At the project lead's direction, Build a Basket is separate from the bag: a finished basket is
**reserved**, and a deposit is paid up front.

- **Admin settings** (Checkout & reservations → Basket deposits):
  - percentage or flat amount
  - the value (default 25%)
  - whether customers may pay in full instead
  - baskets' own hours of notice (default 48)
- **Deposit maths:** the deposit is worked out on the basket total including tax, never more than
  that total, and rounded half-up. The balance is due at pickup.
- **Validation:** the basket is re-validated on the server with fresh prices and stock
  (`validateGift`). It travels to the reservation form in a signed, short-lived cookie, so the
  browser can't change it.
- **Reservations tab:** /admin → Orders → Reservations holds:
  - the basket snapshot and assembly instructions
  - the gift message and requests
  - deposit, paid and balance due
  - payment and reservation statuses

  Baskets with dietary or special requests start in "Needs staff review" (GFT 06).

## D37 — Inquiries, chocolate-fountain requests and the Contact page (2026-10-06)

Anything that can't be bought online goes through an **inquiry** that staff review. Nothing is
booked, ordered or charged by an inquiry, and no email is sent yet (the shop replies by email or
phone; notification emails come with milestone 6).

- **`inquiries` collection** (/admin → Orders → Inquiries):
  - Number `INQ-1001`, `INQ-1002`, … from a hidden sequence (the highest used plus one, so a
    deleted inquiry never causes a clash).
  - Topics, shared with every page that links to `/contact?topic=…`: `general`, `gift_basket`,
    `gift_box`, `baby_white`, `cowboy`, `filled_ceramic`, `custom_request`, `fountain`.
  - Status: new (the start), in review, waiting for the customer, confirmed, declined, closed.
  - Access: every staff role reads; nobody creates through the API (only the server action does);
    staff update the status and notes; only the owner deletes.
  - What the customer wrote, the product, the event details and the estimate are read-only for
    staff. Only status and staff notes are audited, so the audit log never copies the customer's
    own submission (staff notes are free text, so keep personal details out of them).
- **`event-settings` global** (Settings → Events (chocolate fountain); owner and manager edit,
  audited, public read because the prices are public):
  - The confirmed offer (PRD): $250 for 2 hours including setup and service, $8.50 per person
    ($5.00 chocolate + $3.50 fruit), and a 25% deposit, with an on/off switch.
  - Cancellation wording, service area, minimum guests and extra time stay empty. Customers see
    each one only once it is filled in. "Free cancellation within one week" is not published
    because the PRD calls it ambiguous.
- **Fountain estimate** = base + per person × guests, in integer cents, guests a whole number from
  1 to 1000. It is shown as an estimate that staff confirm. Tax and other approved charges are
  not computed and are said to be separate, because nobody has said whether a rental is taxable
  (D34 covers products). The deposit is shown as a percentage only and "requested after we
  confirm", never as an amount, because its basis is not decided. The form itself charges nothing
  and takes no deposit; if quote acceptance and payment are added later, they stay on this site
  through the Clover payment design (PRD).
- **The server decides.** `/events` shows a live calculator that uses the same pure function, but
  the stored estimate is recomputed from the stored settings and anything the browser sends is
  ignored. The date must not be in the past in America/New_York; the topic comes from a fixed list;
  `?item=` is matched against published, non-hidden products only and unknown slugs are ignored.
- **Spam and abuse:** a honeypot field (a hit looks like success but stores nothing), the same
  submission twice is one inquiry, length limits, and control characters stripped. Server actions
  accept only POST and Next.js rejects a request whose Origin header doesn't match the site's host
  (or `X-Forwarded-Host`), which is the CSRF protection; on the cPanel proxy that relies on the
  public host being forwarded, as it already does for checkout. There is **no rate limit yet**.
- **Entry points:** an "Ask about this" link on inquiry-only product pages, Baby White and filled
  ceramics on Baby Gifts, and Cowboy, Baby White and filled ceramics on Build a Basket (whichever
  the gift rules mark inquiry-only). The Contact page reads `?topic=` and `?item=`.
- Migration `inquiries_events`.

## Superseded (WooCommerce build, commit 5c36c77)

D1–D8 described the WordPress 7.1.2 / WooCommerce 11.1.2 baseline (PHP plugin, classic theme,
MariaDB local preview). Superseded by D9. Still applicable in spirit: integer cents (D5 → `money.ts`),
configured-vs-effective runtime checks (now `system-check.ts`), tax off until owner-approved classes
exist (D7), bundled/self-hosted fonts (D8 → D13).
