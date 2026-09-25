<?php
/**
 * Theme setup. Presentation only: business rules belong in the Lodelicious Gift Builder plugin.
 *
 * @package Lodelicious
 */

defined( 'ABSPATH' ) || exit;

define( 'LDL_THEME_VERSION', '0.1.0' );

require_once __DIR__ . '/inc/store-info.php';

add_action(
	'after_setup_theme',
	static function (): void {
		load_theme_textdomain( 'lodelicious', __DIR__ . '/languages' );
		add_theme_support( 'title-tag' );
		add_theme_support( 'post-thumbnails' );
		add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script', 'navigation-widgets' ) );
		add_theme_support( 'responsive-embeds' );
		add_theme_support( 'woocommerce' );
		add_theme_support( 'wc-product-gallery-zoom' );
		add_theme_support( 'wc-product-gallery-lightbox' );
		add_theme_support( 'wc-product-gallery-slider' );

		register_nav_menus(
			array(
				'primary' => __( 'Primary navigation', 'lodelicious' ),
				'footer'  => __( 'Footer navigation', 'lodelicious' ),
			)
		);
	}
);

add_action(
	'wp_enqueue_scripts',
	static function (): void {
		wp_enqueue_style( 'lodelicious', get_stylesheet_uri(), array(), LDL_THEME_VERSION );
	}
);

/**
 * True outside production. Staging shows a banner so placeholder content is never mistaken for
 * the live store.
 */
function ldl_is_staging(): bool {
	return 'production' !== wp_get_environment_type();
}
