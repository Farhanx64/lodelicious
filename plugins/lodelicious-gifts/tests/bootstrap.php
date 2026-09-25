<?php
/**
 * Unit-test bootstrap. Domain code has no WordPress dependency, so no WordPress is loaded.
 *
 * @package Lodelicious\Gifts
 */

require_once dirname( __DIR__ ) . '/vendor/autoload.php';
require_once dirname( __DIR__ ) . '/src/autoload.php';

define( 'LDL_REPO_ROOT', dirname( __DIR__, 3 ) );
