#!/usr/bin/env bash
# Build a local WordPress + WooCommerce preview in .local/ with the Lodelicious plugin and theme
# symlinked in. Idempotent: re-running skips finished steps. Nothing here touches production.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ -f .env ] || cp .env.example .env
set -a; . ./.env; set +a

LOCAL="$ROOT/.local"
WP_DIR="$LOCAL/wordpress"
CACHE="$LOCAL/cache"
DB_DIR="$LOCAL/mysql"
mkdir -p "$LOCAL/bin" "$CACHE" "$LOCAL/logs"

WP="$LOCAL/bin/wp"
wp() { php -d memory_limit=512M "$WP" --path="$WP_DIR" --allow-root "$@"; }

echo "==> WP-CLI $LDL_WPCLI_VERSION"
if [ ! -f "$WP" ]; then
	curl -fsSL -o "$WP" "https://github.com/wp-cli/wp-cli/releases/download/v$LDL_WPCLI_VERSION/wp-cli-$LDL_WPCLI_VERSION.phar"
	chmod +x "$WP"
fi

echo "==> WordPress $LDL_WP_VERSION"
if [ ! -f "$WP_DIR/wp-includes/version.php" ]; then
	# wordpress.org may be blocked by egress policy; the GitHub mirror carries the same release tags.
	git clone -q --depth 1 --branch "$LDL_WP_VERSION" https://github.com/WordPress/WordPress "$WP_DIR"
	rm -rf "$WP_DIR/.git"
fi

echo "==> WooCommerce $LDL_WC_VERSION"
if [ ! -f "$WP_DIR/wp-content/plugins/woocommerce/woocommerce.php" ]; then
	curl -fsSL -o "$CACHE/woocommerce-$LDL_WC_VERSION.zip" \
		"https://github.com/woocommerce/woocommerce/releases/download/$LDL_WC_VERSION/woocommerce.zip"
	unzip -q -o "$CACHE/woocommerce-$LDL_WC_VERSION.zip" -d "$WP_DIR/wp-content/plugins"
fi

echo "==> Link plugin and theme"
ln -sfn "$ROOT/plugins/lodelicious-gifts" "$WP_DIR/wp-content/plugins/lodelicious-gifts"
ln -sfn "$ROOT/themes/lodelicious" "$WP_DIR/wp-content/themes/lodelicious"

echo "==> MariaDB (local, port $LDL_DB_PORT)"
"$ROOT/bin/db.sh" start
mariadb --socket="$LOCAL/mysql.sock" -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`$LDL_DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$LDL_DB_USER'@'127.0.0.1' IDENTIFIED BY '$LDL_DB_PASSWORD';
CREATE USER IF NOT EXISTS '$LDL_DB_USER'@'localhost' IDENTIFIED BY '$LDL_DB_PASSWORD';
GRANT ALL ON \`$LDL_DB_NAME\`.* TO '$LDL_DB_USER'@'127.0.0.1';
GRANT ALL ON \`$LDL_DB_NAME\`.* TO '$LDL_DB_USER'@'localhost';
SQL

echo "==> wp-config.php"
if [ ! -f "$WP_DIR/wp-config.php" ]; then
	wp config create --dbname="$LDL_DB_NAME" --dbuser="$LDL_DB_USER" --dbpass="$LDL_DB_PASSWORD" \
		--dbhost="127.0.0.1:$LDL_DB_PORT" --skip-check --quiet
	wp config set WP_ENVIRONMENT_TYPE local --quiet
	wp config set WP_DEBUG true --raw --quiet
	wp config set WP_DEBUG_LOG "$LOCAL/logs/debug.log" --quiet
	wp config set WP_DEBUG_DISPLAY false --raw --quiet
	wp config set DISALLOW_FILE_EDIT true --raw --quiet
	wp config set AUTOMATIC_UPDATER_DISABLED true --raw --quiet
fi

echo "==> Install site"
if ! wp core is-installed 2>/dev/null; then
	PASS="${LDL_ADMIN_PASSWORD:-$(php -r 'echo bin2hex(random_bytes(12));')}"
	wp core install --url="$LDL_SITE_URL" --title="Lodelicious Gifts & Sweets" \
		--admin_user="$LDL_ADMIN_USER" --admin_email="$LDL_ADMIN_EMAIL" --admin_password="$PASS" --skip-email --quiet
	[ -n "${LDL_ADMIN_PASSWORD:-}" ] || echo "    Admin password (shown once): $PASS"
	# Remove WordPress sample content so it never appears on the storefront.
	wp post delete 1 2 --force --quiet 2>/dev/null || true
fi

wp option update timezone_string America/New_York --quiet
wp option update blogdescription "Gifts & sweets in Plymouth, Massachusetts" --quiet
wp rewrite structure '/%postname%/' --quiet

echo "==> Activate WooCommerce, plugin, theme"
wp plugin activate woocommerce lodelicious-gifts --quiet
wp theme activate lodelicious --quiet
wp option update woocommerce_currency USD --quiet
wp option update woocommerce_default_country US:MA --quiet
wp option update woocommerce_store_address "24 Manomet Point Rd." --quiet
wp option update woocommerce_store_city Plymouth --quiet
wp option update woocommerce_store_postcode 02360 --quiet
wp option update woocommerce_onboarding_profile '{"skipped":true}' --format=json --quiet
# Tax stays off until owner-approved Massachusetts tax classes are supplied (PRD: Policies and taxes).
wp option update woocommerce_calc_taxes no --quiet

echo "==> Checks"
php -d memory_limit=512M -d max_execution_time=300 "$WP" --path="$WP_DIR" --allow-root lodelicious doctor

echo
echo "Done. Start the preview with: bin/serve.sh  (then open $LDL_SITE_URL)"
