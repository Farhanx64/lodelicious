<?php
/**
 * Commercial change audit trail.
 *
 * @package Lodelicious\Gifts
 */

namespace Lodelicious\Gifts\Infrastructure;

/**
 * Append-only record of price, rule, stock and policy changes. Rows are never updated.
 */
final class AuditLog {

	/**
	 * @param mixed $before Previous value (JSON-encoded).
	 * @param mixed $after  New value (JSON-encoded).
	 */
	public static function record( string $action, string $object_type, string $object_id, $before, $after ): void {
		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'ldl_audit_log',
			array(
				'occurred_at' => gmdate( 'Y-m-d H:i:s' ),
				'user_id'     => get_current_user_id(),
				'action'      => $action,
				'object_type' => $object_type,
				'object_id'   => $object_id,
				'before_json' => null === $before ? null : wp_json_encode( $before ),
				'after_json'  => null === $after ? null : wp_json_encode( $after ),
			),
			array( '%s', '%d', '%s', '%s', '%s', '%s', '%s' )
		);
	}
}
