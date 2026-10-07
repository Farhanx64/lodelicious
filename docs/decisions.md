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
  `.env.example` keeps `APP_ENV=local` for development and says so.
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
  `APP_ENV` is not local, staging or test, prints why, and exits 1. `SEED_FORCE=1` or `-- --force`
  overrides it. An empty database, or any local, staging or test one, is unaffected.
- **Tests and CI (A22).** Unit tests for each fix, integration tests in `tests/int/audit-fixes.test.ts`
  (first owner, passwords, media access, upload limits, API surface, closed dates, cart purge) and CI
  now fails when `payload migrate:create` finds schema changes no migration covers or writes a file.
  Actions are still pinned by tag.

New environment variables: `FIRST_OWNER_EMAIL`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `SEED_FORCE`.
Changed meaning: `APP_ENV` (allowlist, must be set to `production` on the live host),
`NEXT_PUBLIC_SITE_URL` (now enables the CSRF allowlist; the `.env.example` value is commented out).

## Superseded (WooCommerce build, commit 5c36c77)

D1–D8 described the WordPress 7.1.2 / WooCommerce 11.1.2 baseline (PHP plugin, classic theme,
MariaDB local preview). Superseded by D9. Still applicable in spirit: integer cents (D5 → `money.ts`),
configured-vs-effective runtime checks (now `system-check.ts`), tax off until owner-approved classes
exist (D7), bundled/self-hosted fonts (D8 → D13).
