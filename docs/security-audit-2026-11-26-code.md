# Lodelicious white-box security audit (code half), 2026-11-26

Reviewer: `sec-code` worker. Scope: `origin/main` at **24fdc3f** (PR #64). The worktree branch `Farhanx64/sec-code` was at D45 (8f76b4a), so it was checked out detached at `origin/main` for this audit. Nothing was committed or pushed, and the live site, Clover, Shippo and Cloudflare were not called.

**Method.** I read the code paths. No dev server was run, because swap was 7.5 GB of 8 GB. I ran `npm audit --omit=dev`. "Confirmed" means the code path alone shows the finding. "Suspected" means the outcome depends on behaviour outside this repo (Clover, Shippo, Cloudflare, Next internals) that I could not run.

**Severity.** Critical: money loss or admin takeover with no other mistake needed. High: directly exploitable for money or data. Medium: exploitable abuse with real business impact. Low: hardening or narrow impact.

## Summary

There are **no Critical or High findings**. The payment core holds up:

- prices, tax, shipping, deposit and points are worked out on the server;
- each attempt has its own idempotency key;
- an unknown payment result is never charged again;
- the points ledger is atomic;
- private order links use HMAC tokens, stored hashed.

The findings are abuse paths that the new email, Shippo and Clover integrations opened, plus one dependency upgrade.

| # | Sev | Title | Status |
|---|-----|-------|--------|
| M1 | Medium | Contact/fountain receipt is an open email relay from orders@shoplodelicious.com | Confirmed |
| M2 | Medium | `/checkout/ship-quote` has no effective rate limit on Cloudflare; every call creates a Shippo shipment | Confirmed |
| M3 | Medium | Checkout can be used for card testing (per-IP limit only, no challenge); each attempt creates a real Clover order | Suspected |
| M4 | Medium | `next@16.3.6` has advisories, one rated critical (ISR/SSG cache poisoning, metadata route disclosure) | Suspected reachable |
| L1 | Low | Staff password reset by email skips the 12-character policy; no `serverURL`, so the reset link may be relative | Confirmed / Suspected |
| L2 | Low | The order alert email address is public via `/api/globals/store-settings` | Confirmed |
| L3 | Low | Members: no email verification; anyone can lock any member's account | Confirmed |
| L4 | Low | Every staff role can buy live postage, and two clicks at once can buy two labels | Confirmed |
| L5 | Low | `updateBagLine` server action is not rate limited | Confirmed |
| L6 | Low | Still no Content-Security-Policy (A08 carry-over) | Confirmed |
| L7 | Low | `/dashboard` shows revenue to the fulfillment role | Confirmed |
| L8 | Low | sharp / undici / happy-dom / fast-uri advisories (not reached with untrusted input) | Confirmed present |

## Findings

### M1 Medium: the inquiry receipt is an open email relay (Confirmed)

- **Where:** `app/(frontend)/contact/actions.ts:17-20` and `app/(frontend)/events/actions.ts:17-20` → `src/lib/inquiries/service.ts:118-132` → `src/lib/email/notify.ts:154-158` (customer receipt to `i.customer.email`) → `src/lib/email/templates.ts:305-314`. The template quotes **"Your message"** (attacker text) and "Hi <name>".
- **Exploit:**
  1. POST the contact server action with `email=<victim>`, `name=<lure>`, and `message=<phishing text with a phone number or a URL written out>`.
  2. Rotate IPs. The limit is 5/min per IP (`src/lib/rate-limit.ts:84`), and the inquiry form has no challenge.
  3. Each request sends a DKIM-signed Cloudflare email from `orders@shoplodelicious.com` with Lodelicious branding to any address.
- **Impact:**
  - Branded phishing or spam to arbitrary people.
  - Complaints and bounces hurt the domain's sending reputation, or get Email Sending suspended. Then order confirmations and staff alerts stop.
  - The staff alert inbox is flooded as well.
- **Fix:**
  - Don't echo the message, or the name beyond the first word, in the customer receipt (keep it in the staff email). Or drop the customer receipt for inquiries.
  - Add Cloudflare Turnstile to the contact, fountain and review forms.
  - Cap receipts per recipient address per day (for example 2).

### M2 Medium: the shipping quote endpoint is not rate limited on Cloudflare (Confirmed)

- **Where:** `app/(frontend)/checkout/ship-quote/route.ts:11` calls `withinLimit(...)`, the in-memory per-isolate counter. It never calls `isRateLimited()` (`src/lib/rate-limit-server.ts:14-21`), which uses the `RATE_LIMIT_*` bindings on Workers. The `rate-limit-cloudflare.ts` header says in-memory counts "would hardly ever add up" on Workers.
- **Path:** every call runs `quoteLiveShipping` (`src/lib/checkout/service.ts:274-282`) → `liveRaterFrom` (`src/lib/shipping/live-rate.ts:45-70`) → `getRates`, which POSTs `/shipments/` to Shippo (`src/lib/shipping/shippo.ts:142-170`). There is no cache.
- **Exploit:**
  1. Add one shippable item to a bag and keep the `sp_bag` cookie.
  2. Loop `POST /checkout/ship-quote {"zip":"10001","state":"NY"}` with many ZIPs, in parallel.
- **Impact:**
  - Thousands of Shippo shipment objects on Lody's account.
  - Shippo's API rate limit is used up, so `placeOrder` gets `null` from the live rater and refuses every shipped order with `NO_LIVE_RATE` (`service.ts:262-267`): a shipping-checkout outage.
  - Extra Worker CPU.
- **Fix:**
  - Use `isRateLimited("shipQuote")` in the route.
  - Cache live quotes by (box, weight, ZIP) for 10–30 minutes, so the same ZIP doesn't call Shippo twice.
  - Optionally require a verified checkout nonce.

### M3 Medium: checkout as a card-testing oracle (Suspected)

- **Where:** `app/(frontend)/cart/actions.ts:44-58` (`submitOrder`, 6/min per IP, no challenge). `src/lib/checkout/service.ts:336-342` accepts any `clv_…` token. `src/lib/payments/clover.ts:241-283` POSTs a real Clover order, then `/pay`, and declines come back to the attacker as distinct messages (`declineMessage`, `clover.ts:313-328`: expired, CVC, number).
- **Exploit:**
  1. Put the cheapest item in a bag.
  2. Tokenize stolen card numbers with the public Clover key: it is in the page (`provider.browser.publicKey`), as with any Clover iframe integration.
  3. Submit `submitOrder` from rotating IPs. The decline reason tells which cards are live.
- **Impact:**
  - Clover risk holds or account termination.
  - Per-attempt fees and chargebacks on successful small charges.
  - Junk "created" orders on Lody's Clover account. Each bogus attempt also writes a failed order row (`SP-…`), so the number sequence grows.
- **Fix:**
  - Add Turnstile on the checkout and reserve submit.
  - Cap failed payment attempts per bag token, per customer email and per IP per day (for example 3, then refuse for 24 h).
  - Return one generic decline message.
  - Alert staff on a spike in declines.
- **Why Suspected:** it depends on how much velocity filtering Clover itself applies.

### M4 Medium: next 16.3.6 advisories (Suspected reachable)

- **Where:** `package.json` → `next@16.3.6`. `npm audit` lists critical GHSA-3w37-wq28-93x7, GHSA-4jqv-mc3x-m676, GHSA-39w2-rjm5-chcv and GHSA-f87g-xv8r-7p7x (16.0.0–16.4.4).
- **Reachability:**
  - The SSG/ISR cache poisoning one targets self-hosted apps. OpenNext on Workers is self-hosted from Next's point of view, and the site has static marketing and SEO pages.
  - The app uses no draft mode or `use cache`, and has no `opengraph-image` routes. So the other three are probably not reachable.
- **Fix:** upgrade `next` to ≥16.4.5 and `@opennextjs/cloudflare` to match. Then run the preview build and smoke tests (on a machine with more RAM).

### L1 Low: staff reset-by-email skips the password policy; no `serverURL` (Confirmed / Suspected)

- **Where:** Payload `node_modules/payload/dist/auth/operations/resetPassword.js:56-84`. It hashes the new password, then calls `beforeValidate` with `data: user`, which has no `password` key. So `enforcePasswordPolicy` (`collections/Users.ts:47-52`) returns early.
- **Why it matters now:** A23 said email wasn't connected. Since D64, `/api/users/forgot-password` really sends.
- **Exploit:** a staff member resets to `abc` via the emailed link. Payload accepts 3+ characters.
- **Link (Suspected):** `payload.config.ts` sets no `serverURL`. `getRequestOrigin` builds the link only from a Host listed in the CSRF list, with the request's protocol. Behind Cloudflare the Worker sees `http:` (see the `next.config.ts` comment), so the origin `http://shoplodelicious.com` is not in the allowlist. The email link then falls back to a relative `/admin/reset/<token>`, which is broken.
- **Fix:**
  - Set `serverURL: "https://shoplodelicious.com"` from env.
  - Enforce the policy in a `beforeOperation` hook on `resetPassword` (check `args.data.password`), or with a custom endpoint.

### L2 Low: order alert email is public (Confirmed)

- **Where:** `globals/StoreSettings.ts:21` (`read: anyone`) with `notificationEmail` at `:83`, which has no field `access.read`.
- **Exploit:** `GET /api/globals/store-settings` returns the staff alert inbox.
- **Impact:** a target for phishing, and combines with M1.
- **Fix:** `access: { read: isStaff }` on `notificationEmail`. The storefront reads with `overrideAccess` anyway.

### L3 Low: members can be squatted, farmed and locked (Confirmed)

- **Where:** `src/lib/rewards/members.ts:91-118` (join with no email verification) and `:134-143` (5 failures lock the account for 15 min, by address only).
- **Exploit:**
  1. Register a victim's email: they can only get in through a password reset.
  2. If `welcomePoints` ever reaches a reward's `pointsRequired`, every throwaway address is a free discount.
  3. Send 5 wrong passwords every 15 minutes, from any IP within 10/min, to keep a member locked out.
- **Fix:**
  - Verify the email before welcome points and before the first redeem.
  - Count failures per address and IP, or use a CAPTCHA after 3, instead of a hard lock.

### L4 Low: postage spend by any role; double label purchase (Confirmed)

- **Where:** `src/lib/shipping/label-endpoints.ts:43` allows all `ROLES`, including fulfillment. The "already bought" check (`:54`) is a read. The write happens after Shippo answers (`:123`).
- **Exploit:**
  - A fulfillment account (or a stolen one) buys the most expensive overnight rate with a 108 in / 150 lb parcel.
  - Two concurrent `buy-label` POSTs both pass the check and buy two labels.
- **Fix:**
  - Allow buying to owner/manager only, or cap it at the checkout-charged shipping plus a margin.
  - Claim the purchase with a conditional update before calling Shippo.

### L5 Low: `updateBagLine` is not rate limited (Confirmed)

- **Where:** `app/(frontend)/cart/actions.ts:34-41`. Each call loads products and writes the cart.
- **Fix:** `if (await isRateLimited("addToBag")) return;`

### L6 Low: no CSP (Confirmed)

- **Where:** `src/lib/security.ts:17-50` has no `Content-Security-Policy`.
- **Context:** React escaping and the validated colours and links keep XSS out today. A CSP is the backstop for checkout pages that load Clover's SDK.
- **Fix:** start in report-only mode with:
  - `script-src 'self' https://checkout.clover.com 'unsafe-inline'` (Next inline bootstrap; move to nonces later)
  - `frame-src https://checkout.clover.com`
  - `frame-ancestors 'self'`

### L7 Low: dashboard revenue visible to fulfillment (Confirmed)

- **Where:** `app/(dashboard)/dashboard/page.tsx:14` only checks `user` exists. `src/access/roles.ts` says fulfillment never sees prices or refunds.
- **Fix:** `if (!canManageCommerce(user)) redirect("/admin")`, or hide the money tiles from that role.

### L8 Low: other dependency advisories (Confirmed present, low reachability)

- `sharp@0.34.5` (libvips, libheif, librsvg CVEs). Not loaded in the Worker (`src/platform/cloudflare.ts:114-118`). It runs only in `scripts/media-webp.ts` and on the Node host on staff uploads.
- `undici@7.29` via `payload@3.90.2`. On Workers, global `fetch` is native.
- `happy-dom@20` via `@lexical/headless`. The app never converts untrusted HTML.
- `fast-uri` via `ajv`.
- **Fix:** bump Payload to ≥3.91 when upgrading Next, and sharp to 0.35.5.

## Checked and found clean

**Access control**
- Every collection and global `access` (Orders, Reservations, Inquiries, Products, Categories, Stock*, Members, RewardEntries, RewardAdjustments, Media, Reviews, ProductReviews, TaxClasses, Users, AuditLog, Outbox, SyncJobs, SourceRecords, Carts, and all 10 globals):
  - anonymous REST reads only StoreSettings, HomePage, EventSettings, GiftBuilderSettings, Reviews and approved Media;
  - Carts are fully closed;
  - members are not a Payload auth collection;
  - frozen snapshot fields can't be updated;
  - `paymentStatus`, `stockStatus` and amounts are commerce-only;
  - roles are owner-only;
  - users read/update self only.
- `overrideAccess: true` reads state their own `where` (published, not hidden, approved reviews).
- Members' secret fields are `read/update/create: false`. The balance is pinned to the ledger.

**Private links and auth**
- Order and reservation links: an HMAC-SHA256 token under `PAYLOAD_SECRET` (`src/lib/checkout/order.ts:56-59`), stored as SHA-256, looked up by number plus hash. SP-/SPR- enumeration gets nothing without the token. `no-referrer` is set on those pages.
- `sp_member` session: HMAC with a purpose label, version-revocable, timing-safe, httpOnly, Lax, Secure in production.
- Member reset token: 32 random bytes, hashed, 1 h, single use.
- Sign-in: decoy hash against timing enumeration.
- `next` redirect: allowlisted.

**Server actions, cron and admin routes**
- Server actions use a signed per-form nonce (A11). The member always comes from the cookie, never the form.
- Cron `/ops/cron/[job]`: HMAC key, timing-safe, 404 without a secret.
- `/ops/system-check`: owner/manager only. `/healthz`: no data.

**Money**
- Bag lines are re-priced from the database; quantities are clamped to 1–20, and NaN becomes 1.
- Basket requests are merged and validated (A01 still fixed), and components are built from merged lines.
- Deposit: a retry charges the stored `depositCents`.
- Live shipping and tax are recomputed in `placeOrder` and `reserveBasket`. `expectedCents` is only a mismatch guard.
- Ship-to tax: an unlisted state is taxed like pickup (`ship-tax.ts`, `taxBasisFor`), so choosing another state does not avoid MA tax.
- Rewards: the discount ≤ the subtotal; redemption is atomic, guarded against going below zero, and posted before the charge; two tabs can't spend the same points.
- Charging: an idempotency key per attempt; `unknown` blocks new charges for that bag; Clover's order total is checked against ours before `/pay`.
- Two tabs from one bag can oversell one unit, but the paid order is flagged `needs_attention` by design.

**Injection**
- JSON-LD escapes `<` (`src/lib/seo/index.ts:108`).
- The only `dangerouslySetInnerHTML` is JSON-LD.
- Email templates escape every value, only render `https?` links, use validated `#rrggbb` colours, and strip control characters from subjects and addresses.
- Storefront links (DoorDash, promo, Google) are validated.
- Brand colour in `<style>` is validated.
- Raw SQL interpolates only code constants; values are bound.
- `csv.ts` is a parser only; there are no CSV exports.

**Secrets and config**
- `scripts/cf-strip-env.mjs` empties `next-env.mjs` and fails the build otherwise.
- No real tokens or `.env` in git history (regex sweep for Shippo, Clover, `PAYLOAD_SECRET` and PEM).
- No `process.env` in client components; the only `NEXT_PUBLIC_` variable is the site URL.
- `wrangler.jsonc` vars are non-secret.
- `APP_ENV` is an allowlist. The test provider, `PREVIEW_ASSUME_STOCK`, the fake Clover adapter and sandbox keys are all refused on production.
- The CSRF allowlist is on and GraphQL is off.
- Logs redact Clover and Shippo tokens and customer addresses.

**Integrations**
- Clover and Shippo hosts are hard-coded (no SSRF). Shippo's `label_url` must be https, and a bought rate must belong to the order's shipment.
- No webhooks exist.
- Media:
  - anonymous users get approved photos only, also through R2;
  - JPEG/PNG/WebP/AVIF only (no SVG), 15 MB and 64 MP caps;
  - `media-webp.ts` is a local staff script with no shell calls.

**Abuse**
- Every public server action except `updateBagLine` is rate limited through the Cloudflare bindings.
- Reviews: pending until approved, honeypot, no links, 5/min.

## Not covered

- Runtime behaviour on Workers (actual Host/protocol seen by Payload, binding limits).
- Clover's idempotency semantics when the same key arrives with a new card token.
- Payload's magic-byte upload check at runtime.
- No tests were run (memory). The live site is the other worker's half.
