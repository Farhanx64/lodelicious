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

## D38 — Curated gift baskets: inquiry-only, price observed but not approved (2026-10-06)

Curated baskets (ready-made, priced as a whole) are catalog products in a new **Gift baskets**
category, with a /gift-baskets page.

- **Nine baskets:** Small, Medium, Large and Extra Large Gift Basket; Large Birthday; Large Savory;
  Small, Medium and Large Sympathy. Names, contents, item counts and basket sizes come from the
  owner's basket chart. Where Clover's name differs ("Medium sympathy gift basket"), the chart's
  name is used.
- **Price:** the price observed on the public Clover storefront on 2026-09-22 (C07–C10, C12, C13,
  C15, C17, C19). It is **not approved**. D25 ("Clover's price wins") covers Lody's inventory
  export, and that export has no baskets, so it does not approve these older observations. Each
  product has `priceApproved: false`, a `priceSource` naming the listing and its C ref, and the C
  row in `sourceRecords`.
- **Inquiry-only:** `channel: "inquiry_only"`, so customers see "Available by inquiry" and there is
  no purchase action. Stock is unknown, `basketEligible` is false, allergen and dietary fields are
  "unknown", and there is no photo ("Photo coming soon"). The seed only fills what the sources
  state: the sympathy baskets are marked perishable because the chart lists fresh fruit.
- **Contents are not a BOM:** descriptions say "Typically includes …" using the chart's words, and
  "Contents vary with availability". The exact components of each basket, and its stock, are
  undefined until milestone 5.
- **No second packaging fee (AC 03):** a curated price already includes the basket and
  presentation. `packagingFor(settings, "curated")` is 0 for every size, the bag never adds a
  packaging line, and a curated basket is not basket-eligible, so it can't be nested in a custom
  basket. Tests cover each.
- **Left out, C14 "Medium Nut Free Basket":** "Nut Free" is a source title, not a verified
  allergen claim (PRD), and a product named that would make one. Its source record stays for Lody.
  Customers with a dietary request use the contact form; /gift-baskets asks them to say so.
- **Extra Large:** the builder's Extra Large size stays off (D27). The curated Extra Large Gift
  Basket (C07, $199.99) is a separate Clover product, so it is seeded like the others.
- **Page:** baskets are grouped everyday, birthday, savory and sympathy by an explicit slug map in
  `src/lib/catalog/gift-baskets.ts` (it also sets the order, since the shop lists by title). A
  basket staff add in /admin that isn't in the map goes in a final "More gift baskets" group.
  The page also links to Build a Basket and, for seasonal gift boxes (inquiry only, nothing to buy),
  to `/contact?topic=gift_box`.
- **Unapproved prices on cards:** `ProductCard` had an opt-in `hideUnapprovedPrice`, which /gift-baskets
  turned on so a card said "Price on request" until the price was approved. **Superseded by D41 (A06):**
  every listing, the product page, the builder and the bag now say "Price to be confirmed" for an
  unapproved price, and the prop is gone.
- **Going live, per basket, in /admin:** confirm the price and tick "approved", set the channel to
  "Sold online", and count stock. The seed is create-only (D24), so existing databases get the new
  category and products on the next `npm run seed:catalog` and nothing already there changes.

## D39 — Customer policies: Lody approves the text; drafts stay on staging (2026-10-06)

The PRD lists policy pages but says the final text, the reporting deadline, the refund and
cancellation terms and the privacy terms are not approved. So the website holds the policies but
never writes the terms for Lody.

- **Five fixed policies:** pickup and delivery, cancellations and refunds, substitutions and
  dietary requests, damaged or missing items, and privacy, at `/policies/<slug>`, listed at
  `/policies`. There is no separate allergen policy: the dietary policy shows the existing allergy
  notice from Store settings.
- **Admin:** Settings → Policies is a global with one fixed group per policy: title, text (a blank
  line starts a paragraph), an **Approved** tick and a last-reviewed date. Owner and manager can
  edit the text and changes are audited, but **only the owner can tick Approved**, nobody can
  approve a policy with no text, and a manager's change to the title or text of an approved policy
  clears the tick until Lody approves again. (To let the manager approve, relax the check in
  `globals/Policies.ts`.) Read access is staff-only so unapproved text isn't published through the
  REST/GraphQL API; the pages read it on the server.
- **What a visitor sees** (`resolvePolicy`, `src/lib/policies.ts`):

  | Site | Saved and approved | Saved, not approved | Nothing saved |
  | --- | --- | --- | --- |
  | Live (`APP_ENV=production`) | the text | "This policy is being finalised. Please contact us with any questions." | the same message |
  | Staging and local | the text | the text, with a "Draft — awaiting Lody's approval" banner | built-in draft, with the banner and a list of the terms still to be decided |

  The live site never shows the draft. An approved policy with a blank body counts as not approved.
  The check uses `APP_ENV` like D32's photos, not `NODE_ENV`, because staging also runs with
  `NODE_ENV=production`.
- **Built-in drafts** live in code and are never written to the database, so they can't drift onto
  the live site. They use only confirmed facts: pickup is free at the shop and takes about an hour
  depending on workload (not guaranteed); local delivery is through DoorDash; shipping isn't offered
  online; significant substitutions are discussed first; dietary requests aren't guarantees;
  custom-order cancellation and refund requests get staff review; and damaged or missing items
  should be reported promptly. Refund amounts, the cancellation window, whether the basket deposit
  can be refunded, the reporting deadline, the escalation process, data retention and deletion are
  stated as "being finalised: contact the shop". Tests fail if a draft contains a price,
  percentage or deadline.
- **Privacy facts** come from the code: checkout and reservations collect name, email, phone,
  pickup time, notes, and for baskets the gift message and requests. Inquiry forms collect name,
  email, phone, a message and event details. The bag is a server-side record with an httpOnly
  random token cookie (30 days). The basket being reserved travels in a signed cookie (2 hours).
  There are no third-party requests or trackers (D13), and card details are never stored. A test
  checks the two cookie lifetimes against `src/lib/checkout/session.ts`.
- **Checkout and reserve pages** carry one line linking to the pickup and cancellation policies. It
  only informs: nobody has to agree to policies that aren't approved yet.

## D40 — Inventory: ledger, holds, bill of materials, outbox (2026-10-07)

The website half of milestone 5, with no Clover network access. Sellable stock for the online shop is
now **counted − in-store reserve (D26) − other customers' active holds**, per product and per option,
and unknown or stale counts are not sellable at all. Customers still see only "Currently unavailable"
or "Low stock", never a count.

- **Atomic changes, and what Payload does not give us.** Payload's transactions are off for SQLite
  here: the adapter is built without `transactionOptions`, so `beginTransaction` returns null and
  `req.transactionID` is never set. (The comment in `src/hooks/audit.ts` saying audit rows share the
  change's transaction is therefore not true today.) `client.transaction()` is no use either: libsql
  opens a second connection for every other caller while it is open, and with SQLite's 0 busy timeout
  they fail at once with `SQLITE_BUSY` (the busy timeout is only about 5 ms here). So every stock change is **one `client.batch(..., "write")`**
  (`src/lib/inventory/db.ts`): libsql runs `BEGIN IMMEDIATE`, every statement and `COMMIT` in a single
  synchronous call, so nothing else in the process can run in between, and other processes (the cron
  script) are serialised by SQLite's write lock. The conditions are in the SQL itself: each guarded
  statement is followed by a check that raises SQLite's "integer overflow" if it changed no row, which
  rolls the whole batch back and is mapped to "insufficient stock". `SQLITE_BUSY` from another process is
  retried with jitter. A UNIQUE violation on a movement key means "already applied".
- **`stock-movements` is the ledger.** One append-only row per change: product, option, signed
  `delta`, `reason` (sale, reservation, cancel_restock, count_correction, manual_adjustment, sync), the
  resulting quantity, a reference (order or reservation number), the staff user, a note and a **unique
  idempotency key** (`sale:<number>.<created ms>:<product>[:<option>]`). Nobody can create, update or
  delete a row through the API; staff can read. Holds are not movements, so there is no `hold_release`.
- **Holds (`stock-holds`, staff read).** One row per owner and component, with `expiresAt` (Settings →
  Inventory → "Checkout hold", default **15 minutes**, to confirm with Lody). Placing an order or reserving
  a basket **holds every component all-or-nothing before charging**; the owner's earlier holds are
  replaced in the same batch, so a retry never competes with itself. Owners are the bag's token hash
  (orders) and a hash of basket, email and pickup (reservations), and an owner's own holds are left out
  when its own bag or basket is priced. Expired holds are ignored everywhere sellable stock is worked out;
  `scripts/release-expired-holds.ts` (`npx payload run …`, cron every 5 minutes, no-overlap lock in
  `sync-jobs`) marks them expired and removes finished ones after 7 days.
- **How a sale flows.** price → hold (all or nothing) → create the record (`stockStatus: held`, with a frozen
  copy of what it takes from stock) → charge → **paid:** one batch converts the holds into sale movements
  (decrement, movement, outbox event and hold marked converted for every component; a component whose key
  already exists is skipped, so a second submit moves nothing); **declined or error:** holds released,
  `stockStatus: released`. Customers see the same messages as before.
- **A paid order is never lost (INV 06).** If the stock can't be taken after a successful payment (the hold
  expired and the shelf changed, a count shrank stock, a component went unknown, or the batch failed), the
  paid record is kept, flagged `stockStatus: needs_attention` with a note, moved to "Needs staff review",
  logged, and **nobody is charged again**. Only the owner or a manager can mark it Resolved once the stock is fixed.
  A record that is paid after staff cancelled it is kept and flagged the same way, with nothing taken from stock. A
  late "paid" for a checkout that had been released, or a record found paid but still `held` after a crash,
  is settled by the same code (`settleStock`, run by the cron job): it takes the stock only if it is still
  sellable (the in-store reserve and other holds still apply), otherwise it is flagged.
- **Bill of materials.** Products have an optional `components` list (product, option, quantity), shown on a
  "Basket contents" tab. It is **empty until Lody supplies the contents; nothing is seeded**. A basket with
  contents is sold from its components and never from itself, and a component bought on its own in the same
  order is added to the same line, so each component moves once. Its availability is the smallest of
  floor(component sellable ÷ quantity), after each component's own reserve, and unknown if any component is
  unknown or stale. Components are one level deep, can't be the basket itself, must name an option when
  the component has options, and a basket with contents can't have options of its own; all checked when a
  product is published. Custom-basket reservations deduct their snapshot components. Without contents a
  basket's own stock is deducted. The tab shows for the gift-baskets category, or once contents are filled in (a hidden,
  unstored `categorySlug` field gives the form the slug); after changing a product's category, save it before the tab
  appears.
- **Drafts and versions can't write old stock back.** Stock lives on the product row the storefront reads, but
  Payload builds every update from the latest saved *version* (a draft, or the snapshot at the last publish).
  A price-only save, publishing an older draft or restoring a version would otherwise put that version's
  stock over the sales since (this was reproduced). `pinLiveStock` puts the live row's stock (and each
  option's, matched by key) back into every update; only server code with no signed-in user, and not a
  restore, that **explicitly** sends stock fields (seeding, tests) keeps them. A product made in the admin
  starts uncounted. Staff see the live number when they open a product. Renaming an option's key makes it a
  new option, which starts uncounted. Residual risk: between the hook and the write there is a window of a few
  microtasks in which a sale could land; the ledger's `quantityAfter` would show it.
- **Staff change stock through the ledger.** The product form's stock fields are read-only. Under Inventory →
  **Stock adjustments** the owner or a manager records a **count** (sets the quantity to what was counted,
  marks it known and counted now) or an **adjustment** (adds or removes units, never below zero); each is
  applied atomically with its ledger row and outbox event, and the row is the audit record (who, why) and
  can't be edited or deleted. A count replaces the number, and units sold online are taken off it when the order is paid, even while
  they are still on the shelf waiting to be packed. So a shelf count must leave out units set aside for paid, unpacked orders
  (or be taken after packing), or the shop would sell them twice (open question for Lody). Fulfillment staff can only
  restock.
- **Cancel and restock are separate from refunds.** Cancelling or refunding never changes stock. A
  "Put cancelled stock back" adjustment names an order or reservation and the components to return; it can't
  exceed what that record took minus what was already put back, is all-or-nothing, and is refused for
  perishable items unless an owner or manager ticks the confirmation. Opened or assembled goods are simply
  not chosen; nothing returns by itself. Cancelling an order still waiting for payment releases its hold.
- **Stale stock (INV 05).** Settings → Inventory → "Longest age of a stock count" is **empty (off)**, so
  nothing changes until Lody sets it. When set, a product or option whose count date is older, or missing, is
  unknown. Options have their own count date. The check applies when holding stock, not when a paid sale is
  taken.
- **Outbox (website half).** Every movement writes one `stock_changed` event in the same batch (product,
  Clover ID, option, delta, quantity after, movement id, reason, reference), status pending, unique key
  `stock_changed:<movement key>`. Movements from the Clover read (`sync`) and zero-change recounts write none.
  Nothing sends them yet; `src/lib/inventory/outbox.ts` holds the retry timing (30 s doubling to 6 h, dead
  after 8 failures). See `docs/clover-sync-needs.md`.
- **Fixes that live in checkout.** A02: order and reservation numbers are one above the highest in use (a
  numeric `MAX`), and only a number collision is retried. A01: a basket's components come from the merged,
  validated selections.
- **Known edges.** Holds belong to a bag (orders) or to a basket, email and pickup time (reservations), not to one record: a
  late payment for an old order from the same bag can use up a newer checkout's hold, and cancelling releases every hold the
  bag has. The newer order is then flagged for staff, never oversold. `reserveBasket` now checks contact and pickup before
  the basket, so those errors come first. Do not switch on `transactionOptions` for the SQLite adapter without re-running
  the inventory tests: Payload would then swap the shared connection mid-request. A larger `busyTimeout` on the adapter
  would help writes that collide with the cron script.
- **Staging.** With `PREVIEW_ASSUME_STOCK`, uncounted stock can still be ordered and is neither held nor
  deducted.
- Migration `inventory`. New: `stock-movements`, `stock-holds`, `stock-adjustments`, `outbox`, the
  `inventory-settings` global, `products.components`, per-option `stockCountedAt`, and `stockStatus`,
  `stockOwner`, `stockPlan`, `stockNote` on orders and reservations.

## D41 — Security and audit fixes (2026-10-06)

Fixes from the repo audit (`AUDIT.md`, A01–A23) that need no schema change and no change to
`src/lib/checkout/service.ts`. No migration. The rest of the audit is with the inventory and
checkout-hardening work (A02, A04, A05, A11, A12, A14, A20) and the integrator (A17, A21, footer).

- **What "live" means (A09).** Everything that is only allowed away from the live store is now an
  allowlist (`src/lib/app-env.ts`): the test payment provider, unapproved photos, the staging
  banner, draft policies, `PREVIEW_ASSUME_STOCK`, and the `noindex` robots rules apply **only when
  `APP_ENV` is explicitly `local`, `staging` or `test`** (case and spaces ignored). `production`, an
  unset variable and a mistyped one (`prod`, `stage`) are all the live store, so a forgotten variable
  closes ordering and hides placeholder photos instead of opening them. This refines the wording of
  D32, D35 and D39 ("APP_ENV=production") to "anything that is not local, staging or test".
  `/ops/system-check` and `npm run doctor` gain an **APP_ENV** check: it passes for `production`,
  `local`, `staging` and `test`, and fails (with what the server will do) for unset or unrecognised
  values. Tests run with `APP_ENV=test` (`tests/setup-env.ts`), which is on the allowlist.
  `.env.example` keeps `APP_ENV=local` for development and says so. `robots.txt` and the `noindex` meta
  tag follow the same rule; `app/robots.ts` is now `force-dynamic`, because Next otherwise builds it once
  and a build made with a different `APP_ENV` would fix the wrong rules into the live site.
- **Unapproved prices (A06).** `formatPrice`, `priceRange` and the option list live in
  `src/lib/catalog/product.ts`. A product whose price is not approved shows **"Price to be
  confirmed"** and never a number: product cards on every listing (shop, baby gifts, gift baskets,
  home), the product page and its option list, the builder's item cards and the bag (a line whose
  price was approved when added but is not now). "Price on request" remains only for an approved
  product with no price. This replaces the opt-in `hideUnapprovedPrice` prop that D38 added; the baby
  ceramics' assumed prices (D19) are therefore no longer shown. Admin views are unchanged.
- **Basket requests (A01).** `parseCustomRequest` rejects a selection with a quantity that is not a
  whole number from 1 to 99 (negative, zero, fractional, `NaN`, huge) or with no product id, and merges
  a product listed twice into one line (rejecting if the merge passes 99). Both the builder actions and
  the signed basket cookie read requests through it, so `service.ts` only ever sees clean lines; its own
  hardening is with the inventory work.
- **Standing closures (A07).** The catalog seed fills Checkout settings → Closed dates **only when the
  list is empty**: December 25, January 1 and Labor Day (first Monday of September), PRD FUL 01, as
  explicit dates for the next **18 months** (`src/lib/checkout/closed-dates.ts`). From October 2026 that
  is 2026-12-25, 2027-01-01, 2027-09-06, 2027-12-25 and 2028-01-01. The field holds plain dates, and
  recurring rules would need a schema change, so **Lody adds later years in /admin** (or the seed fills
  the next 18 months again if the list is ever emptied). Store settings → "Timezone" and "Closed days"
  remain labels that checkout does not read (pickup uses `America/New_York`, and the closed-day text
  is for the footer). Wiring or removing them is a schema change, left for later.
- **Headers, cookies, CSRF, GraphQL (A08).**
  - `next.config.ts` sets `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff` and
    `Referrer-Policy: strict-origin-when-cross-origin` on every path, `Referrer-Policy: no-referrer` on
    `/order/*` and `/reservation/*` (their URL carries the guest token), and `poweredByHeader: false`
    (Payload's own `X-Powered-By` is suppressed with it). `Strict-Transport-Security: max-age=31536000`
    (no `includeSubDomains`, no `preload`, since domain changes need Lody's approval) is sent **only for a
    production build**. Next evaluates `headers()` when it builds, so run `npm run build` on the host with
    `APP_ENV=production` set. No CSP yet: the admin needs inline scripts, so a report-only policy comes
    later.
  - The Payload login cookie is `Secure` unless this is a local, staging or test server not in production
    mode.
  - `csrf` is the origin(s) in `NEXT_PUBLIC_SITE_URL` (comma-separated allowed, so apex and www both
    work) **only when that variable is set**; unset leaves Payload's allowlist off. With it set, the admin
    must be opened at exactly that origin, or the browser's API calls are treated as logged out.
  - `graphQL: { disable: true }`: nothing uses it (the admin runs on REST). The `/api/graphql` routes
    remain and answer 404. The cloudflared tunnel (`docs/preview-and-sharing.md`) works with
    `NEXT_PUBLIC_SITE_URL` unset or set to the tunnel's https address.
- **First owner (A03).** `scripts/create-owner.ts` (`npx payload run scripts/create-owner.ts`) creates
  the first owner from `OWNER_EMAIL` and `OWNER_PASSWORD`, refuses if **any** user exists, applies the
  password policy and never prints the password. Separately, when `FIRST_OWNER_EMAIL` is set the Users
  collection rejects any other email for the first account, including `/api/users/first-register` and
  the admin's create-first-user screen. It is read when the account is created and does nothing once a
  user exists. Run the script (or open /admin yourself) **before the host is reachable**, and keep
  `FIRST_OWNER_EMAIL` set.
- **Photos (A10).** On the live store anonymous reads of Media are limited to photos with
  `approvedForLaunch`, through the REST list, the file route and its resized files, and related photos
  on products (which come back unpopulated and show "Photo coming soon"). Staff of every role keep full
  access; local, staging and test are unchanged.
- **Passwords and uploads (A23).** Staff passwords need at least 12 characters (at most 128), not a
  repeated character, run or keyboard row, not a very common password, not built on the shop's name, and
  under 16 characters a mix of three of lowercase, capitals, numbers and symbols
  (`src/lib/password-policy.ts`, a Users `beforeValidate` hook). **Not covered:** Payload's
  reset-password-by-email flow does not pass the new password through collection hooks. There is no
  email adapter yet, so that flow isn't live. Photos over **15 MB** are refused before Payload resizes
  them (Payload's own parser cap is 20 MB), and sharp will not decode an image over 64 megapixels.
  There is no 2FA.
- **Forms keep what customers typed (A13).** React 19 resets a `<form action>` after the action runs.
  The checkout, reservation and add-to-bag actions now return the submitted values with the error
  (`src/lib/checkout/form-state.ts`: only known fields, short strings), and the fields read them as
  `defaultValue`: `ActionForm` provides them through a context, which `ContactFields`, `PickupSelect`,
  the notes box and the payment choice (new client components in `components/checkout/`) use. While an
  action runs the button is `aria-disabled` (a second click is ignored; focus stays), and after an error
  focus moves to the message. The inquiry forms already did this.
- **Rate limits and stale bags (A15).** An in-memory limiter keyed by client IP and action
  (`src/lib/rate-limit.ts`, shared by every bundle through `globalThis`) answers "Too many attempts,
  please wait a minute and try again." Per minute: add to bag 30, check basket 20, start reservation 20,
  place order 6, reserve 6, contact 5, fountain 5. Limited form actions still return what the customer
  typed. It is a speed bump for one Node process: counts reset on restart. The IP is the **last**
  `X-Forwarded-For` entry (the one the proxy appended), then `X-Real-IP`; with neither, everyone shares
  one "unknown" bucket, so confirm the host forwards the header. `scripts/purge-carts.ts` deletes shopping
  bags untouched for over 30 days (`npx payload run scripts/purge-carts.ts`); run it daily from cron.
- **Error pages (A16).** The storefront has a branded `error.tsx` (Next 16's `retry` prop, never the
  error message, a short digest reference) and `not-found.tsx`. A repeated `?t=a&t=b` on a receipt link
  is now a 404 instead of a 500 (`singleParam`, outside `service.ts`). Next only uses a route group's
  `not-found.tsx` when a page calls `notFound()`: a URL that matches no page still gets Next's default
  404 because the site has two root layouts (storefront and admin); `experimental.globalNotFound` would
  fix that and needs a build to verify.
- **Accessibility (A18, except the footer).** `/shop` has a visually hidden h2 above the cards, so the
  outline no longer jumps from h1 to h3. Card photos have empty alt text because the title link beside
  them names the product. The Add-to-bag button names the option ("Add to bag: Pink") and shows it, even
  when there is only one; the builder's "Add another (2)" button's name now contains those words.
- **Seed guard (A19).** `npm run seed:catalog` refuses a database that already has products when
  `APP_ENV` is not local, staging or test, prints why, and exits 1. `SEED_FORCE=1` overrides it
  (a `--force` flag cannot work: `payload run` passes a script only its positional arguments). An empty database, or any local, staging or test one, is unaffected.
- **Tests and CI (A22).** Unit tests for each fix, integration tests in `tests/int/audit-fixes.test.ts`
  (first owner, passwords, media access, upload limits, API surface, closed dates, cart purge) and CI
  now fails when `payload migrate:create` finds schema changes no migration covers or writes a file.
  Actions are still pinned by tag.

New environment variables: `FIRST_OWNER_EMAIL`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `SEED_FORCE`.
Changed meaning: `APP_ENV` (allowlist, must be set to `production` on the live host),
`NEXT_PUBLIC_SITE_URL` (now enables the CSRF allowlist; the `.env.example` value is commented out).

## D42 — Checkout hardening: private product API, payment states, one submission per form (2026-10-07)

Fixes from the repo audit (A04, A05, A11, A12, A14, A20) plus the SQLite busy timeout from D40.
One migration, `checkout_hardening`.

- **The product API is private (A04).** `products` and `categories` are readable by **staff only**
  (`isStaff`); an anonymous `GET /api/products` is now "not allowed" (a REST-handler test checks it, and
  that no staff-only field name appears in the answer). The audit's field-level `read` was **not** used
  because the storefront reads as anonymous. Instead every storefront and server read states its own
  rule and passes `overrideAccess: true`: `queries.ts` (`_status = published`, `channel != hidden`),
  `builder-catalog.ts` (published, not hidden, online, basket-eligible), `loadProducts` in `service.ts`
  (published, not hidden: a hidden product can't be added to a bag), and the inquiries `findPublishedItem`.
  The builder is sent each unit's stock **capped at `maxPerGift`** (rules are unchanged: a request over
  `maxPerGift` is already refused, so a larger count never mattered). Because reads now override access,
  photos that are not approved for launch are populated on a product; `isImagePublishable` (used by
  `ProductImage`, `PhotoStrip` and the builder) is the guard, and the A10 test now checks that. Categories had
  the milder form of the same problem (non-shop categories and their text were public) and are staff-only too.
  New code that reads these collections for visitors **must** state `published` and `not hidden` itself.
- **Payments with a live provider (A05).**
  (a) The tax gate is `orderingState(provider, taxApproved)` after pricing, for both orders and
  reservations; with no provider at all they still stop before pricing.
  (b) Each charge has the key `<record key>:<attempt>`. `paymentAttempts` is stored on the record and
  written **before** the call. A declined record gets the next number, so a gateway can't replay a cached
  decline; a record still `pending` (a crash mid-charge) keeps its number, so the gateway deduplicates.
  (c) A reservation retry charges the stored `depositCents` and records the balance from the stored total;
  editing the deposit setting between attempts changes nothing for that record.
  (d) `charge()` is wrapped (`chargeSafely`): an exception, a timeout (`PAYMENT_TIMEOUT_MS`, 30 s by default) or
  an unrecognised answer is **unknown**. A provider may also return `unknown`. The record is kept as
  `paymentStatus: unknown`, stays awaiting payment, keeps its stock hold (which expires after the hold time;
  the cron's `reconcilePaidHeld` handles a record that is later marked paid) and the customer's bag, and gets
  a stock note. The customer is told not to pay again. **Nothing charges again while a record from the same
  bag or basket is `unknown`**, whatever the customer changes, until staff mark it paid or failed in the
  admin (owner and manager only, as before). `ChargeResult.status` gained `"unknown"`.
- **One submission, one record (A11).** The checkout and reserve pages render a hidden `submission`
  field: a random nonce signed with `PAYLOAD_SECRET` and tied to its form kind (`src/lib/checkout/submission.ts`).
  The server action verifies it and passes it to the service, which adds it to the idempotency key. A true
  double submit of one rendered form is one order; the same items, details and slot from a fresh form later
  is a new order (and a new receipt link). A retry after a decline from the same form is the same record
  (next attempt). A missing or forged nonce answers "This page has expired. Please reload it", with the
  customer's entries kept (A13). The service accepts `submission` as optional so older callers keep working;
  the actions always send it. There is no expiry: the nonce is only an identity.
- **Allergy and dietary notes (A12).** A paid shop order with non-empty notes, or a paid reservation with
  requests, goes to **Needs staff review** instead of Preparing or Confirmed. The checkout page shows the
  Store settings allergy notice next to the notes box (and the reserve page shows it), and says that a note means
  a person reads the order first. **Payment timing is unchanged and is Lody's decision:** the PRD says an
  unresolved dietary request should go through an inquiry before payment; today the customer pays first and
  staff review afterwards. If Lody wants review before payment, that is a separate flow (open question).
- **Waiting states (A14).** Orders start `awaiting_payment` (default) and become `preparing` (or
  `staff_review` with notes) only when `paymentStatus` becomes `paid`. Reservations start `awaiting_payment` and
  become `confirmed` (or `staff_review` with requests) when the deposit or full payment is paid. This is one
  `beforeChange` hook (`advanceWhenPaid`), so it also applies when staff mark a payment paid by hand, and an
  order staff cancelled while a charge was in flight stays cancelled. A declined or unknown payment leaves the
  record awaiting payment; the status labels say "do not pack". New select values: `paymentStatus: unknown`
  (orders and reservations), `awaiting_payment` (both status fields). This fits D40: `stockStatus`
  (`held`, `committed`, `needs_attention`, `released`) is unchanged, and `settleStock` still sets `staff_review`
  when a paid record's stock could not be taken. Test orders show a **TEST** badge in the Test order column of
  the Orders and Reservations lists (`testMode`, now with a custom cell).
- **Deletes are audited (A20).** `auditDelete` writes an `audit-log` row with `action: delete`, the user, the
  record's name/number/email and the last audited values. Applied to products, categories, tax classes, users,
  orders, reservations, inquiries, media and stock adjustments. Audited fields added: `Media.approvedForLaunch`
  (media is now audited on change), `Products.taxClass`, `shippable`, `perishable`, `maxPerGift`, `fitUnits`.
  The comment in `src/hooks/audit.ts` claiming audit rows share the change's transaction is corrected: the
  SQLite adapter runs without transactions (D40), so the change and its audit row are two writes.
- **SQLite busy timeout.** `busyTimeout: 5000` on the adapter (the option is a top-level adapter argument in
  `@payloadcms/db-sqlite` 3.90, applied as `PRAGMA busy_timeout`). `transactionOptions` stays off. The inventory
  integration tests pass with it.
- **Migration `checkout_hardening`.** Adds `payment_attempts` to `orders` and `reservations`. Payload's generator
  also proposed rebuilding both tables to change the stored DEFAULT of the status columns; that rebuild
  drops the table (it would null `stock_adjustments.order_id`/`reservation_id` if foreign keys are enforced) and nothing
  needs it, because Payload applies the configured default itself and the new select values are plain text. The
  migration is hand-trimmed to the two `ALTER TABLE ... ADD`; the snapshot `.json` is the generated one, so the
  CI drift check stays clean. Existing rows keep their old status values.
- **For what comes next.** A record is "paid" in exactly two places: `placeOrder`/`reserveBasket` when the
  provider answers `paid`, and staff changing `paymentStatus` in the admin. The emails work should send
  "order confirmed" when `paymentStatus` becomes `paid` (or `deposit_paid`/`paid_in_full`), and tell
  staff-review customers that a person will check their note.

## D43 — Clover inventory sync worker, built against a fake (2026-10-07)

The Clover half of milestone 5 (INV 03, INV 05, INV 06, AC 10). **No network, no credentials: nothing
in this decision has ever talked to Clover.** The workers are written against an adapter interface
and tested against an in-memory fake. No schema change and no change to existing files in
`src/lib/inventory/`; the code is in `src/lib/clover/`.

- **Adapter (`adapter.ts`).** `CloverInventoryAdapter`: `listItems({cursor, limit})` (paginated, with
  stock), `getItemStock(cloverId)` and `pushStockChange({cloverId, delta, quantityAfter, idempotencyKey})`.
  Errors are typed: `CloverTransientError` (timeout, rate limit with `retryAfterMs`, 5xx, network) and
  `CloverPermanentError` (auth, not found, rejected, config). `FakeCloverAdapter` is in memory, records
  calls, and can be scripted to time out, throttle, return 5xx or reject, or to apply a change and then
  time out (a lost answer). `getCloverAdapter(env)` returns the fake (only when `APP_ENV` is local,
  staging or test, and `CLOVER_ADAPTER=fake`, since a fake on the live store would mark real changes as
  sent), the HTTP adapter (when `CLOVER_MERCHANT_ID` or `CLOVER_API_TOKEN` is set), or `none` (the scripts
  say so and exit 0).
- **HTTP adapter (`http-adapter.ts`): a stub, never called in tests.** It refuses to be built unless
  `CLOVER_ENVIRONMENT` (`sandbox` or `production`), `CLOVER_MERCHANT_ID` and `CLOVER_API_TOKEN` are all set,
  and refuses `production` unless `CLOVER_SYNC_LIVE=1`. 10 s timeout on every call, IDs checked before
  they go into a URL, token only in the `Authorization` header and never in a message. Written from
  general knowledge of Clover's REST API, with no web lookup. **Must be verified in the Clover sandbox
  before use:** base URLs (EU and Latin America hosts are refused); the `items?expand=itemStock` response
  shape, page size and which of `quantity` / `stockCount` is on-hand; the `item_stocks` read and update
  endpoints; **whether the update sets an absolute number or adds a delta** (the stub reads the current
  quantity, adds the delta and writes the total back, which has a small race with an in-store sale; use a
  true delta call if one exists); whether any idempotency header is honoured (one is sent; if not, a request
  that times out after Clover applied it is applied twice on retry, and the next read lets Clover win, so the
  website only ever sells less); `Retry-After`; the token scopes; whether deleted items are listed; how
  option-level stock is modelled.
- **Push (`push.ts`, job lock `clover-push`).** Takes `pending` / `failed` outbox rows with `nextAttemptAt`
  empty or past, oldest first, in batches of 25. A row is **claimed** by one conditional UPDATE (counts the
  attempt, moves `nextAttemptAt` out by a 2-minute lease), so a second run, or a run that outlived its lock,
  cannot send it too; the result write is conditional on the row still being `pending` / `failed` (a row
  changed under us is counted as `lostRace` and not overwritten). The row's `idempotencyKey` goes to Clover.
  Success: `sent`, `sentAt`, `lastError` cleared. Transient failure: `afterFailure()` (30 s doubling to 6 h,
  `dead` after 8) with the message in `lastError`. A 429 is not a failed attempt (attempt undone, the row
  waits at least 30 s or `Retry-After`, the run stops). Three transient failures in a row stop the run
  ("Clover is down"; the remaining rows keep their attempts) and the run is recorded as failed. A permanent
  rejection is `dead` at once; bad credentials stop the run and leave every row untouched. The run stops
  starting rows after 50 s. A failure never touches the paid order or the website's stock.
- **Rows with nothing to send to.** The current `products.cloverId` is used (it may have been set after the
  event was queued). A product with no Clover ID, or an event for one **option** (options have no Clover
  item of their own, see "Schema" below), is not sent and not retried against Clover: it stays `failed` with
  `lastError` starting `not mapped:`, is looked at again every 6 hours without using up attempts, and goes
  out by itself once the ID exists. No new status values were added.
- **Pull (`pull.ts`, job lock `clover-pull`).** Reads Clover page by page (100 items) and applies each
  matched product **only through `applyMovements({ mode: "count", reason: "sync", countedAt })`**, key
  `sync:<run id>:<Clover ID>`: ledger row, known, count date = the moment the page was read, no outbox
  event (no echo). Every matched item is stamped, even unchanged (a ledger row of 0). **Matching is by
  `cloverId` only.** Reported and left alone: Clover items with no website product; website products
  with a Clover ID Clover did not return; website products without a Clover ID; items Clover does not track;
  a Clover ID shared by more than one website product (a split Clover item is ambiguous; the Philips bar
  and Princess Assortment until Lody splits them); products with options (no per-option IDs).
- **Pending deltas.** Before applying, the product's unsent outbox deltas are added to Clover's number:
  `pending`, `failed` and `dead` rows (a dead row is a sale Clover never got), plus rows `sent` since this
  page's read began (a push that lands while the page is in flight). That can double count a sale, which
  only sells less and corrects itself at the next read. The result is floored at 0 (reported as `clamped`).
  Remaining window: a sale committed between the delta lookup and the count (a few milliseconds) is
  overwritten; the in-store reserve (D26) covers it. **Open:** a dead row keeps being subtracted until it is
  dealt with; there is no staff action to retire one yet (outbox is read-only to staff).
- **Restartable.** The cursor, run id, items seen and counters are saved in `sync-jobs.checkpoint` after
  every page. A run that stops (50 s budget, Clover down, crash) resumes from it within 24 hours with the same
  run id, so a replayed page hits the `sync:` keys and is harmless (`alreadyApplied`). When a run finishes the
  checkpoint keeps its report (`completed: true`) for the staff view and the next run starts fresh.
- **Dry run.** `CLOVER_DRY_RUN=1` (since `payload run` passes scripts only positional arguments): push
  counts what it would send; pull reads Clover and reports what it would change. No lock, no writes.
- **Staff visibility.** `getCloverSyncHealth()` (`health.ts`): pending, retrying, dead, unmapped counts, oldest
  unsent age, last failure, last success of each job, the last pull report. `/ops/system-check` now has three
  lines: outbox (fails on any dead event or anything unsent for over an hour), last stock read, last send. Until
  Clover is configured it shows one informational line that fails only on dead events. No emails or alerts are
  sent from here (no outside services); staff see it in the system check and in Inventory → Outbox events.
- **Schema.** No change. **Needed later:** a per-option Clover ID (`variants.cloverId`, in a migration) if
  options are separate Clover items; until then option stock is neither pushed nor pulled. Outbox events for
  options wait as `not mapped:`. Also worth considering: a staff action to retire a dead event.
- **Cron (cPanel), once Lody has given the token and chosen the interval:**
  `npx payload run scripts/clover-push.ts` every 1 to 2 minutes and `npx payload run scripts/clover-pull.ts`
  every 5 to 15 minutes. Both exit 0 when another run holds the lock, or Clover is not configured; 1 on failure.
- **Tests.** Unit (`src/lib/clover/clover.test.ts`): errors, retry timing, the fake, the HTTP adapter's refusals
  (incomplete, bad environment, production without `CLOVER_SYNC_LIVE=1`) with a stub `fetch`, the factory.
  Integration (`tests/int/clover-push.test.ts`, `clover-pull.test.ts`) on the real migrations.

## D44 — Transactional emails, built and tested, delivered only to the console (2026-10-07)

PRD AC 07 (notifications). **Nothing in this decision has ever sent an email**: there is no sending
service, no credentials and no `nodemailer` in `node_modules`. Until Lody approves a service, every
email goes to the console log. One migration, `email_settings`.

- **What is sent** (`src/lib/email/`):
  - Customer: order confirmation (number, lines, subtotal, tax, total, pickup slot, the private order link, the
    store address and phone); different wording when the customer left a note ("a person will read it before
    your order is packed"). Reservation confirmation (deposit or paid in full, balance due at pickup, pickup,
    private link; the same staff-review wording for requests). Inquiry receipt ("we'll reply"; nothing booked
    or charged). Test orders are subject-prefixed `[TEST]`.
  - Staff: a new paid order, reservation or inquiry; and "needs attention" for an **unknown payment** and for a
    paid record whose stock is `needs_attention`. Staff emails list the customer's contact details and notes
    (staff need them) and an admin link. They never include `staffNotes`, the stock note, a payment
    reference or the token hash; the templates take only the fields they print.
  - Plain text plus simple HTML (inline styles, no images, fonts or scripts). Customer text is escaped; subjects
    have control characters removed; only `http(s)` links are rendered as links.
- **When it is sent (`due.ts`).** From an `afterChange` hook, decided from the saved state: orders when
  `paymentStatus` is `paid`; reservations when it is `deposit_paid` or `paid_in_full`; never while pending,
  failed, unknown or refunded, and not for a canceled record. Because it reads state, staff marking an
  unknown payment paid by hand (the `advanceWhenPaid` path, D42) sends the confirmation then. An **unknown**
  payment emails staff only (the customer was already told on the page not to pay again). Inquiries send on
  create; honeypot-dropped ones are never stored, so never email.
- **Exactly once.** `emails.{confirmationSentAt, staffNotifiedAt, unknownNotifiedAt, attentionNotifiedAt}` on
  orders and reservations (`confirmationSentAt`, `staffNotifiedAt` on inquiries), read-only in the admin. Before
  sending, `notify.ts` claims a marker with one conditional `UPDATE ... WHERE marker IS NULL`, so repeated
  saves, staff edits, two overlapping runs and the retry script never send an email twice. If the send fails
  the marker is cleared again. A crash between the claim and the send loses that one email (it is never sent
  twice). **An email failure never fails the write:** the hook and `sendDueEmails` catch everything.
- **Console mode counts as sent.** With the console adapter the email is "handed over" and the marker is set,
  so connecting a real service later does **not** email every old order. (If Lody wants the backlog sent, clear
  the markers.)
- **The private link** is rebuilt, not stored: the URL token is `HMAC(PAYLOAD_SECRET, kind:idempotencyKey)`
  (`accessUrlToken` in `checkout/order.ts`, which `service.ts` now calls), so the retry script can email the
  same link long after checkout. Rotating `PAYLOAD_SECRET` changes every link. It needs `NEXT_PUBLIC_SITE_URL`;
  if that is unset the email simply omits the link.
- **Recipients and senders.** Staff go to the new optional Store settings field `notificationEmail`, else the
  shop email. `EMAIL_FROM` (default: shop name and shop email) and `EMAIL_REPLY_TO` (default: the shop email).
  Addresses with line breaks or that are not plausible are ignored.
- **Adapter (`config.ts`, `adapter.ts`, wired in `payload.config.ts`).** `EMAIL_TRANSPORT` unset or `console` is
  the default (prints the message outside the live store, only a hidden summary on it). `smtp` **refuses to
  start** unless `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `EMAIL_FROM` are set, and on anything
  that is not local/staging/test (the D41 rule, so unset or mistyped counts as live) also `EMAIL_SEND_LIVE=1`.
  **The SMTP adapter is a stub**: `@payloadcms/email-nodemailer` is not installed and dependencies were off
  limits, so a complete SMTP config currently stops the app with "adapter is not installed". The file comment
  in `adapter.ts` has the few lines to put in once it is installed.
- **`sendEmail` (`send.ts`).** Wraps `payload.sendEmail` with a 15 s timeout and never throws. It logs one line
  (`[email] handed over customer_order SP-1001` or `FAILED ...`) with no addresses or names; error text has
  anything that looks like an address removed.
- **Retry:** `npx payload run scripts/send-pending-emails.ts` (cron, every 10 minutes) finds paid, unknown and
  attention records with an empty marker, plus inquiries, and sends them under a `sync-jobs` lock
  (`send-pending-emails`).
- **Tests.** The transport is replaced by a capturing function on `payload.sendEmail`; the configured adapter
  stays the console one, so no test can send.
- **Not done / for Lody.** Choice of sending service and plan; the From address and domain, with SPF, DKIM and
  DMARC records on it (PRD: confirm authenticated sending and Reply-To before launch); the staff address;
  wording sign-off on the customer emails (no policy or delivery promises were added); whether staff-review
  customers should be told earlier (see D42, review currently happens after payment); shipping and ready-for-pickup
  emails are not built; the abandoned-bag and refund emails are not built.

## D45 — Admin panel reorganized by task (2026-10-08)

The admin had grown one area at a time: Inventory sat below Staff and Operations, two groups held a single
item each (Operations, Gift builder), "Settings" mixed website content with checkout rules, and the order and
reservation pages opened on raw JSON with money in bare cents and the staff notes at the very bottom. **No
schema change and no migration**: only `admin` options, labels, unnamed tabs and collapsibles (which don't
change data paths), and two display components. The drift check reports no changes.

- **Sidebar and dashboard groups**, in this order (`payload.config.ts` sets it; Payload lists groups in the
  order their first collection appears, then the globals inside them, so every group starts with a
  collection):

  | Group | Contents |
  | --- | --- |
  | Orders | Orders, Basket reservations, Inquiries |
  | Catalog | Products, Categories |
  | Inventory | Stock adjustments, Stock history, Checkout holds |
  | Website | Photos, Store details, Home page, Policies |
  | Settings | Tax classes, Checkout & reservations, Gift builder rules, Events (chocolate fountain), Inventory settings |
  | Staff | Staff accounts, Audit log |
  | System | Clover outbox, Sync jobs, Source records |

- **Renamed in the admin only** (slugs, API paths and database tables are unchanged): Reservations → Basket
  reservations; Media → Photos; Users → Staff accounts; Stock movements → Stock history; Stock holds →
  Checkout holds; Outbox events → Clover outbox; Store settings → Store details; the Inventory global →
  Inventory settings. Gift builder rules moved from its own group to Settings; Sync jobs from Operations to
  System; Source records from Catalog to System; the outbox from Inventory to System.
- **Every list has a one-line description** of what it holds and, where it matters, what not to do (never
  pack a TEST order; change stock only through Stock adjustments). Field labels are sentence case throughout.
- **Orders and basket reservations:** fulfillment (or reservation) status and payment status at the top, then
  three tabs. *Order* / *Reservation*: customer, pickup, a read-only summary table of what was bought in dollars
  (`components/admin/RecordSummary.tsx`), customer notes or assembly instructions, the paid-so-far and balance
  fields (reservations), and staff notes. *Stock*: the stock note and what was taken from stock. *Record data*:
  the stored snapshot (`lines` or `basket` JSON and the totals) for anyone who needs every detail. The number,
  test flag, stock status, payment reference and attempts, and emails sent are in the sidebar.
- **Inquiries:** the product row shows only when the inquiry is about a product; the fountain estimate is shown
  in dollars; the terms snapshot is folded away; staff notes come before it.
- **Money:** every cents field shows its value in dollars under the input as staff type
  (`components/admin/CentsDescription.tsx`, wired through `centsComponents` in `src/fields/money.ts`), as list
  columns already did. Storage stays integer cents.
- **Products:** the tax class moved to the *Price & tax* tab; *Records* became *Codes & sources*; Featured moved
  to the sidebar next to the slug.
- **Photos:** Approved for launch is in the sidebar.
- **Store details:** tabs for *Shop & contact*, *Opening hours* and *Story & allergy notice*. The opening hours,
  closed-day names and time zone now say they are display only (audit A07): pickup times and closed dates come
  from Checkout & reservations, and the time zone field is read-only because pickup always uses
  America/New_York.
- **Policies:** one tab per policy. **Gift builder rules:** *Sizes & item counts* and *Special presentations* tabs.

## D46 — AI-generated stand-in product photos, agreed by Lody (2026-10-08)

PR #12 added AI-generated photos (GPT Image 2) for the catalog products, including the curated gift
baskets. **Lody agreed to these temporary photos.** They are seeded as media with
`approvedForLaunch: false` and a credit that starts with "AI-generated … staging only", so staging shows
them and production falls back to approved photos ("Photo coming soon" where there is none).

- **Tests changed to match:** the seed tests used to require no photos on the curated baskets and the new
  Clover products (D38). They now require that any photo there is one of these stand-ins and is not
  approved for launch (`tests/source-data.test.ts`, `tests/int/catalog.test.ts`, `tests/int/gift-baskets.test.ts`).
- **Showing them on the live site** needs each photo ticked Approved for launch (Website → Photos). Ask Lody
  whether she wants that, or wants them on staging only until her own photos arrive. Never present one as a
  photo of the actual product without her saying so.

## D47 — Member rewards: accounts, points earned on purchases, rewards at checkout (2026-10-14)

Requested by the repo owner: "a members reward system". Not in the PRD (D31: "Accounts and wishlists are
not in the PRD"), so it is built **switched off and unapproved**, like policies (D39).

- **Off until Lody says so.** Rewards → *Rewards program* starts empty: no earn rate, no rewards,
  no terms. It can't be switched on until the earn rate (1–100 points per dollar) and at least one reward are
  set, and the live site shows nothing about rewards (the account icon keeps its "coming soon" page) until the
  owner ticks *Approved*, which needs terms text. A manager can prepare everything, but changing the earn rate,
  welcome points, rewards, name or terms of an approved program clears the approval unless the owner saved it.
  Staging shows an unapproved program with a "Draft program" notice. Audited.
- **Members are not Payload users.** `members` is a plain collection; passwords are scrypt hashes (Node's own
  `crypto.scrypt`, random salt, parameters stored with the hash) and the session is a signed `sp_member` cookie
  (HMAC of `PAYLOAD_SECRET`, 30 days) carrying the member id and a session version. Why not Payload auth: a
  second auth collection would share the admin's `payload-token` cookie and the REST login routes, and every
  staff access rule written as "signed in → your own record" (`Users.read`/`update`) would match a customer
  whose id equals a staff id. Keeping customers out of Payload's auth means they can never reach /admin or
  the API at all.
  - Sign-in: a generic answer for unknown email, wrong password and locked account; 5 failures lock the
    account for 15 minutes; a decoy hash keeps timing the same for unknown emails; IP rate limits on join,
    sign-in and reset (`memberJoin`, `memberSignIn`, `memberReset`).
  - Passwords follow the staff policy (12+ characters, A23). Accounts hold redeemable value.
  - Reset: a random token emailed (through D44's sending path, so console-only today), stored only as a
    hash, valid 60 minutes, single use. A reset, "sign out on all devices" and closing an account bump the
    session version, ending every session. The reset link uses `NEXT_PUBLIC_SITE_URL` (never the request's
    Host header); away from live it falls back to `http://localhost:3000`.
  - Members can't edit their details or close their account themselves yet: they ask the shop, and staff
    edit Rewards → Members (owner/manager; fulfillment read only; owner deletes).
- **The points ledger** (`reward-entries`) works like the stock ledger (D40): `src/lib/rewards/ledger.ts`
  changes `members.points_balance` and inserts the entry in one `client.batch` write. A spend that would go
  below zero aborts the batch. Every entry has a unique key naming its cause, so retries post once. Nobody can
  create, edit or delete ledger rows through Payload. The member's balance field is replaced by the live
  value on every Payload save, so a stale admin form can't overwrite it. Staff change points only through
  Rewards → *Points adjustments* (owner/manager, a reason required, never below zero).
  - **Keys never use a bare row id.** SQLite gives a deleted row's id to the next row, so `earn:orders:12`
    would match a deleted order's entry and the new order would never earn. Records use their unique
    idempotency key; welcome points use the member id plus the moment they joined. A test covers it.
- **Earning.** Points are worked out at checkout and frozen on the record (`rewards.earnPoints`):
  `floor(paid before tax, after any reward, in cents × points per dollar / 100)`. They're posted when a shop
  order is `paid`, or a basket reservation is `paid_in_full` (a deposit alone earns nothing). Only for
  orders placed while signed in: an order is never matched to a member by the email typed at checkout.
- **Redeeming.** Shop orders only, one reward per order: a fixed amount off, never more than the subtotal.
  The discount is spread over the lines in proportion (largest remainder, exact cents) and taken off
  **before tax**, then tax is worked out per line as usual (D34). Stored on the order (`totals.discountCents`,
  each line's `discountCents` and tax) and shown in the bag summary, the confirmation page and email.
  - Points are spent **before** the charge, under a key per payment attempt, so two simultaneous orders
    can't spend the same points (tested). A declined charge gives them back, and the retry spends them
    again. An *unknown* result keeps them until staff mark the payment paid or failed. An error before the
    provider was asked gives them back at once.
  - **Refund** (payment status → Refunded): the points the order earned are taken back (the balance may go
    below zero if they were spent) and the points it used are returned. Partial refunds aren't modelled;
    staff use a points adjustment. Cancelling without a refund changes nothing.
  - All of this runs in an `afterChange` hook on orders and reservations (`settleRecordRewards`), so a staff
    edit in the admin has the same effect as checkout. It never fails the save; an error is logged.
- **Customer pages:** `/rewards` (how it works, rewards, terms), `/account` (sign in; once signed in:
  balance, next reward, rewards, points history, recent orders, sign out / sign out everywhere),
  `/account/join`, `/account/forgot`, `/account/reset`. Checkout fills in a member's details and offers the
  rewards they can afford, each labelled with the total it leaves; guests see a "sign in or join" line. Pages
  are noindex except an approved `/rewards`.
- Migration `member_rewards`.
- **Open for Lody:** whether to run a program at all; the earn rate, rewards and welcome points; the terms
  (cash value, expiry, changes, closing accounts); whether in-store Clover purchases should earn (needs
  matching a customer at the till, not built); whether reservations should earn on the deposit; and her
  accountant's view on reducing taxable sales by a store reward (built that way, D34 rounding per line).

## D48 — Phone polish: 2-wide grids, 44px targets, stronger colour contrast (2026-10-31)

- **Phones:** product grids are two columns (shop, baby gifts, gift baskets) with compact cards; tap
  targets in the footer, contact card, home links and mobile menu are 44px; the home page shows the logo
  once (the header's) above the awning edge.
- **Colour (changes Lody's D31 board palette, needs her OK):** cards and panels are white (`paper`
  #ffffff) so they lift off the cream page; gold text is deepened #9c7f5b → #735a39 (AA, replacing the
  3.4:1 deviation D31 accepted); buttons, selected chips, the bag count and the pickup/delivery bands use a
  new `coastal-deep` #56708a; low-stock labels get a blush pill. Frames and rules keep the board gold.
- **Open for Lody:** approve the white cards, darker gold and blue buttons, or ask for the board colours back.

## D49 — Soft editorial storefront: cream, cocoa and terracotta (owner's choice, 2026-11-11)

The shop owner chose a new look for the whole storefront. It **supersedes D31's palette and lockup** and
D48's colours. Content, navigation destinations and behaviour are unchanged. The admin is untouched.

- **Colour.** Tokens in `app/globals.css`, pinned by `tests/theme-contrast.test.ts`:

  | Token | Hex | From the brief | Use |
  | --- | --- | --- | --- |
  | `cream` | #f6f2ee | hsl(30 33% 95%) | page and footer |
  | `clay` | #ece1da | hsl(24 32% 89%) | product tiles, panels, the hero pebble |
  | `cocoa` | #362b26 | hsl(20 18% 18%) | text and headings: 12.3:1 on cream, 10.7:1 on clay |
  | `muted` | #6b5e57 | hsl(20 10% **38%**) | secondary text and field borders: 5.6:1 / 4.9:1 |
  | `line` | #e0d8d1 | hsl(26 20% 85%) | hairlines (decorative only) |
  | `terracotta` | #bd816b | hsl(16 38% 58%) | decoration and large type only |
  | `terracotta-deep` | #8d543f | hsl(16 38% **40%**) | filled buttons, announcement bar, small accent text |
  | `on-terracotta` | #faf7f5 | hsl(30 33% 97%) | text on terracotta |

  Two values are deeper than the brief, for WCAG AA. The brief's muted (46%) is 4.2:1 on cream. Cream text
  on the brief's terracotta is 3.0:1. On `terracotta-deep` it is 5.7:1, and `terracotta-deep` itself is
  5.4:1 on cream and 4.7:1 on clay. Focus rings stay blue (#1f4fd1, 6.1:1 / 5.3:1), and cream on terracotta.
  D31's accepted gold-text deviation no longer applies: nothing is below AA.
- **Type.** Instrument Serif 400 and italic for headings and the wordmark. DM Sans 300–500 for body (17px,
  weight 300, line height 1.7) and labels (`.label-caps`: 500, 12px, uppercase, 0.12em). Bundled in
  `app/fonts` like before. Cormorant Garamond and Source Sans 3 are removed. Display headings set one
  word in italic (`components/ui/Accent.tsx`); no more uppercase letterspaced serif titles.
- **Layout.** Container 1360px (`.shell`), section spacing 128px on desktop, less on phones. Sticky 76px
  header: links left, the shop name as a centred wordmark, account, wishlist, search and bag right.
  Phones get a menu `<details>` (still closes on navigation and Escape) and the bag. The promo banner is
  restyled as a 36px announcement bar; its carousel and pause control are unchanged. The footer ends with
  the shop name as a full-width wordmark, sized from the name's length. The bow, awning and gold frames
  are removed (`components/brand/` deleted).
- **Home.** Hero with a three-line title from the tagline; the picture is the Home-page hero photo, or
  until one is uploaded the first favourite's photo, over a slowly morphing clay pebble. Then a values
  marquee, the favourites (admin layouts and the slider's pause kept), a sticky-image section on the
  four things the shop is known for (category text and product photos), the pickup, delivery and phone
  columns, a 70vh full-bleed band (a wide gift-basket photo, else plain terracotta), the photo strip as
  editorial cards, and a terracotta custom-basket panel. No reviews, newsletter or articles were added.
- **Motion.** `motion` 12 (`motion/react`) in small client wrappers in `components/motion/`, plus
  `lucide-react` icons. Everything is still for `prefers-reduced-motion` (`MotionConfig reducedMotion="user"`
  and CSS), and content that animates in is shown without JavaScript (a `<noscript>` style).
- **Open for Lody:** the two deepened colours, and a hero and a wide shop photo for the home page.
- **Revised the same day (owner's feedback on the preview):**
  - **Pink and gold instead of brown.** Tokens renamed `terracotta` → `rose`: `cream` #fbf4f3, `clay`
    #f5e0df, `cocoa` #3a2a2e, `muted` #6f5a5f, `line` #ecd9d8, `rose` #d58f9c (decoration only),
    `rose-deep` #9c4459 (announcement bar, panels, selected chips), `on-rose` #fdf8f7, and a new `gold`
    #c8a467 for filled buttons with cocoa labels. All AA; `tests/theme-contrast.test.ts` checks them.
  - **Colours editable in admin.** Website → Store details → *Brand colour* (sets `rose-deep`) and
    *Button colour* (sets `gold`), migrations `brand_color` and `button_color`. The layout writes them
    as CSS variables. A colour is refused unless its text stays AA on it: white text on the brand
    colour, cocoa on the button colour (`src/lib/brand-color.ts`).
  - **Logo in the hero.** Until a hero photo is uploaded, the shop logo (`public/brand/logo-lockup.png`)
    stands on the pebble instead of a product photo. The header keeps the text wordmark.
  - **The values marquee moves under Reduce Motion too**, at half speed (80s), because the owner wants it
    to move on iPhones and Macs where Reduce Motion is on. It pauses on mouse hover and keyboard focus
    only; a tap on a touch screen no longer freezes it. Everything else still holds still for reduced motion.

## Superseded (WooCommerce build, commit 5c36c77)

D1–D8 described the WordPress 7.1.2 / WooCommerce 11.1.2 baseline (PHP plugin, classic theme,
MariaDB local preview). Superseded by D9. Still applicable in spirit: integer cents (D5 → `money.ts`),
configured-vs-effective runtime checks (now `system-check.ts`), tax off until owner-approved classes
exist (D7), bundled/self-hosted fonts (D8 → D13).

## D50 — Lody keeps the original look, in pink (2026-11-11)

Lody compared both previews and picked the original layout over the D49 editorial restyle. The storefront components, fonts and tests go back to their pre-D49 state (763efb6). The blue accent tokens become pink: coastal #d58f9c, coastal-deep #9c4459, coastal-pale #f8e6e8. The editable brand and button colours from D49 stay (Store details → brandColor sets coastal-deep, buttonColor sets gold), along with their migrations, so the database needs no change. The delivery pricing module stays, still unused.

## D51 — Hosting moves to Cloudflare: Workers, D1 and R2 (owner's decision, 2026-11-11)

Replaces the plan of a long-running cPanel/Passenger Node app (D9, D14). Built and tested against
wrangler's local emulation only; nothing is deployed and no Cloudflare resource exists yet. The steps
to go live are in `docs/cloudflare-go-live.md`. (Numbering: a storefront restyle is being written at
the same time and may also claim D49; renumber one of them at merge.)

- **One codebase, two targets, chosen by `DEPLOY_TARGET`.** Unset is the Node target: a SQLite file
  through libsql, uploads on disk, sharp. That is what `npm run dev`, the tests, CI and the local
  preview (`server.js`) use, unchanged. `DEPLOY_TARGET=cloudflare` (the `cf:*` scripts) is Workers
  through OpenNext with `@payloadcms/db-d1-sqlite` and `@payloadcms/storage-r2`, following Payload's
  `with-cloudflare-d1` template. `next.config.ts` inlines the value so each build drops the other
  target's packages; the host-specific code is in `src/platform/`.
- **Versions.** Payload stays 3.90.2 and Next 16.3.6. `@opennextjs/cloudflare` is pinned to 1.20.7,
  the last release whose supported range includes Next 16.3.6; later releases need Next 16.3.8 or
  newer, and the current one (1.20.16) needs 16.4.5 or newer. Upgrading Next and OpenNext together
  is a follow-up. The template itself is on Payload 3.82.1 and Next 16.4.2.
- **Database.** The same migrations run on D1 unchanged (`npm run cf:migrate`). One new migration,
  `media_object_key`, adds a hidden column the R2 plugin needs; it is declared on both targets so
  one migration history fits both. The stock ledger's write batches (D40) go through a small wrapper
  in `src/lib/inventory/db.ts` that turns named parameters into D1's positional ones. A D1 batch is
  a single transaction, so the guards hold: `tests/int/d1-ledger-guards.test.ts` proves on emulated
  D1 that a failed guard rolls the whole batch back and a repeated idempotency key is refused.
- **Uploads** are stored in R2 and still served through `/api/media/file/...`, so the rule that the
  live site shows only approved photos (D20, D32) is unchanged.
- **Lost: resized copies of new photos.** sharp cannot run on Workers, so a photo uploaded there
  keeps only its original; no thumb, card or large copy is made, and the crop and focal-point tools
  in the admin have no effect. The storefront already falls back to the original, so pages work but
  load a bigger file. Photos moved over from the old host keep their resized copies. Until this is
  replaced (Cloudflare Images, or resizing in the browser before upload), upload photos already
  sized for the web, about 1500 px wide.
- **Rate limiter.** The in-memory limiter (D41) counts within one process; a Worker has no such
  process. Cloudflare Rate Limiting bindings now enforce the same per-minute limits, one binding per
  distinct limit, keyed by action and `CF-Connecting-IP`. Counts are per Cloudflare location and
  approximate. If a binding fails, the in-memory count is used, so a customer is never blocked by it.
- **Cron jobs** become Cron Triggers. The job logic moved to `src/lib/jobs/run.ts`; the
  `scripts/*.ts` commands still work on Node. On Cloudflare the Worker's `scheduled` handler
  (`cloudflare-worker.mjs`) posts to `/ops/cron/<job>` inside the same Worker, with a key derived
  from `PAYLOAD_SECRET`; without the key the route answers 404. Scheduled: release-expired-holds
  every 5 minutes, send-pending-emails every 10, purge-carts daily. The two Clover jobs are written
  but not scheduled until the sync is verified (D43).
- **Logs.** There is no log file; Payload logs one JSON line per message to the console, which
  Workers Logs keeps (observability is on in `wrangler.jsonc`).
- **System check.** `/ops/system-check` on Cloudflare checks APP_ENV, the secret and that every
  binding is present, instead of the Node version, heap cap and DATA_DIR.
- **Secrets.** OpenNext copies the local `.env` into the Worker as fallback values. `cf:build`
  empties that copy (`scripts/cf-strip-env.mjs`), so settings come only from `wrangler.jsonc` and
  `wrangler secret put`.
- **Size.** The Worker is 4,798 KiB compressed (21.5 MB before compression), measured with
  `npm run cf:size`. That is over the free plan's 3 MB and under the paid plan's 10 MB, so the
  Workers Paid plan is required.
- **Not changed:** money, checkout, inventory rules, access rules, emails (still console only), the
  Clover adapters (still refuse to run live), and every storefront component and page.
- **Open for the owner:** the Cloudflare account and paid plan; when to move the domain's DNS
  (Lody's approval, as for any DNS change); whether to add Cloudflare Images for resizing.

## D52 — Google reviews on the home page, copied in by hand; phone footer centred (owner's decision, 2026-11-11)

- **Reviews are entered by staff, not fetched.** Lody did not want the Google Places API (a key,
  billing and Google's display terms) and does not want customers posting reviews on the website.
  A new **Website → Reviews** collection holds the Google reviews she chooses: reviewer (first name
  or initials), stars (whole number 1 to 5), review text, the review's month and an optional
  **Featured** tick. Anyone can read them; only staff can add, change or delete them (tested in
  `tests/int/reviews.test.ts`). Changes go to the audit log. Taking a review off the site means
  deleting it; there is no approval or hidden state because nothing comes in from the public.
- **Home page carousel.** Between Shop favorites and the pickup/delivery panels, one review at a
  time with its stars, name, month and a small "Google review" label, featured first then newest,
  at most 12. It moves on every 6 s and holds still on hover, on keyboard focus inside, when the tab
  is hidden, once touched, and never moves by itself for visitors who ask for reduced motion.
  Previous, Pause/Play and Next buttons, plus the Left and Right arrow keys. Every review is laid
  in the same grid cell, so the box keeps the height of the longest and the page does not jump. The
  live region is `polite` whenever the carousel is not turning by itself and `off` while it is (the
  WAI-ARIA carousel pattern), so screen readers are not interrupted every 6 s. With no reviews the
  whole section is left out.
- **Store details → Google reviews** (a new tab) holds what is shown around the carousel, all typed
  in, none fetched: **Google rating** (default "5.0") and **Number of Google reviews** (default 34),
  shown as "5.0 ★ on Google · 34 reviews" under the heading (hidden when the rating is empty), and
  **Google review link**, the target of a "Leave us a review on Google" button under the carousel
  (hidden when empty or not https). The link defaults to the shop's Google Maps listing; the
  better link is the one from Google Business Profile → Ask for reviews (`https://g.page/r/…/review`),
  which opens the review box directly. The migration adds these columns with the defaults, so the
  existing Store details row gets them too.
- **Starting reviews.** `data/google-reviews.json` holds seven five-star reviews copied from the
  Google Maps listing on 2026-11-11, names shortened to first name and initial.
  `npm run seed:reviews` loads them in that order, only when the Reviews collection is empty, and
  writes nothing else; once any review exists it does nothing.
- **Footer on phones.** Below the `sm` breakpoint (640 px) the lockup, the shop links and the shop
  address are centred; from `sm` up the footer is unchanged.
- Migration `20261111_211249_reviews` adds the `reviews` table and `store_settings.google_review_url`;
  it runs on SQLite and D1 alike.

## D53 — Staff passwords work on Cloudflare Workers (2026-11-11)

Payload 3.90 hashes passwords with PBKDF2-SHA256 at 600,000 iterations. Cloudflare Workers refuse native PBKDF2 above 100,000, so on the live site every login failed as "incorrect" (locking the owners out) and password resets returned 500. `patches/payload+3.90.2.patch` (applied by `patch-package` on install) makes Payload's local strategy fall back to `@noble/hashes` pure-JS PBKDF2 when the native call is refused. The hash format is unchanged, so hashes made on Node and on Workers verify on both. A login costs about a second or two of Worker CPU, well inside the paid plan's limit. Re-check the patch whenever Payload is upgraded.

## D54 — Paying on the site with Clover, shipping, untracked stock, order alerts (2026-11-11)

Customers can now order and pay on the website, for pickup or shipping, including Build a Basket.
Lody approved Clover's online card fees on 2026-11-11. **Nothing here has talked to Clover:** the
adapter is written from Clover's public docs and tested against recorded-style fixtures only; no
live or sandbox key was used. One migration, `checkout_shipping_payments`.

- **Payments: Clover's embedded card form.** The card is typed into Clover's hosted iframes on our
  own checkout and reserve pages (`components/checkout/CardFields.tsx`, Clover's `sdk.js`); Clover
  turns it into a one-time token (`clv_…`) in the browser, and only the token is posted. Card data
  never reaches our servers and the customer never leaves the site. On the server
  (`src/lib/payments/clover.ts`) checkout:
  1. creates a Clover ecommerce order, `POST /v1/orders`, with one line per bag line ("2 × Fudge box",
     net of any reward, its own tax as `tax_rates[].tax_amount` so the cents are exactly ours), a
     `shipping` line and address when shipped, the customer's email, and metadata with our order number,
     name, phone, the pickup time or ship-to address and the customer's note;
  2. checks Clover's order total equals ours to the cent, or charges nothing;
  3. pays it, `POST /v1/orders/{id}/pay`, with the token. A reservation deposit pays only the deposit
     (`amount`), so the Clover order shows the balance still due.
  Every POST carries an `idempotency-key` built from the record's key and attempt number (D42): a
  crash-and-retry is the same Clover order and payment. The Clover order id is saved on the record
  (`payment.providerOrderId`) **before** paying.
- **Outcomes.** Anything before the pay call (Clover down, refused, total mismatch, no token) is
  `failed` and nothing was charged. A clear decline is `failed` with a plain message (never Clover's
  text). No clear answer from the pay call (timeout, 5xx, 429, a 200 that doesn't say paid) is
  `unknown`: the D42 rules apply (no second charge from that bag, staff told). `order_already_paid` on
  a retried attempt is `paid`.
- **Reconciliation.** There is no Clover webhook for ecommerce orders we could confirm, so the
  `release-expired-holds` job (every 5 minutes) now first looks up each `unknown` Clover payment
  (`GET /v1/orders/{id}`, read only) and marks it paid when Clover says so; the existing
  `reconcilePaidHeld` then takes the stock, and the paid hooks send emails and points. It never marks
  anything failed: that stays a staff decision.
- **Which provider.** `CLOVER_ECOMM_PUBLIC_KEY`, `CLOVER_ECOMM_PRIVATE_TOKEN` and
  `CLOVER_ECOMM_ENVIRONMENT` (`sandbox` | `production`) switch Clover on; `CLOVER_ECOMM_MERCHANT_ID`
  (not secret) is optional, for the iframe's extra features. On the live store only `production` is
  accepted. A half-set configuration closes checkout and says why on `/ops/system-check` (new
  "Payments" line) rather than falling back to the test payment. Without Clover: the test payment on
  local/staging (still the e2e path in tests), "call to order" live, as before. A Clover sandbox order
  counts as a test order.
- **Shipping** (Settings → **Shipping**, a new global, owner/manager edit, audited): on/off; regular
  products a flat **$8.95** per order; gift baskets by size, **Small $10, Medium $15, Large $20, any
  larger $25**; pickup free. An order pays **one** charge, the highest single rate that applies to
  anything in it, never a sum (`src/lib/shipping/rates.ts`). Build a Basket uses its size code
  (`extra_large` and anything new is "larger"); ready-made baskets in the Gift baskets category read
  the size from their name, defaulting to the larger rate. The existing product rules decide what can
  ship: "Can ship" ticked and not "Perishable / prepared"; one item that can't ship keeps the order to
  pickup, and checkout names it. US addresses only. Shipping is not taxed (D34 unchanged). A shipped
  Build a Basket is **paid in full** (there is no pickup to pay a balance at). The bag says what
  shipping would cost; checkout and reserve show the shipping line.
- **Records.** Orders and reservations gain `fulfillment` (method, shipping charged, ship-to address)
  and orders `totals.shippingCents`; a reservation's `totalCents` includes shipping. A shipped record
  still fills the required pickup columns (the day it was placed, label "Ships by mail (no pickup)"),
  because changing them would rebuild the tables. Emails and the confirmation pages show "Ship to"
  instead of the pickup.
- **Always available (stock not tracked).** Most products have never been counted, so nothing could
  be bought. Settings → Inventory settings has a store-wide default, **on**, and each product a
  choice: use the store default, yes or no (Availability & stock). While a product or option has
  **never** been counted it is sold with no stock limit (the bag's 20 per line and a gift's per-item
  maximum still apply) and is neither held nor deducted at checkout. Any count, from Clover or Stock
  adjustments, wins; a stale count is not revived. **Consequence for go-live:** with payments
  configured, every published, online product with an approved price becomes buyable.
- **Order alerts.** Store details → **Order alert email** (the D44 field, renamed) defaults to
  `Lodeliciousorderss@gmail.com` (double "s", Lody's address). Every staff email goes there; if it is
  cleared, to that default, never the shop email. The migration fills it in on the existing row.
  Email is still console-only (D44).
- **Migration notes.** Payload proposed rebuilding `store_settings` to store the new default; on D1
  that drop would cascade-delete its hours and promo rows, so the migration is hand-trimmed to an
  `UPDATE` (as in D42). The snapshot is the generated one, so the CI drift check is clean.
- **To verify in the Clover sandbox, then live (needs Lody's keys and a person):**
  - whether `merchantId` is required by the iframe SDK for this account;
  - that `/v1/orders` `amount` includes the tax and shipping lines (if not, the total check refuses
    every payment and must be adjusted), and that per-line `tax_amount` is accepted;
  - that `/pay` honours `idempotency-key`, and `amount` for a partial (deposit) payment;
  - that `GET /v1/orders/{id}` exists for ecommerce orders (reconciliation);
  - **whether ecommerce orders appear on Lody's Clover device / Orders app** with their lines and
    metadata. If they don't, the counter learns of web orders from the alert email and /admin; a
    `/v3` order on the device would need an extra token scope (not required for this change);
  - that ecommerce orders don't change Clover stock (Clover says they don't; the D43 sync does that).

## D55 — A colour picker for the brand and button colours (2026-11-11)

(D54 is reserved for the checkout work in progress on another branch.)

Store details → *Brand colour* and *Button colour* (D49/D50) were plain text boxes that needed a colour code. They now use a picker built for the admin, `components/admin/ColorPickerField.tsx`, wired in with `admin.components.Field` and a `kind` client prop (`brand` or `button`); nothing else in `globals/StoreSettings.ts` changed.

- **Controls.** A swatch button opens a panel with a saturation/brightness square and a hue slider from `react-colorful` 5.8.1 (MIT, ~2.8 kB gzipped, no dependencies; arrow keys move both, and they are labelled sliders). There is an eyedropper button using the browser's EyeDropper API, hidden where the browser lacks it (Safari, Firefox, phones). A Hex / RGB / HSL select sits next to a text box that accepts any of those (`#c45`, `156 68 89`, `hsl(346, 39%, 44%)`; `src/lib/color-format.ts`). A "Shop sweets" sample shows the field's own text colour on the chosen colour.
- **No alpha.** The value is still stored as opaque `#rrggbb`, so the WCAG AA check in `src/lib/brand-color.ts` stays meaningful. Eight-digit hex and `rgba()` are refused.
- **Live check.** The same rule the server applies on save runs as staff pick, under the picker: "Too light for white text: 2.0:1, and it needs at least 4.5:1", or the passing ratio. Swatches that would fail for that field get a red diagonal line. Server validation is unchanged.
- **Saved swatches.** The shop's colours come first (`src/lib/color-palette.ts`: the pinks, blush, gold, gold text, ink and cream from `app/globals.css` plus both defaults; `tests/color-picker.test.ts` keeps them in step with the CSS). After them come colours staff add with *+ Add* (and take away with *Remove*). Those live in a new hidden global, **Colour palette** (`color-palette`, a JSON list, migration `color_palette`), so they show on every device. Staff can read it; owners and managers can change it. Changes are audited.
- Payload theme variables, so it follows the light and dark admin themes. 44 px controls, and the panel goes full width on a phone.

## D56 — Checkout and reserve in two columns: the order on the left, the form on the right (2026-11-11)

The checkout (`/checkout`) and the Build a Basket reserve page (`/reserve`) follow a two-column checkout layout the owner chose from a reference picture, in the site's own pink tokens and fonts. No behaviour, validation, price, tax or shipping rule changed; nothing here touched Clover.

- **Left, on a soft pink panel (`coastal-pale`):** a close button and breadcrumb back to the bag (or the basket builder); "Order summary" with an item-count pill; a white card per line with its photo, name, category and option, a − / + stepper, the line price and a remove X; a totals card (Subtotal; "Pickup in store — Free" or "Shipping $X"; Tax with an info button; Total). The stepper and X post the bag's existing `updateBagLine` action, so the page is re-priced on the server after every change; "−" stops at 1 and "+" at 20 (`MAX_LINE_QUANTITY`). The tax note is written from the tax classes actually applied (`describeTax` in `src/lib/checkout/tax.ts`), never a typed-in 6.25%. The reserve page shows the basket's contents and packaging without steppers, plus "Change basket", the gift message and the allergy notice.
- **Rewards card instead of a discount-code card.** There are no discount codes. A signed-in member's reward choice (D47) is the card on the left; non-members see the sign-in/join prompt there. The radios sit outside the checkout form and join it with `form="checkout-form"`. `ActionForm` gained an `aside` slot so that panel still shares the form's state and gets the choice back after an error, while the stepper's own small forms are not nested in the checkout form.
- **"You might also like":** one featured product that isn't in the bag, has a single option, an approved price, stock and can ship (so adding it never takes shipping away), from one extra query (`suggestAddOn` in `src/lib/checkout/presentation.ts`). "+ Add to your order" uses the existing add-to-bag action, which now accepts `next` = `/checkout` or `/checkout?method=ship` (an allowlist; anything else still goes to the bag). Shown only while checkout is open.
- **Right, on white:** a Pickup / Ship switch at the top (two links, as before, so the summary is priced on the server for the method shown, with or without JavaScript); Contact (email, name, phone); the ship-to address as one bordered box (Country fixed to the United States, recipient, street, apartment, state, town + ZIP; every row keeps a visible label, the focus ring is drawn around the row) for Ship, or the pickup time for Pickup; notes and the allergy notice; the Clover card fields restyled (rounded boxes, decorative Visa / MC / Amex / Discover marks, "Secure payment by Clover" with a lock); Subtotal and Total repeated; a full-width "Pay $X.XX" button with a lock ("Place test order · $X.XX" with the test provider); Pickup & delivery · Cancellations & refunds · Privacy (there is no Terms page; these are the existing policies).
- **Phone (390 px):** one column; the order summary folds behind "Show order summary · $X" (a disclosure button, `aria-expanded`), the rewards card stays visible, then the form; the Pay button sticks to the bottom of the screen while the form is in view, and the page gets `scroll-padding-bottom` so a focused field is never hidden behind it (WCAG 2.4.11). The chevron's rotation is motion-safe only.
- **No Apple Pay or Google Pay** (Apple Pay since added, D59). Clover's iframe has wallet buttons (`PAYMENT_REQUEST_BUTTON`, `PAYMENT_REQUEST_BUTTON_APPLE_PAY`), but Apple Pay needs the merchant's web domain validated with Clover first, and Google Pay needs Google's terms accepted and a different token flow (amount-bound button, its own event) that hasn't been tried in the sandbox (D54 still lists the card flow as unverified). Both are merchant setup Lody hasn't done, so they are left out, as are PayPal and Alipay.
- **To confirm with Clover:** the card marks show the four US networks Clover ecommerce normally accepts; if Lody's account accepts fewer, take them out of `CardFields.tsx`.
- Screenshots: `docs/screenshots/d56-*.png` (fake payment provider, local data with a few chocolates ticked "Can ship" so the Ship view shows).

## D57 — Promo banner becomes a thin continuous ticker (2026-11-12)

The owner asked for a thinner promo banner with no arrows and no play/pause button, looping continuously. The ribbon is now one line that scrolls the promotions right to left without a seam (two identical runs, the track moves by half). It holds still while hovered or while a link in it has keyboard focus, and a tap on the strip toggles pause. Under reduced motion it keeps moving at a third of the speed, the same owner choice as the marquee note in D49. "Seconds" in Store details → Promo banner now sets the speed. Trade-off: with no visible pause control, WCAG 2.2.2 is met only by hover, focus and tap-to-pause.

## D58 — A floating receipt bar on storefront pages (2026-11-12)

Once the bag has something in it, a slim bar is fixed to the bottom of every storefront page: the item count, the subtotal, a chevron and a **Checkout** button. The chevron (or anywhere on the count and subtotal) opens a receipt above the bar, on white "paper" with a scalloped top edge and dashed rules: "Your order", each line with its quantity, a small photo and its price, then Subtotal, **Estimated tax (6.25%)**, "Shipping or pickup chosen at checkout." and **View bag** / **Checkout**. In the site's pink tokens and fonts.

- **Where it shows.** Every storefront page except the bag (`/cart`), checkout (`/checkout`) and reserve (`/reserve`), which already show the order and have their own sticky Pay button (D56). The admin has its own layout and never gets it. The rule is `showReceipt` in `src/lib/checkout/receipt.ts` (whole path segments, so `/cartoons` would still show it).
- **Figures come from the server.** The storefront layout prices the bag with the same `priceBagForCheckout` the bag page uses, so subtotal and tax are `priceCart`'s, rounded per line from the owner's tax classes (D34). The tax label names the rate only when the taxed lines share one; otherwise it says "Estimated tax". Unapproved prices show "Price to be confirmed" and a line that can't be bought is flagged; then the bar's button goes to the bag, not checkout. An empty bag (no cookie, or no lines) costs one read and renders nothing.
- **Add to bag stays on the page.** Once the product page is interactive, its form sends `stay=1` and the action answers instead of redirecting to the bag; it already revalidates the layout, so the new bag arrives with the same response, no reload. The form fires `lodelicious:bag-added` and the bar slides up; "Added to your bag." appears beside the button. Without JavaScript the form still goes to the bag. Checkout's "+ Add to your order" is unchanged. There is no Quick add on product cards, and Build a Basket reserves a basket rather than adding it to the bag (D36), so neither fires the event today; anything that adds to the bag later only needs to dispatch it.
- **Accessibility.** The toggle is a button with `aria-expanded` and `aria-controls`. While open, focus moves to the "Your order" heading and Tab stays inside the receipt; Escape, the chevron or a tap on the dimmed page closes it and focus returns to the toggle. A polite live region says "Bag updated: 2 items, subtotal $7.80." when the count changes (not on page load, and not on the excluded pages). Every control is at least 44 px. The bar's bottom padding includes `env(safe-area-inset-bottom)` for the iPhone home indicator.
- **The page keeps clear of it.** While the bar shows, the body gets bottom padding the height the bar covers (measured, so the safe area and the desktop gap count) and the same scroll padding, so the footer is never hidden and a focused field scrolls above the bar (WCAG 2.4.11). The promo ticker is at the top of the page and the reviews controls scroll past, so neither is covered for good.
- **Motion.** The slide-in is a CSS animation; under reduced motion the site-wide rule switches it off and the bar simply appears.
- **Phone first.** Full width on a phone; from the tablet width up it floats as a rounded card, centred, at most 36 rem wide.
- Screenshots: `docs/screenshots/d58-*.png` (two items, 390 px collapsed and open, 1280 px collapsed and open).

## D59 — Apple Pay through Clover's iframe, above the card fields (2026-11-12)

The owner asked for Apple Pay at checkout. It uses Clover's own Apple Pay button from the same
iframe SDK as the card fields (D54), and pays through the same server path as a card. **Nothing here
has run against Clover or on an iPhone**: it is written from Clover's public docs ("Clover iframe
features: Apple Pay", read 2026-11-12) and tested with fakes and fixtures only.

- **Where it shows.** Above "Card details" on `/checkout` and `/reserve`, followed by "or pay by
  card", only when all of these hold: Clover is the provider; `CLOVER_ECOMM_APPLE_PAY=on`;
  `CLOVER_ECOMM_MERCHANT_ID` is set (Clover's button takes it as `sessionIdentifier`); and the
  browser has `ApplePaySession` with `canMakePayments()` true over HTTPS (Safari on an Apple device
  with Apple Pay set up). Anywhere else nothing renders, not even the divider, and the card form is
  unchanged. The check runs after the page loads (server markup never has the button). Apple's
  `canMakePayments()` doesn't ask about a specific card; only Clover knows the Apple merchant
  identifier, so `canMakePaymentsWithActiveCard` isn't possible, and Apple's guidance is to show the
  button whenever `canMakePayments()` is true.
- **Switched off by default.** `CLOVER_ECOMM_APPLE_PAY` stays unset until the domain shows
  *Verified* in Clover, so Safari never shows a button that can't work.
- **Flow** (`src/lib/payments/apple-pay.ts`, `components/checkout/ApplePayButton.tsx`). The page
  builds `clover.createApplePaymentRequest({ amount, countryCode: "US", currencyCode: "USD" })`, sets
  the total's label to **Lodelicious**, and mounts `PAYMENT_REQUEST_BUTTON_APPLE_PAY` on the same
  Clover instance as the card fields. When the customer approves the sheet, Clover fires
  `paymentMethod` on `window` with `detail.tokenRecieved.id` (Clover's spelling). The form is checked
  the way the Pay button checks it (missing email, name, phone, pickup time or address: the sheet is
  told "failed", the browser highlights the field, and the page says nothing was charged; the
  wallet's email fills an empty email box). Then the checkout form is submitted with that token as
  `cardToken` plus `wallet=apple_pay`, skipping the card fields.
- **Same server path.** The token goes through `cardSource` (same `clv_…` check), `placeOrder` /
  `reserveBasket`, the Clover order, the to-the-cent total check, `/pay` with `source` = the token,
  the D42 idempotency keys, stock holds and `unknown` handling, all unchanged. The only server
  difference: with `wallet=apple_pay` a successful order answers `{ next: receipt URL }` instead of
  redirecting, so the browser can call `clover.updateApplePaymentStatus("success")` before it loads
  the receipt (a server redirect would leave Apple's sheet without an answer). Any error answer
  calls `updateApplePaymentStatus("failed")` and shows the server's message as for a card.
- **Amount.** Exactly what will be charged, worked out on the server page: on `/checkout` the order
  total with tax and shipping, following the member's reward radio (each option's discounted total
  plus shipping); on `/reserve` the deposit or pay-in-full choice for pickup, the full total for a
  shipped basket. Pickup / Ship and bag changes reload the page's figures from the server, and the
  button calls `clover.updateApplePaymentRequest` with the new amount. The server still decides the
  real charge; Apple's sheet only displays it.
- **Domain verification.** Apple's file, from Clover's dashboard, is committed at
  `public/.well-known/apple-developer-merchantid-domain-association` (public content). Both hosts
  serve it with 200, `text/plain`, no redirect: `next start` from `public/` with a `Content-Type`
  rule in `securityHeaders`; on Workers the static assets answer before the app, so
  `public/_headers` sets the type there (checked with `cf:preview` and `curl -i`). The same path
  with a trailing slash redirects to the exact path; Apple asks for the exact one.
- **Unknown until live.** The token prefix (`clv_` assumed; anything else is refused as "Please
  enter your card details", charging nothing), whether `total.label` survives
  `createApplePaymentRequest`, and timing: Apple gives about 30 seconds after approval, while
  checkout waits up to `PAYMENT_TIMEOUT_MS` (default 30 s) for Clover. A slow Clover can leave the sheet
  showing a failure while the page shows the usual "don't pay again" message for an `unknown`
  payment.
- Screenshot: `docs/screenshots/d59-checkout-no-apple-pay.png` (headless Chrome, which has no Apple
  Pay, with Clover sandbox and the switch on: the page is as before).

## D60 — Shipping boxes by weight; box price charged only once Lody switches it on (2026-11-13)

Lody's boxes (2026-11-13): Small 14 × 9 × 14 in, 2–3 lb (baskets and smaller items); Medium
16 × 10 × 16, 3–4 lb; Large 18 × 12 × 20 h, 5–6 lb (large basket); Extra large 22 × 22 × 18,
6–7 lb. She is entering each product's weight now. One migration, `shipping_boxes`.

- **Weights.** Products → Fulfillment → **Shipping weight (lbs)**: optional, decimals allowed, above
  0. One weight per product, so every option weighs the same. A ready-made basket (Gift baskets
  category) is a product: its weight is the whole basket. Build a Basket items are products too, so
  there is no separate field; each basket size in Gift builder settings gains **Empty basket &
  packaging weight (lbs)**, added to the chosen items. The older `packedWeightOz` field (never used)
  is kept, relabelled "not used".
- **Boxes** (Settings → Shipping → Boxes by weight): an editable list of name, maximum weight (lb),
  price and L × W × H (in), prefilled with her four boxes. Each maximum is the top of her range
  (3, 4, 6, 7 lb). Prices default to the D54 basket rates for the same size ($10, $15, $20, $25).
- **Picking the box** (`src/lib/shipping/boxes.ts`): order weight = Σ quantity × weight, in exact
  hundredths of a pound; the box is the one with the smallest maximum that holds it (the cheaper of
  two equal maximums). Only weight decides; the dimensions are shown to staff. No box is picked when
  any item (or a custom basket's empty basket) has no weight, the order is over the largest box, or
  the list is empty.
- **Charging.** A new **Charge by box** switch, **off**. Off: the D54 rules charge exactly as before
  and the box is only recorded for staff. On: an order that fits a box pays that box's price. With
  the switch on, any order without a picked box still pays the D54 rules exactly. Who may ship is
  unchanged (Can ship, not perishable, shipping on). Why a switch, when the boxes are priced at
  today's rates: the D54 rate depends on what is in the order (regular items $8.95, baskets by
  size) and a box price doesn't, so no box price can match today's charge for every order. Example:
  a 1 lb chocolate order fits the Small box ($10) but pays $8.95 today.
- **On the order.** Orders and reservations: Pickup or shipping gains **Box to pack** ("Medium box,
  16 × 10 × 16 in", or "Choose a box by hand: no shipping weight for Truffles" / "… over the largest
  box") and **Order weight (lbs)**. They show for shipped records only, read-only, set by checkout.
- **Settings rows.** A Shipping row that has never been saved uses the four boxes from code. A saved
  row uses the list as staff left it, even when empty. The migration inserts the four boxes for an
  existing row (the live one), so the admin shows them.
- **Migration** `20261114_035407_shipping_boxes`, generated with `payload migrate:create`. Additive
  only: a new `shipping_settings_boxes` table and nullable columns (`products` and `_products_v`
  shipping weight, `gift_builder_settings_sizes` packaging weight, `orders`/`reservations` box and
  weight), plus `shipping_settings.charge_by_box` defaulting to false. No table is rebuilt, so
  there is no D1 cascade (D54). One hand-added `INSERT … SELECT` prefills the boxes. I ran it with
  sqlite3 against a table holding one existing row; it has not been run on D1. The snapshot is the
  generated one; a second `migrate:create` reports no schema changes.
- **For Lody to decide:** box prices (the Small box at $10 costs a regular-items order $1.05 more
  than today's $8.95), then tick Charge by box. Until every item in an order has a weight, that
  order keeps today's rates.

## D61 — Paid web orders print on Lody's Clover device (2026-11-13)

The owner asked whether web orders can print on her Clover device instead of her checking email each
time. Built **switched off** (`CLOVER_ORDER_PRINT=on` turns it on). **Nothing here has called Clover
to write anything:** it is written from Clover's public docs (read 2026-11-13: "Print orders with the
REST API", "Create custom orders", "Create an atomic order", "Orders FAQs", the `print_event` and
`/v1/orders/{id}/pay` references) and tested with a scripted `fetch` only. The only live calls were
read-only GETs to see what Lody's existing REST token may do (below). No migration.

- **What happens** (`src/lib/clover/order-print.ts`, hook `src/hooks/clover-print.ts` on orders and
  reservations, after the email hook). When a record is saved as paid (an order `paid`; a reservation
  `deposit_paid` or `paid_in_full`), not canceled:
  1. `POST /v3/merchants/{mId}/orders` with `state: "open"` (Clover's docs: only open orders show in the
     Orders app), `title: "WEB <number> PAID"`, `taxRemoved: true` (so the device adds no tax of its
     own), `total`, and a `note`: "PAID ONLINE at the website - do not charge again", the order number,
     the customer's name and phone, `PICKUP: <slot>` or `SHIP TO: <address>`, the reward discount, the
     customer's note (orders) or the basket contents, card message, requests and "BALANCE DUE AT PICKUP"
     (reservations), and the ecommerce order id of the payment.
  2. `POST .../orders/{id}/bulk_line_items` with **custom lines: `name` and `price` only, never `item`**,
     so no inventory item is used or created and Clover's stock is untouched. One line per bag line,
     "2 x Fudge box (Dark)" priced at the line total after any reward (quantity folded into the name, as
     the D54 ecommerce order does, so discounts stay exact and `unitQty`'s units don't matter); then
     "Shipping (paid)" and "Sales tax (paid)" lines, so the lines add up to the amount charged. A
     reservation is one basket line.
  3. `POST /v3/merchants/{mId}/print_event` with `{ orderRef: { id } }`. Clover routes it to the
     device's order printer, or its built-in printer when there is none.
- **The payment is not linked to that order.** Clover links an ecommerce charge to an order only by
  paying the order through the ecommerce API (`/v1/orders/{id}/pay`, which the atomic-order guide shows
  for a v3 order). Doing that would put Clover's Orders API in front of the charge, so a v3 problem
  could fail a payment, which the request forbids. Recording a "payment" on the printed order instead
  (`/v3/.../orders/{id}/payments`) would count every web sale twice in her reports. So the printed order
  is a slip: it says PAID ONLINE and carries the ecommerce order id; the money stays on the D54
  ecommerce order. **Consequence:** the slip is an open, unpaid order in her Orders app. Staff must not
  take payment on it (the title and note say so) and can delete or close it once packed.
  - Not chosen: printing the D54 ecommerce order itself with `print_event`. It is linked to the payment
    and would avoid a second order, but Clover doesn't say whether ecommerce orders are v3 orders a
    device can print, and they carry our details only in `metadata`, which a slip doesn't show. Worth
    one sandbox test (below); if it works it is a smaller change than this.
- **Never fails or refunds the order.** The hook catches everything; a Clover error is one log line
  (`[clover-print] order SP-1042: not printed (...); will retry. The order itself is fine.`) with the
  token redacted. The record is never written by this code. Emails (D44) still go out, so a missed
  slip still reaches the order alert inbox.
- **Once per order.** A `sync-jobs` row per record, key `clover-print:<collection>:<idempotency key>`
  (never a bare row id, D45), is the lock and the checkpoint: one conditional UPDATE claims it (two
  saves or the hook and the job never run it together), and each step is saved before and after its
  call. A create whose answer was lost is found by its title (`GET .../orders?filter=title=...`) before
  another is made; lines whose answer was lost are counted (`GET .../line_items`) before they are added
  again. The paper is at least once: a lost print answer prints a second slip rather than none. Done
  rows (`last_success_at` set) are never run again. No migration: the row lives in the existing table,
  so failures are also visible in System → Sync jobs.
- **Retries.** The send-pending-emails job (every 10 minutes) also runs `printPendingOrders`: paid
  records from the last 48 hours not printed yet. At most 6 tries each; a 401, 403 or 404 (bad token,
  missing permission, wrong merchant) gives up at once. Each call times out after 8 s.
- **Only new orders.** Records created more than 48 hours ago are never printed, so switching it on
  doesn't print the backlog.
- **Sandbox stays sandbox.** A test-mode record (the test provider, or a Clover sandbox payment) prints
  only when the print environment is `sandbox`, a live one only when it is `production`; the live store
  refuses `sandbox` (D41 rule: unset `APP_ENV` counts as live).
- **Settings.** `CLOVER_ORDER_PRINT=on`; `CLOVER_ORDER_PRINT_TOKEN` (else `CLOVER_API_TOKEN`);
  `CLOVER_MERCHANT_ID` (else `CLOVER_ECOMM_MERCHANT_ID`); `CLOVER_ORDER_PRINT_ENVIRONMENT` (else
  `CLOVER_ECOMM_ENVIRONMENT`). Missing or malformed values are logged by name, never by value, and print
  nothing. Hosts: `api.clover.com`, `apisandbox.dev.clover.com` (North America only).
- **Lody's current token** (`lody-token.txt`, checked 2026-11-13 with read-only GETs on
  `api.clover.com`): `GET /items` 200; `GET /merchants/{mId}`, `/orders`, `/order_types`, `/devices`,
  `/employees`, `/properties` all **401**. It can read inventory only, so it **cannot create orders or
  print**. Clover requires "Write orders" for `print_event` and "Read orders" to look one up. She needs a
  token with **Orders: Read and Write** (Clover web dashboard → Account & Setup → API Tokens → create
  one, tick Orders read and write; nothing else is needed). Whether a token can write can't be checked
  without writing, so the first real test is the check.
- **To verify in the sandbox, then live (needs a person at the device):**
  - the order appears in the Orders app and prints, with the title, note and custom lines; Clover's FAQ
    says custom *modifiers* don't print and that atomic orders with custom items may not (we use
    neither), so check the lines really print;
  - `taxRemoved: true` keeps the device from adding tax to the custom lines;
  - `filter=title=` works on the orders list (the lost-answer lookup);
  - whether the slip prints on an order (kitchen) printer or the receipt printer, and how long it takes
    (community reports up to ~2 minutes);
  - optional: `print_event` with the D54 ecommerce order id, to see whether the paid order itself
    prints (see "Not chosen").
- **Tests.** Unit (`src/lib/clover/order-print.test.ts`): settings, the slip for orders, shipping and
  reservations, text cleaning and limits, when it is due, the exact requests (no `item`, token only in
  the header). Integration (`tests/int/clover-print.test.ts`): one order and one print, nothing on a
  second run, switch off, a 503 finished by a retry from its checkpoint, a lost create found by title,
  a refused token given up, a test order not sent live, the job, and a real checkout with Clover down
  still paid.
- Owner instructions: `docs/clover-order-printing.md`.

## D62. Temporary Apple Pay diagnostics

- **Why.** On a live iPhone the Apple Pay sheet opens and closes within a second. Clover's merchant
  session call (`POST api.clover.com/v3/apple_pay_session` with `domainRegistrationIdentifier` = the
  merchant id) returns a valid Apple session for both shoplodelicious.com and www, so domain
  registration is not the cause. Apple's session runs inside Clover's cross-origin frame, so nothing
  on our page saw why it closed.
- **What.** While the Apple Pay button is mounted, `src/lib/payments/apple-pay-diag.ts` records the
  names (and data keys) of the messages Clover's frames post to the page, page errors, window
  focus/blur and our own submit outcome, and beacons them to `POST /wallet-log`, which logs one
  `[applepay-diag]` line for `wrangler tail`. No card, address, email or token values are recorded.
- **Removed** (2026-11-14) once Apple Pay worked. The logs showed every Clover message twice: two
  `clover.elements()` relays began two Apple Pay sessions per tap (fixed in PR #39).
