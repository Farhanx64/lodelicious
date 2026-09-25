<?php
/**
 * Router for PHP's built-in server: serve real files, send everything else to WordPress.
 * Local preview only; production uses Apache/LiteSpeed rewrites on Namecheap.
 */

$path = parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH );
$file = $_SERVER['DOCUMENT_ROOT'] . $path;

if ( '/' !== $path && is_file( $file ) ) {
	return false;
}
if ( is_dir( $file ) && is_file( rtrim( $file, '/' ) . '/index.php' ) ) {
	$_SERVER['SCRIPT_NAME'] = rtrim( $path, '/' ) . '/index.php';
	require rtrim( $file, '/' ) . '/index.php';
	return;
}

$_SERVER['SCRIPT_NAME'] = '/index.php';
require $_SERVER['DOCUMENT_ROOT'] . '/index.php';
