<?php
/**
 * Integer-cent money value.
 *
 * @package Lodelicious\Gifts
 */

namespace Lodelicious\Gifts\Domain;

use InvalidArgumentException;

/**
 * Immutable USD amount stored as integer cents. All gift, packaging and budget math uses this
 * type so floating-point rounding never reaches a price or a budget check.
 */
final class Money {

	private function __construct( public readonly int $cents ) {}

	public static function cents( int $cents ): self {
		return new self( $cents );
	}

	/**
	 * Parse a decimal string such as "29.95" or "$1,299.00" without using floats.
	 */
	public static function parse( string $amount ): self {
		$clean = str_replace( array( '$', ',', ' ' ), '', trim( $amount ) );
		if ( ! preg_match( '/^(-)?(\d+)(?:\.(\d{1,2}))?$/', $clean, $m ) ) {
			throw new InvalidArgumentException( sprintf( 'Not a money amount: "%s"', $amount ) );
		}
		$cents = (int) $m[2] * 100 + (int) str_pad( $m[3] ?? '0', 2, '0' );
		return new self( '-' === $m[1] ? -$cents : $cents );
	}

	public static function zero(): self {
		return new self( 0 );
	}

	public function add( self $other ): self {
		return new self( $this->cents + $other->cents );
	}

	public function subtract( self $other ): self {
		return new self( $this->cents - $other->cents );
	}

	public function multiply( int $quantity ): self {
		return new self( $this->cents * $quantity );
	}

	public function isNegative(): bool {
		return $this->cents < 0;
	}

	public function greaterThan( self $other ): bool {
		return $this->cents > $other->cents;
	}

	public function equals( self $other ): bool {
		return $this->cents === $other->cents;
	}

	public function format(): string {
		$abs = abs( $this->cents );
		return ( $this->cents < 0 ? '-' : '' ) . '$' . number_format( intdiv( $abs, 100 ) ) . '.' . str_pad( (string) ( $abs % 100 ), 2, '0', STR_PAD_LEFT );
	}
}
