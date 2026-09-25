<?php
/**
 * Site header.
 *
 * @package Lodelicious
 */

defined( 'ABSPATH' ) || exit;
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="skip-link" href="#main"><?php esc_html_e( 'Skip to content', 'lodelicious' ); ?></a>

<?php if ( ldl_is_staging() ) : ?>
	<div class="ldl-staging-banner" role="note">
		<?php esc_html_e( 'Staging preview — prices, stock and photos are not final. Orders are not fulfilled.', 'lodelicious' ); ?>
	</div>
<?php endif; ?>

<header class="site-header">
	<div class="ldl-wrap site-header__inner">
		<p class="site-title">
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home">
				Lodelicious
				<small><?php esc_html_e( 'Gifts & Sweets', 'lodelicious' ); ?></small>
			</a>
		</p>
		<nav class="site-nav" aria-label="<?php esc_attr_e( 'Primary', 'lodelicious' ); ?>">
			<?php
			wp_nav_menu(
				array(
					'theme_location' => 'primary',
					'container'      => false,
					'fallback_cb'    => false,
					'depth'          => 1,
				)
			);
			?>
		</nav>
	</div>
</header>

<main id="main" class="site-main" tabindex="-1">
