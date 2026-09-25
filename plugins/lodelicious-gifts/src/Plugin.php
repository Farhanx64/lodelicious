<?php
/**
 * Plugin bootstrap.
 *
 * @package Lodelicious\Gifts
 */

namespace Lodelicious\Gifts;

use Lodelicious\Gifts\Admin\SystemCheckPage;
use Lodelicious\Gifts\Cli\Commands;
use Lodelicious\Gifts\Infrastructure\Schema;

/**
 * Wires WordPress hooks to the plugin's modules. Domain classes never call WordPress directly.
 */
final class Plugin {

	public static function boot(): void {
		if ( ! class_exists( 'WooCommerce' ) ) {
			add_action( 'admin_notices', array( self::class, 'missing_woocommerce_notice' ) );
			return;
		}

		Schema::maybeUpgrade();

		if ( is_admin() ) {
			SystemCheckPage::register();
		}

		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			\WP_CLI::add_command( 'lodelicious', Commands::class );
		}
	}

	/**
	 * Declare compatibility with WooCommerce custom order tables and the block cart/checkout.
	 */
	public static function declare_woocommerce_compatibility(): void {
		if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', LDL_GIFTS_FILE, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', LDL_GIFTS_FILE, true );
		}
	}

	public static function missing_woocommerce_notice(): void {
		echo '<div class="notice notice-error"><p>' . esc_html__( 'Lodelicious Gift Builder requires WooCommerce to be active.', 'lodelicious-gifts' ) . '</p></div>';
	}
}
