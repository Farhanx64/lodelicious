<?php
/**
 * Plugin Name:       Lodelicious Gift Builder
 * Description:       Gift rules, catalog reconciliation, inventory reservations and store operations for Lodelicious Gifts & Sweets.
 * Version:           0.1.0
 * Requires at least: 7.0
 * Requires PHP:      8.1
 * Requires Plugins:  woocommerce
 * Author:            Lodelicious Gifts & Sweets
 * License:           Proprietary
 * Text Domain:       lodelicious-gifts
 * Domain Path:       /languages
 *
 * @package Lodelicious\Gifts
 */

defined( 'ABSPATH' ) || exit;

define( 'LDL_GIFTS_VERSION', '0.1.0' );
define( 'LDL_GIFTS_FILE', __FILE__ );
define( 'LDL_GIFTS_DIR', __DIR__ );

require_once __DIR__ . '/src/autoload.php';

register_activation_hook( __FILE__, array( \Lodelicious\Gifts\Infrastructure\Schema::class, 'install' ) );

add_action( 'before_woocommerce_init', array( \Lodelicious\Gifts\Plugin::class, 'declare_woocommerce_compatibility' ) );
add_action( 'plugins_loaded', array( \Lodelicious\Gifts\Plugin::class, 'boot' ) );
