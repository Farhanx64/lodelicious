<?php
/**
 * Runtime requirement checks (PRD INF 01).
 *
 * @package Lodelicious\Gifts
 */

namespace Lodelicious\Gifts\Domain;

/**
 * Compares effective PHP settings with the production requirements. Web and CLI/cron runs load
 * different php.ini files on cPanel, so callers check each context separately.
 */
final class SystemCheck {

	public const MIN_PHP             = '8.1.0';
	public const MEMORY_LIMIT_BYTES  = 512 * 1024 * 1024;
	public const MAX_EXECUTION_SECS  = 300;
	public const REQUIRED_EXTENSIONS = array( 'mysqli', 'mbstring', 'intl', 'curl', 'json', 'openssl' );

	/**
	 * Convert php.ini shorthand ("512M", "1G", "-1") to bytes. -1 means unlimited.
	 */
	public static function toBytes( string $value ): int {
		$value = trim( $value );
		if ( '' === $value || '-1' === $value ) {
			return -1;
		}
		$unit   = strtolower( substr( $value, -1 ) );
		$number = (int) $value;
		return match ( $unit ) {
			'g' => $number * 1024 * 1024 * 1024,
			'm' => $number * 1024 * 1024,
			'k' => $number * 1024,
			default => $number,
		};
	}

	/**
	 * `memory_limit` is the value configured in php.ini (what cPanel's PHP selector writes).
	 * `memory_limit_effective`, when given, is the runtime value: WP-CLI raises it to -1 after
	 * startup, so a cron job's effective limit differs from its configured one. Background jobs
	 * enforce their own memory checkpoint and never rely on either.
	 *
	 * @param array{php_version:string, memory_limit:string, memory_limit_effective?:string, max_execution_time:string, extensions:string[], sapi?:string} $env
	 * @return list<array{check:string, expected:string, actual:string, ok:bool}>
	 */
	public static function evaluate( array $env ): array {
		$memory = self::toBytes( $env['memory_limit'] );
		$time   = (int) $env['max_execution_time'];

		$results = array(
			array(
				'check'    => 'PHP version',
				'expected' => '>= ' . self::MIN_PHP,
				'actual'   => $env['php_version'],
				'ok'       => version_compare( $env['php_version'], self::MIN_PHP, '>=' ),
			),
			array(
				'check'    => 'memory_limit',
				'expected' => '512M',
				'actual'   => $env['memory_limit'],
				'ok'       => self::MEMORY_LIMIT_BYTES === $memory,
			),
		);

		if ( isset( $env['memory_limit_effective'] ) && $env['memory_limit_effective'] !== $env['memory_limit'] ) {
			$effective = self::toBytes( $env['memory_limit_effective'] );
			$results[] = array(
				'check'    => 'memory_limit (effective)',
				'expected' => '512M, or -1 when raised by WP-CLI',
				'actual'   => $env['memory_limit_effective'],
				'ok'       => self::MEMORY_LIMIT_BYTES === $effective || ( -1 === $effective && 'cli' === ( $env['sapi'] ?? '' ) ),
			);
		}

		array_push(
			$results,
			array(
				'check'    => 'max_execution_time',
				'expected' => (string) self::MAX_EXECUTION_SECS,
				// 0 is unlimited, which the PHP CLI uses by default; production cron must still
				// checkpoint at the job-level budget, so unlimited is reported but accepted.
				'actual'   => $env['max_execution_time'],
				'ok'       => self::MAX_EXECUTION_SECS === $time || 0 === $time,
			)
		);

		foreach ( self::REQUIRED_EXTENSIONS as $extension ) {
			$loaded    = in_array( $extension, $env['extensions'], true );
			$results[] = array(
				'check'    => 'extension ' . $extension,
				'expected' => 'loaded',
				'actual'   => $loaded ? 'loaded' : 'missing',
				'ok'       => $loaded,
			);
		}

		return $results;
	}

	/**
	 * Snapshot of the current process.
	 *
	 * @return array{php_version:string, memory_limit:string, memory_limit_effective:string, max_execution_time:string, extensions:string[], sapi:string}
	 */
	public static function currentEnvironment(): array {
		$configured = get_cfg_var( 'memory_limit' );
		return array(
			'php_version'            => PHP_VERSION,
			'memory_limit'           => false === $configured ? (string) ini_get( 'memory_limit' ) : (string) $configured,
			'memory_limit_effective' => (string) ini_get( 'memory_limit' ),
			'max_execution_time'     => (string) ini_get( 'max_execution_time' ),
			'extensions'             => array_map( 'strtolower', get_loaded_extensions() ),
			'sapi'                   => PHP_SAPI,
		);
	}
}
