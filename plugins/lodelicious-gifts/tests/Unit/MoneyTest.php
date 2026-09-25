<?php

namespace Lodelicious\Gifts\Tests\Unit;

use InvalidArgumentException;
use Lodelicious\Gifts\Domain\Money;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class MoneyTest extends TestCase {

	/**
	 * @return array<string, array{string, int}>
	 */
	public static function parseCases(): array {
		return array(
			'packaging small'  => array( '19.95', 1995 ),
			'packaging xl'     => array( '37.95', 3795 ),
			'dollar sign'      => array( '$139.95', 13995 ),
			'thousands'        => array( '$1,299.00', 129900 ),
			'one decimal'      => array( '8.5', 850 ),
			'whole'            => array( '25', 2500 ),
			'negative'         => array( '-4.25', -425 ),
			// A float would yield 0.1 + 0.2 != 0.3; integer parsing must not drift.
			'float trap'       => array( '0.30', 30 ),
		);
	}

	#[DataProvider( 'parseCases' )]
	public function testParsesDecimalStringsWithoutFloats( string $input, int $expected ): void {
		$this->assertSame( $expected, Money::parse( $input )->cents );
	}

	public function testRejectsMoreThanTwoDecimals(): void {
		$this->expectException( InvalidArgumentException::class );
		Money::parse( '29.955' );
	}

	public function testRejectsGarbage(): void {
		$this->expectException( InvalidArgumentException::class );
		Money::parse( 'twenty' );
	}

	public function testPrdBudgetExample(): void {
		// PRD: a $100 standard large budget minus $29.95 packaging leaves $70.05 for contents.
		$remaining = Money::parse( '100.00' )->subtract( Money::parse( '29.95' ) );
		$this->assertSame( 7005, $remaining->cents );
		$this->assertSame( '$70.05', $remaining->format() );
	}

	public function testArithmeticAndComparison(): void {
		$bar = Money::cents( 425 );
		$this->assertSame( 1275, $bar->multiply( 3 )->cents );
		$this->assertTrue( $bar->multiply( 3 )->greaterThan( Money::cents( 1274 ) ) );
		$this->assertTrue( Money::zero()->subtract( $bar )->isNegative() );
		$this->assertTrue( Money::parse( '4.25' )->equals( $bar ) );
	}

	public function testFormat(): void {
		$this->assertSame( '$1,999.99', Money::cents( 199999 )->format() );
		$this->assertSame( '$0.05', Money::cents( 5 )->format() );
		$this->assertSame( '-$4.25', Money::cents( -425 )->format() );
	}
}
