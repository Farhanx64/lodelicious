<?php
/**
 * Versioned custom tables.
 *
 * @package Lodelicious\Gifts
 */

namespace Lodelicious\Gifts\Infrastructure;

/**
 * Creates and upgrades plugin tables with dbDelta. Each change bumps VERSION; install() is safe to
 * run repeatedly and is called on activation and whenever the stored version is older.
 */
final class Schema {

	public const VERSION    = 1;
	public const OPTION_KEY = 'ldl_schema_version';

	public static function install(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$p       = $wpdb->prefix;

		// Who changed which commercial setting, and when (OPS 03).
		dbDelta(
			"CREATE TABLE {$p}ldl_audit_log (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				occurred_at datetime NOT NULL,
				user_id bigint(20) unsigned NOT NULL DEFAULT 0,
				action varchar(64) NOT NULL,
				object_type varchar(64) NOT NULL,
				object_id varchar(64) NOT NULL DEFAULT '',
				before_json longtext NULL,
				after_json longtext NULL,
				PRIMARY KEY  (id),
				KEY object_lookup (object_type, object_id),
				KEY occurred_at (occurred_at)
			) $charset;"
		);

		// Restartable background jobs: one row per job with a lock and checkpoint (INF 03/04).
		dbDelta(
			"CREATE TABLE {$p}ldl_jobs (
				job_key varchar(64) NOT NULL,
				status varchar(20) NOT NULL DEFAULT 'idle',
				locked_until datetime NULL,
				lock_token char(32) NULL,
				checkpoint longtext NULL,
				last_success_at datetime NULL,
				last_error text NULL,
				attempts int(10) unsigned NOT NULL DEFAULT 0,
				updated_at datetime NOT NULL,
				PRIMARY KEY  (job_key)
			) $charset;"
		);

		update_option( self::OPTION_KEY, self::VERSION, false );
	}

	public static function maybeUpgrade(): void {
		if ( (int) get_option( self::OPTION_KEY, 0 ) < self::VERSION ) {
			self::install();
		}
	}
}
