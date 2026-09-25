<?php
/**
 * Site footer.
 *
 * @package Lodelicious
 */

defined( 'ABSPATH' ) || exit;

$ldl_store = ldl_store_info();
?>
</main>

<footer class="site-footer">
	<div class="ldl-wrap site-footer__grid">
		<section aria-labelledby="footer-visit">
			<h2 id="footer-visit"><?php esc_html_e( 'Visit the shop', 'lodelicious' ); ?></h2>
			<address>
				<?php echo esc_html( $ldl_store['name'] ); ?><br>
				<?php echo esc_html( $ldl_store['street'] ); ?><br>
				<?php echo esc_html( $ldl_store['locality'] ); ?>
			</address>
		</section>

		<section aria-labelledby="footer-hours">
			<h2 id="footer-hours"><?php echo esc_html( $ldl_store['hours_label'] ); ?></h2>
			<dl>
				<?php foreach ( $ldl_store['hours'] as $ldl_days => $ldl_time ) : ?>
					<dt><?php echo esc_html( $ldl_days ); ?></dt>
					<dd><?php echo esc_html( $ldl_time ); ?></dd>
				<?php endforeach; ?>
			</dl>
			<p>
				<?php
				/* translators: %s: list of closed holidays. */
				printf( esc_html__( 'Closed %s.', 'lodelicious' ), esc_html( implode( ', ', $ldl_store['closed'] ) ) );
				?>
			</p>
		</section>

		<section aria-labelledby="footer-contact">
			<h2 id="footer-contact"><?php esc_html_e( 'Contact', 'lodelicious' ); ?></h2>
			<p>
				<a href="tel:<?php echo esc_attr( $ldl_store['phone_e164'] ); ?>"><?php echo esc_html( $ldl_store['phone'] ); ?></a><br>
				<a href="mailto:<?php echo esc_attr( $ldl_store['email'] ); ?>"><?php echo esc_html( $ldl_store['email'] ); ?></a>
			</p>
			<nav aria-label="<?php esc_attr_e( 'Footer', 'lodelicious' ); ?>">
				<?php
				wp_nav_menu(
					array(
						'theme_location' => 'footer',
						'container'      => false,
						'fallback_cb'    => false,
						'depth'          => 1,
					)
				);
				?>
			</nav>
		</section>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
