# Clover inventory sync — status and what we need from Lody

## Status (2026-10-07)

**The website half is built (D40) and the sync worker is built against a fake Clover (D43). Nothing has talked to the real Clover yet:** that needs Lody's stock counts and an API token, and a check of the real API in Clover's sandbox. These pieces are already in place:

- **Merchant ID received.** The account is SOUSET-PINK. The ID is kept in the server's
  `CLOVER_MERCHANT_ID` setting, not in the code.
- **Inventory export received** (105 items) and recorded as source evidence. Website products now
  carry their Clover item ID, and products are matched by ID, never by name. See
  `docs/reconciliation.md`.
- **Price authority decided:** the Clover price wins (D25).
- **In-store reserve:** each product has a "Keep for in-store" number, 1 by default (D26).
- **Stock modelling:** stock is tracked per product and per option, for example pink and blue.
  Unknown stock can't be bought.
- **Stock ledger and outbox (D40):** every stock change is a row in `stock-movements`, and each one queues a
  `stock_changed` event in the `outbox` in the same transaction. Staff counts and adjustments go through
  Inventory → Stock adjustments, and are audited.
- **Holds, a bill of materials and an age limit (D40):** checkout holds stock while a customer pays, curated baskets
  can list their components, and Settings → Inventory has a (switched-off) limit on how old a count may be.
- **Cron lock:** `sync-jobs` now holds a no-overlap lock for `scripts/release-expired-holds.ts`; the Clover jobs
  can use the same `acquireJobLock`. Its checkpoint column is still unused.

## What the sync worker does now (D43)

- **Built and tested with a fake:** `scripts/clover-push.ts` sends the outbox (claim, idempotency key,
  backoff, dead after 8, throttle and "Clover is down" stops, 50 s budget); `scripts/clover-pull.ts` reads Clover
  page by page into the ledger as `sync` counts (stamps every item, adds unsent website sales back, matches by
  Clover ID only, saves a checkpoint). `CLOVER_DRY_RUN=1` makes either one report without changing anything.
  Staff see health in `/ops/system-check`. Details and the list of things to verify in the sandbox: D43.
- **Cron lines for cPanel** (after the token is in the server's settings):
  - `npx payload run scripts/clover-push.ts` every 1 to 2 minutes
  - `npx payload run scripts/clover-pull.ts` every 5 to 15 minutes (Lody picks)
  - plus the existing `npx payload run scripts/release-expired-holds.ts` every 5 minutes
- **Server settings:** `CLOVER_ENVIRONMENT` (`sandbox` first), `CLOVER_MERCHANT_ID`, `CLOVER_API_TOKEN`.
  The live account additionally needs `CLOVER_SYNC_LIVE=1`; without it the worker refuses to start.
  `CLOVER_DRY_RUN=1` for a trial run. Until these are set, both scripts say "not configured" and do nothing.
- **Must be checked in the sandbox before going live:** absolute or delta stock update, the real response
  shapes, whether Clover honours an idempotency key, the rate limits. Do not point it at the live account first.
- **Needs Lody (besides the list below):** for the Philips bar and Princess Assortment (shared Clover items) the
  pull skips both products and reports them until the Clover items are split. Options (pink / blue) are neither
  pushed nor pulled until each has its own Clover item and the website gets a per-option Clover ID (a later migration).

## What the sync worker needs from the website (built in D40)

The website half is done and tested against a real database; nothing talks to Clover yet. Everything
below is what a Clover worker (built against a fake adapter first) should rely on.

**Outbox (`outbox` collection, table `outbox`)**
- One row per stock movement, written in the same database transaction as the movement, so a crash can
  never lose a change. `eventType: stock_changed`; `payload` has `productId`, `cloverId`, `variantKey`
  (null for the product itself), `delta`, `quantityAfter`, `movementId`, `reason`, `reference` (order or
  reservation number). `idempotencyKey` is unique (`stock_changed:<movement key>`) and is the key to send
  to Clover so a retry can't apply twice.
- Statuses: `pending` (new), `failed` (last attempt failed, retry at `nextAttemptAt`), `sent`, `dead`
  (gave up; a person must look). The worker takes rows with status `pending` or `failed` and
  `nextAttemptAt` empty or in the past, oldest first, and records `attempts`, `lastAttemptAt`, `lastError`,
  `sentAt`. `src/lib/inventory/outbox.ts` has the retry rule: `afterFailure(failedAttempts, now)` gives
  `failed` with the next time (30 s doubling to 6 h) or `dead` after 8 failures. Updates to a row should be
  conditional on its current status so two runs can't both send it; take the cron lock with
  `acquireJobLock` (`src/lib/inventory/job-lock.ts`) like `scripts/release-expired-holds.ts` does.
- A failure here never touches the paid order or the stock: the website's stock is already correct, and
  the outbox row carries the retry. Staff see `failed` and `dead` rows under Inventory → Outbox events.
- Not queued: movements with reason `sync` (they came from Clover) and recounts that changed nothing.
- **Open (verify in the Clover sandbox):** whether Clover's item stock endpoint sets an absolute quantity
  or adds a delta. The event carries both `delta` and `quantityAfter`. Pushing the absolute number would
  overwrite in-store sales rung up since the last read, so prefer a delta call if Clover has one;
  otherwise read the current Clover quantity, apply `delta`, and write it back, and accept the small
  window.
- **Open:** options (pink / blue, window / classic) have no Clover item ID on the website, only products do
  (`cloverId`). Either each option is its own Clover item (then add a `cloverId` per option, in a later
  migration) or they share one item and the worker can't push per-option stock. This depends on Lody
  splitting the shared Clover items (see below).

**Reading Clover stock into the website**
- Do not write `products.stockQuantity` with `payload.update`. Call `applyMovements`
  (`src/lib/inventory/ledger.ts`) with `mode: "count"`, `reason: "sync"`, the Clover quantity, `countedAt` =
  the time Clover was read, and a unique `idempotencyKey` (for example `sync:<run id>:<item id>`). It sets
  the quantity, marks it known, stamps the count date and writes the ledger row, atomically; a `sync`
  movement queues no outbox event, so nothing is echoed back to Clover.
- Freshness: once Lody sets "Longest age of a stock count" (Settings → Inventory), anything the sync has
  not touched in that time stops being sellable. So the worker must stamp every item it reads, even when
  the number is unchanged (a `count` with no change writes a ledger row of 0 and still updates the date).
  Items missing from Clover's answer should not be touched, and they will go stale by themselves.
- In-store sales reach the website only on the next read, and the in-store reserve (D26) covers that gap.
  A website sale still waiting in the outbox is unknown to Clover, so copying Clover's number straight over the
  website's would forget that sale and could oversell. Add the item's pending outbox deltas to what Clover returns
  before calling `applyMovements`, or drain the outbox first.

**Other jobs**
- `npx payload run scripts/release-expired-holds.ts` should run every 5 minutes from cPanel cron. It marks
  overdue checkout holds expired, tidies old ones and takes the stock for any paid order or reservation
  whose stock was never taken. It is safe to run twice at once (the second exits).
- A late payment result (a Clover event that arrives after the hold lapsed, in milestone 6) should set the
  record's payment status and then call `settleStock` (`src/lib/inventory/settle.ts`): it takes the stock if
  it is still there, otherwise flags the paid record for staff (`stockStatus: needs_attention`). It never
  asks for the payment again.

Planned design (decision D10, which replaces SKU IQ):
- Use Clover's REST API with an **inventory-only** token Lody creates.
- A scheduled cPanel job reads Clover stock every few minutes.
- A queue sends each website sale back to Clover exactly once.
- Basket sales deduct the individual chocolates and candies, never a "basket" item.
- In-store sales reach the website on the next scheduled check. The in-store reserve covers that gap.

## Still needed from Lody

1. **Stock counts in Clover.** The export's Quantity column is empty for all 105 items. Turn on
   "track stock" for the items sold online and enter the counts. Clover's counts become the
   website's starting stock, and nothing can be bought online until they exist.
2. **Split shared items in Clover** so stock can be tracked separately:
   - "Philips Chocolate Bar" is sold on the site as two products, Dark and Milk.
   - "Princess Assortment" comes in two styles, Window and Classic.
3. **Add the missing items to Clover:**
   - baby ceramic bowl, shoes and block, in pink and blue
   - the white wicker bassinet
   - the Cape Cod fudges (is "sea salt caramel fudge" one of them?)
4. **Teddy Bear.** The card says $14.95. Clover has "Teddy Bear" at $10.95 and "Teddy Bear Vintage
   Collection" at $14.95. Which one is on the card?
5. **The API token, when the sync is built.** Create it in the Clover dashboard with **Inventory:
   read and write only**: no payments, no customers, no merchant details. Share it privately. It
   never goes in email text or the code repository. Lody can delete it at any time to switch the
   access off.
6. **Decisions still open:**
   - How often to check Clover, for example every 5 or 15 minutes.
   - Whether packaging (baskets, ribbon) is tracked in Clover.
   - The per-product reserve numbers, if not 1.
7. **The DoorDash page link** for local delivery (D28), and the **"Our story" text** for the
   footer (D30); both go in /admin → Store settings.
8. **Later, for payments (milestone 6):**
   - Clover ecommerce API keys (public and private).
   - Lody's approval of Clover's online processing fees before anything goes live.
   - Money goes straight to her Clover account, and the website never sees or stores card numbers.

Clover's API itself has no extra charge. Card processing fees apply only once payments are turned on.
