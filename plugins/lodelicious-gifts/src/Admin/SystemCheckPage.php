<?php
/**
 * Admin screen showing effective web-request PHP settings.
 *
 * @package Lodelicious\Gifts
 */

namespace Lodelicious\Gifts\Admin;

use Lodelicious\Gifts\Domain\SystemCheck;

/**
 * Tools → Lodelicious system check. Shows values for the web SAPI; `wp lodelicious doctor`
 * reports the CLI/cron values, which cPanel configures separately.
 */
final class SystemCheckPage {

	public static function register(): void {
		add_action(
			'admin_menu',
			static function (): void {
				add_management_page(
					__( 'Lodelicious system check', 'lodelicious-gifts' ),
					__( 'Lodelicious system check', 'lodelicious-gifts' ),
					'manage_options',
					'ldl-system-check',
					array( self::class, 'render' )
				);
			}
		);
	}

	public static function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to view this page.', 'lodelicious-gifts' ) );
		}
		$results = SystemCheck::evaluate( SystemCheck::currentEnvironment() );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Lodelicious system check (web requests)', 'lodelicious-gifts' ); ?></h1>
			<p><?php esc_html_e( 'Scheduled tasks use a separate PHP configuration. Run "wp lodelicious doctor" from cron or SSH to check it.', 'lodelicious-gifts' ); ?></p>
			<table class="widefat striped">
				<thead><tr>
					<th scope="col"><?php esc_html_e( 'Check', 'lodelicious-gifts' ); ?></th>
					<th scope="col"><?php esc_html_e( 'Required', 'lodelicious-gifts' ); ?></th>
					<th scope="col"><?php esc_html_e( 'Actual', 'lodelicious-gifts' ); ?></th>
					<th scope="col"><?php esc_html_e( 'Result', 'lodelicious-gifts' ); ?></th>
				</tr></thead>
				<tbody>
				<?php foreach ( $results as $row ) : ?>
					<tr>
						<td><?php echo esc_html( $row['check'] ); ?></td>
						<td><?php echo esc_html( $row['expected'] ); ?></td>
						<td><?php echo esc_html( $row['actual'] ); ?></td>
						<td><?php echo $row['ok'] ? esc_html__( 'Pass', 'lodelicious-gifts' ) : '<strong>' . esc_html__( 'Fail', 'lodelicious-gifts' ) . '</strong>'; ?></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		</div>
		<?php
	}
}
