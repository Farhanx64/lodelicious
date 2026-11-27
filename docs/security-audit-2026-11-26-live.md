# Live black-box security audit — shoplodelicious.com

- **Date:** 2026-11-26
- **Target:** https://shoplodelicious.com (live store, real Clover card payments)
- **Method:** External black-box, non-destructive. No orders/reservations/payments/accounts created, no forms submitted, no live data written. Throttled (≤ ~2 req/s), hand-picked paths only (no scanners). Admin login tested twice with a non-existent email (`nobody@example.invalid`). Source in the `Farhanx64/lodelicious` repo (branch `sec-live`) was read to aim tests.
- **Infra observed:** Cloudflare in front of a Node/Payload CMS origin (cPanel/Passenger). `server: cloudflare`, TLS by Google Trust Services.

## Verdict

The application layer is in good shape: tight Payload access control, hashed guest tokens with constant-time compare, server-authoritative pricing, GraphQL disabled, generic auth errors, no secrets in client bundles, no reflected XSS, no open redirect, no permissive CORS. **No Critical or High findings.**

The gaps are edge/transport hardening: no HTTP→HTTPS redirect, and missing CSP / Permissions-Policy headers. All findings are Medium or below.

---

## Findings (ranked)

### M1 — Medium — No HTTP→HTTPS redirect (cleartext served on port 80)

`http://shoplodelicious.com/` returns **200 with full page content over plaintext** instead of redirecting to HTTPS. HSTS is set on responses, which protects browsers that have already made one HTTPS visit, but a first-time visitor (or an HSTS-naive client) is served over cleartext and is exposed to an active man-in-the-middle who could strip TLS or inject content before the HSTS pin is set. For a store that takes card payments this is worth closing.

Request / response:
```
$ curl -sS -D - -o /dev/null http://shoplodelicious.com/
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Strict-Transport-Security: max-age=31536000
...   (no Location header, full page body returned)
```

**Impact:** TLS-stripping / content injection on the first/plaintext request; weakens the guarantee HSTS is meant to give.

**Fix:** Turn on Cloudflare **"Always Use HTTPS"** (SSL/TLS → Edge Certificates) so port 80 issues a 301/308 to `https://`. Optionally add `includeSubDomains; preload` to HSTS once you are confident all subdomains are HTTPS-only (the code comment in `src/lib/security.ts` notes this is intentionally held pending owner approval).

---

### M2 — Medium — No Content-Security-Policy header (site and /admin)

No `Content-Security-Policy` header is sent on any page, including the storefront, checkout, and `/admin`. `securityHeaders()` in `src/lib/security.ts` sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and HSTS, but no CSP.

```
$ curl -sS -D - -o /dev/null https://shoplodelicious.com/ | grep -i content-security
   (no output)
$ curl -sS -D - -o /dev/null https://shoplodelicious.com/admin | grep -i content-security
   (no output)
```

**Impact:** Defense-in-depth gap. No reflected XSS was found, but with no CSP any future injection (or a compromised third-party script) executes with no script-source restriction. On a page that handles card entry (Clover), a CSP limiting `script-src` / `connect-src` / `frame-src` to the site and Clover domains materially reduces blast radius and is expected hygiene for payment pages.

**Fix:** Add a CSP to the `/:path*` rule in `securityHeaders()`. Start in `Content-Security-Policy-Report-Only` to tune, then enforce. Allow `self`, the Clover SDK/iframe origins actually used at checkout, and `_next` assets; avoid `unsafe-inline` for scripts where possible.

---

### L1 — Low — No Permissions-Policy header

No `Permissions-Policy` header is sent, so camera, microphone, geolocation, etc. are not explicitly disabled.

```
$ curl -sS -D - -o /dev/null https://shoplodelicious.com/ | grep -i permissions-policy
   (no output)
```

**Impact:** Minor defense-in-depth gap; a malicious injected/embedded script could request device permissions that the site never needs.

**Fix:** Add e.g. `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` (adjust `payment` if a browser Payment Request flow is ever used) to the global header rule.

---

### L2 — Low — Broken `www` → apex redirect for the bare root

`https://www.shoplodelicious.com/` (bare root) redirects to a **literal, unsubstituted placeholder**:

```
$ curl -sS -D - -o /dev/null https://www.shoplodelicious.com/
HTTP/2 308
location: https://shoplodelicious.com/:path*
```

Paths redirect correctly (`.../shop` → `https://shoplodelicious.com/shop`), so only the empty-path case emits `/:path*`. A visitor typing `www.shoplodelicious.com` lands on a broken URL.

**Impact:** Availability/UX, not a direct security issue — the apex root is unreachable via the `www` host.

**Fix:** In the redirect rule (Cloudflare redirect rule or Next `redirects()`), make the capture group match an empty path, or add an explicit `www/` → apex root rule. Verify `curl -I https://www.shoplodelicious.com/` lands on `https://shoplodelicious.com/`.

---

### I1 — Informational — Anonymous `/api/access` and public REST listings expose schema/metadata

- `GET /api/access` returns the anonymous permission/field map, revealing collection and field names (e.g. `media._objectKey`, `media.sourceFile`, `reviews`, `users`). It confirms anonymous has **read-only** on `media` and `reviews` and **no create/update/delete anywhere** — so it is a disclosure of structure, not of a write capability.
- `GET /api/media` and `GET /api/reviews` are fully listable anonymously with pagination, internal numeric IDs, timestamps, filenames and `_objectKey`. These are public product images and testimonials by design (`mediaRead` restricts anonymous to `approvedForLaunch == true`, verified below), so the content is intended to be public; only the volume of metadata is notable.

```
$ curl -sS https://shoplodelicious.com/api/access   # lists media/reviews/users field read perms; all create/update/delete null
$ curl -sS "https://shoplodelicious.com/api/media?limit=1"   # 200, approved media only
```

**Impact:** Low. Helps an attacker map the schema. No sensitive data or write path exposed.

**Fix (optional):** If not needed by the storefront, consider restricting `/api/access` and trimming the metadata fields returned to anonymous on `media`/`reviews`. Not required.

---

## Tested and found safe

**Transport / headers**
- Valid TLS cert (Google Trust Services `WE1`, notBefore 2026-11-11, notAfter 2027-02-09), `ssl_verify_result=0`.
- HSTS present on HTTPS (`max-age=31536000`; no `includeSubDomains`/`preload` — intentional per code comment).
- `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` on all pages; `/order/*` and `/reservation/*` send `Referrer-Policy: no-referrer` (protects the guest token in the URL).
- `cache-control: private, no-store` on dynamic/admin pages. No `X-Powered-By` (`poweredByHeader: false`).
- `www` → apex works for real paths (308); apex serves over HTTPS.

**Exposed files / info leaks**
- `/.env`, `/.git/HEAD`, `/.dev.vars` → **404**.
- JS source maps (`*.js.map`) → **404** (checked 3 chunks).
- Client bundles scanned (all `_next` chunks from home/shop/checkout/account/rewards): **no** secrets, API keys, Clover keys, SMTP creds, `PAYLOAD_SECRET`, `DATABASE_URI`, `NEXT_PUBLIC_*` values, or internal filesystem paths.
- `/healthz` → `{"status":"ok","db":"reachable"}` only (no user counts / versions, matches hardened code).
- `/ops/system-check` → **404** `{"error":"Not found"}` for anonymous (owner/manager-gated).
- Verbose errors: malformed REST query returns a controlled **400** (`"The following path cannot be queried: foo.bar"`), no stack trace or paths.
- `/.well-known/security.txt` → 404 (nice-to-have, not a vuln).

**Access control (anonymous)**
- `GET /api/orders` → **403**, `GET /api/members` → **403**. Products are staff-only (`read: isStaff`); not anonymously readable.
- No anonymous create/update/delete on any collection (per `/api/access` and config).
- Unapproved media cannot be listed: `?where[approvedForLaunch][equals]=false` → `docs:[], totalDocs:0` (the `mediaRead` filter is AND-ed and cannot be bypassed via `where`).

**Guest order/reservation links**
- `/order/SP-1001` (no token) → **404**; `/order/SP-1001?t=wrongtoken123` → **404**; `/reservation/SR-1001` → **404**.
- Tokens are SHA-256–hashed in the DB and compared constant-time (`tokenMatches` / `findByToken`); number pattern is validated; enumeration yields only 404s.

**GraphQL**
- `POST /api/graphql` → **404**; `/api/graphql-playground` → **404** (`graphQL: { disable: true }`).

**Injection / redirect / CORS / CSRF**
- 404 path with `<script>alert(1)</script>` → payload URL/entity-encoded in response, **no raw reflection**.
- `/shop?q="><script>...` → entity-encoded (`&quot;&gt;`), **no reflected XSS**.
- Open redirect: `next` param restricted to same-site relative paths (`^/(?![/\\])...`, rejects `//evil` and absolute URLs — `nextPath()` / join page).
- CORS: `Origin: https://evil.example` on `/api/media` (GET and OPTIONS preflight) returns **no `Access-Control-Allow-Origin`** and no `Access-Control-Allow-Credentials` → cross-origin browser reads blocked.
- Payload CSRF origin allowlist is wired from `NEXT_PUBLIC_SITE_URL` (`csrfOrigins`), protecting cookie-authenticated mutations.

**Admin / member auth**
- Admin login with `nobody@example.invalid` (2 attempts) → **401** generic `"The email or password provided is incorrect."` — **no user enumeration**. (Stopped at 2 attempts to stay within the ≤3 limit; did not confirm the exact admin lockout threshold live.)
- `/admin/create-first-user` renders but is guarded (users already exist → "already"/login message); not exploitable.
- Member sign-in (source): generic `SIGN_IN_FAILED`, server-side `isRateLimited("memberSignIn")`, and 5-attempt / 15-minute account lockout (`MAX_FAILED_SIGN_INS=5`, `LOCK_MINUTES=15`). Forgot-password always returns `RESET_SENT` (no enumeration).

**Price tampering (reasoned from source — see "couldn't test")**
- Checkout recomputes every price/tax server-side from the DB (`priceBag` → `priceCart`, re-reads products). The client submits only a cart token, a reward choice (validated against affordable options), and customer details — **never amounts**. The Clover charge uses the server-computed total: `chargeSafely(provider, { amountCents: order.totals.totalCents, ... })` (service.ts:505), where `order.totals.totalCents = priced.totalCents`. A tampered client price cannot change what is charged.

## Couldn't test safely (by scope)

- **Full checkout / payment path:** `/checkout` 307-redirects to `/cart` with an empty cart, and building a cart writes to live data (Carts collection) — out of scope. Price integrity assessed from source instead (see above). No Clover publishable key was reachable without a cart; it is expected to load only on the populated checkout page.
- **Authenticated admin/member behaviour:** requires real credentials and would write live data — not exercised.
- **Exact admin lockout threshold:** stopped at 2 login attempts (limit ≤3). Config sets no `maxLoginAttempts` on `Users`, so Payload's default applies; confirm the default (5 / 600s) is acceptable, or set it explicitly.
- **Unapproved media via direct file URL** (`/api/media/file/<name>`): the approved-only listing confirms the `mediaRead` filter, but no specific unapproved filename was known to fetch directly (listing it is exactly what the filter prevents).
