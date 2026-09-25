<?php

namespace Lodelicious\Gifts\Tests\Unit;

use Lodelicious\Gifts\Domain\SystemCheck;
use PHPUnit\Framework\TestCase;

final class SystemCheckTest extends TestCase {

	public function testToBytes(): void {
		$this->assertSame( 536870912, SystemCheck::toBytes( '512M' ) );
		$this->assertSame( 1073741824, SystemCheck::toBytes( '1G' ) );
		$this->assertSame( 131072, SystemCheck::toBytes( '128k' ) );
		$this->assertSame( -1, SystemCheck::toBytes( '-1' ) );
	}

	public function testProductionSettingsPass(): void {
		$results = SystemCheck::evaluate( $this->env( '512M', '300' ) );
		$this->assertSame( array(), array_filter( $results, static fn( $r ) => ! $r['ok'] ) );
	}

	public function testSharedHostDefaultsFail(): void {
		$failed = $this->failedChecks( $this->env( '256M', '30' ) );
		$this->assertContains( 'memory_limit', $failed );
		$this->assertContains( 'max_execution_time', $failed );
	}

	public function testUnlimitedMemoryIsNotTheRequiredSetting(): void {
		// 512M is a deliberate per-script cap inside the 2 GB account limit, not a minimum.
		$this->assertContains( 'memory_limit', $this->failedChecks( $this->env( '-1', '300' ) ) );
	}

	public function testWpCliRaisedEffectiveLimitIsAcceptedOnlyOnCli(): void {
		$env                           = $this->env( '512M', '0' );
		$env['memory_limit_effective'] = '-1';
		$env['sapi']                   = 'cli';
		$this->assertSame( array(), $this->failedChecks( $env ) );

		$env['sapi'] = 'fpm-fcgi';
		$this->assertSame( array( 'memory_limit (effective)' ), $this->failedChecks( $env ) );
	}

	public function testEffectiveLimitLoweredAtRuntimeFails(): void {
		$env                           = $this->env( '512M', '300' );
		$env['memory_limit_effective'] = '256M';
		$env['sapi']                   = 'cli';
		$this->assertSame( array( 'memory_limit (effective)' ), $this->failedChecks( $env ) );
	}

	public function testOldPhpAndMissingExtensionFail(): void {
		$env                = $this->env( '512M', '300' );
		$env['php_version'] = '7.4.33';
		$env['extensions']  = array_diff( $env['extensions'], array( 'intl' ) );
		$failed             = $this->failedChecks( $env );
		$this->assertContains( 'PHP version', $failed );
		$this->assertContains( 'extension intl', $failed );
	}

	/**
	 * @return array{php_version:string, memory_limit:string, max_execution_time:string, extensions:string[]}
	 */
	private function env( string $memory, string $time ): array {
		return array(
			'php_version'        => '8.3.12',
			'memory_limit'       => $memory,
			'max_execution_time' => $time,
			'extensions'         => SystemCheck::REQUIRED_EXTENSIONS,
		);
	}

	/**
	 * @return string[]
	 */
	private function failedChecks( array $env ): array {
		return array_values( array_column( array_filter( SystemCheck::evaluate( $env ), static fn( $r ) => ! $r['ok'] ), 'check' ) );
	}
}
