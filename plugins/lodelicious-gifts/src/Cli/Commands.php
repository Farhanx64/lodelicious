<?php
/**
 * WP-CLI commands.
 *
 * @package Lodelicious\Gifts
 */

namespace Lodelicious\Gifts\Cli;

use Lodelicious\Gifts\Domain\SystemCheck;
use Lodelicious\Gifts\Infrastructure\Schema;
use WP_CLI;

/**
 * Operational commands for Lodelicious Gifts & Sweets.
 */
final class Commands {

	/**
	 * Check PHP settings and plugin schema for this (CLI/cron) context.
	 *
	 * ## EXAMPLES
	 *
	 *     wp lodelicious doctor
	 *
	 * @param string[] $args       Positional arguments.
	 * @param string[] $assoc_args Named arguments.
	 */
	public function doctor( array $args, array $assoc_args ): void {
		$results   = SystemCheck::evaluate( SystemCheck::currentEnvironment() );
		$results[] = array(
			'check'    => 'plugin schema',
			'expected' => (string) Schema::VERSION,
			'actual'   => (string) get_option( Schema::OPTION_KEY, 0 ),
			'ok'       => (int) get_option( Schema::OPTION_KEY, 0 ) === Schema::VERSION,
		);
		$rows = array_map(
			static fn( array $r ): array => array_merge( $r, array( 'ok' => $r['ok'] ? 'pass' : 'FAIL' ) ),
			$results
		);
		WP_CLI\Utils\format_items( 'table', $rows, array( 'check', 'expected', 'actual', 'ok' ) );

		$failed = count( array_filter( $results, static fn( array $r ): bool => ! $r['ok'] ) );
		if ( $failed > 0 ) {
			WP_CLI::error( sprintf( '%d check(s) failed.', $failed ) );
		}
		WP_CLI::success( 'All checks passed.' );
	}
}
