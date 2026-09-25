# Engineering decisions

Reversible choices made during implementation. Each notes what would change it.

## D1 — WordPress 7.1.2 + WooCommerce 11.1.2, pinned (2026-09-25)

Latest stable tags on 2026-09-25. Both require PHP ≥ 7.4 and MySQL ≥ 5.5.5; the plugin sets its own
floor at PHP 8.1 (readonly properties, enums, `match`). Namecheap's PHP selector must be set to
8.1+ (8.3 preferred). Revisit: before launch, re-check for security releases and bump the pins.

## D2 — Custom plugin + classic theme, no paid extensions

Business rules live in `plugins/lodelicious-gifts`; the theme is presentation only. Domain classes
(`src/Domain`) do not call WordPress, so rules are unit-tested without a database. No paid
WooCommerce extension is assumed. Classic PHP templates (not a block theme) keep markup
predictable for the builder UI and accessibility work.

## D3 — Plugin ships without Composer vendor code

A small PSR-4 autoloader (`src/autoload.php`) means the host never runs Composer. Composer is dev-only
(PHPUnit). Revisit if a runtime library becomes necessary; then commit a production `vendor/`
built with `--no-dev`.

## D4 — Custom tables for audit log and jobs, versioned with dbDelta

`wp_ldl_audit_log` (append-only commercial changes, OPS 03) and `wp_ldl_jobs` (lock + checkpoint per
restartable job, INF 03/04). Schema version in option `ldl_schema_version`; upgrades run on
`plugins_loaded` when the stored version is older.

## D5 — Configured vs effective PHP memory limit

WP-CLI raises `memory_limit` to `-1` after startup, so cron jobs run through WP-CLI report an
effective limit that differs from php.ini. `wp lodelicious doctor` checks the configured value
(`get_cfg_var`) against 512M and shows the effective value separately. Background jobs will enforce
their own 384 MB / 60 s checkpoint regardless (PRD INF 04).

## D6 — Local preview without Docker

This build environment has no Docker daemon and blocks wordpress.org. Setup fetches WordPress from
its official GitHub mirror and WooCommerce from its GitHub release asset, and runs MariaDB from
`.local/`. PHP's built-in server stands in for LiteSpeed/Apache locally; production uses the host's
web server and `.htaccess` rewrites.

## D7 — Tax off until configured

`woocommerce_calc_taxes` is `no` locally. "Use Massachusetts settings" is not a numeric
configuration (PRD). Checkout must not go live until owner-approved tax classes are entered.

## D8 — Typography

Headings use Cormorant Garamond with Georgia/Palatino fallbacks; body uses Source Sans 3 with system
fallbacks. Fonts are not loaded yet; when added they will be self-hosted (no third-party font
requests from the storefront). Revisit if Lody's logo files specify brand typefaces.
