<?php

namespace Lodelicious\Gifts\Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * Guards the verbatim source evidence against accidental edits (PRD AC 01).
 */
final class SourceDataTest extends TestCase {

	/**
	 * @return list<array<string, string>>
	 */
	private function rows( string $file ): array {
		$handle = fopen( LDL_REPO_ROOT . '/data/source/' . $file, 'r' );
		$header = fgetcsv( $handle, escape: '' );
		$rows   = array();
		while ( false !== ( $line = fgetcsv( $handle, escape: '' ) ) ) {
			$this->assertCount( count( $header ), $line, "$file has a malformed row" );
			$rows[] = array_combine( $header, $line );
		}
		fclose( $handle );
		return $rows;
	}

	public function testRowCountsMatchPrdAppendices(): void {
		$this->assertCount( 20, $this->rows( 'clover-public-2026-09-22.csv' ) );
		$this->assertCount( 19, $this->rows( 'price-list-screenshot.csv' ) );
		$this->assertCount( 12, $this->rows( 'doordash-2026-09-25.csv' ) );
		$this->assertCount( 9, $this->rows( 'basket-chart.csv' ) );
	}

	public function testReferencesAreUniqueAndPricesAreIntegerCents(): void {
		foreach ( array( 'clover-public-2026-09-22.csv', 'price-list-screenshot.csv', 'doordash-2026-09-25.csv' ) as $file ) {
			$rows = $this->rows( $file );
			$refs = array_column( $rows, 'ref' );
			$this->assertSame( $refs, array_unique( $refs ), "$file has duplicate refs" );
			foreach ( $rows as $row ) {
				$this->assertMatchesRegularExpression( '/^\d+$/', $row['source_price_cents'], "$file {$row['ref']}" );
			}
		}
	}

	public function testBasketChartCounts(): void {
		$chart = array_column( $this->rows( 'basket-chart.csv' ), null, 'code' );
		$this->assertSame( array( '6', '8' ), array( $chart['small']['min_items'], $chart['small']['max_items'] ) );
		$this->assertSame( array( '12', '14' ), array( $chart['large']['min_items'], $chart['large']['max_items'] ) );
		$this->assertSame( array( '18', '20' ), array( $chart['extra_large']['min_items'], $chart['extra_large']['max_items'] ) );
		// The chart's large sympathy range is an intentional exception to the standard large range.
		$this->assertSame( array( '13', '16' ), array( $chart['large_sympathy']['min_items'], $chart['large_sympathy']['max_items'] ) );
	}
}
