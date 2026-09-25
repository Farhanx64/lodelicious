<?php
/**
 * PSR-4 autoloader for Lodelicious\Gifts.
 *
 * The plugin ships without a vendor directory so the shared host never needs Composer.
 *
 * @package Lodelicious\Gifts
 */

spl_autoload_register(
	static function ( string $class ): void {
		$prefix = 'Lodelicious\\Gifts\\';
		if ( 0 !== strncmp( $class, $prefix, strlen( $prefix ) ) ) {
			return;
		}
		$path = __DIR__ . '/' . str_replace( '\\', '/', substr( $class, strlen( $prefix ) ) ) . '.php';
		if ( is_file( $path ) ) {
			require $path;
		}
	}
);
