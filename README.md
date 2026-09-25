# Lodelicious Gifts & Sweets — online store

Source for the souset-pink.com store: a WooCommerce site with a custom theme and a separate
gift-builder plugin, targeting Namecheap Stellar Business (cPanel, PHP 8.1+, MySQL/MariaDB).

Requirements come from `Lodelicious-Gifts-and-Sweets-PRD.docx` v2.0 (September 25, 2026). Current
progress, assumptions and open inputs are in [`STATUS.md`](STATUS.md); engineering decisions are in
[`docs/decisions.md`](docs/decisions.md).

## Layout

| Path | What it is | Deployed? |
| --- | --- | --- |
| `plugins/lodelicious-gifts/` | Gift rules, catalog reconciliation, inventory, operations. `src/Domain` is plain PHP with no WordPress dependency and is unit-tested. | Yes, as `wp-content/plugins/lodelicious-gifts` |
| `themes/lodelicious/` | Presentation only: templates, styles, store contact details. | Yes, as `wp-content/themes/lodelicious` |
| `data/source/` | Verbatim source observations (Clover, price screenshot, DoorDash, basket chart). Evidence, not approved prices. | No |
| `bin/` | Local preview scripts. | No |
| `docs/` | Decisions, screenshots, and later the deployment checklist and reconciliation report. | No |

WordPress core and WooCommerce are not committed; setup downloads the pinned releases.

## Local preview

Requirements: PHP 8.1+ (with mysqli, mbstring, intl, curl, openssl, zip), MariaDB 10.6+ binaries
(`mariadbd`, `mariadb-install-db`), git, curl, unzip. No Docker, no system database service: the
database runs from `.local/mysql` on port 3307.

```bash
cp .env.example .env        # optional; setup copies it if missing
bin/setup-local.sh          # downloads WP 7.1.2 + WooCommerce 11.1.2 + WP-CLI, installs, activates
bin/serve.sh                # http://localhost:8080 with memory_limit=512M, max_execution_time=300
bin/db.sh stop              # stop the local database
```

Setup prints a generated admin password once, or uses `LDL_ADMIN_PASSWORD` from `.env`. Reset
it with `.local/bin/wp --path=.local/wordpress --allow-root user reset-password admin --show-password`.

`wp-cli` shortcut: `php -d memory_limit=512M .local/bin/wp --path=.local/wordpress --allow-root <command>`

The local site is `WP_ENVIRONMENT_TYPE=local` and shows a staging banner on every page.

## Checks

```bash
cd plugins/lodelicious-gifts
composer install
vendor/bin/phpunit          # unit tests (no WordPress needed)
composer lint               # php -l on all plugin files
```

Runtime settings: `wp lodelicious doctor` (CLI/cron context) and **Tools → Lodelicious system check**
in wp-admin (web context). cPanel configures these separately, so check both on the host.

## Rules this codebase follows

- Money is integer cents (`Domain\Money`). No floats in prices, budgets or packaging.
- Source prices (Clover, screenshot, DoorDash) are never website prices until approved.
- No secrets in the repository. Provider credentials go in `wp-config.php` on the host.
- Nothing here activates live payments, changes DNS, buys extensions or replaces the live site.
