<?php
/**
 * Public business details confirmed in the client brief (September 24, 2026).
 *
 * Filterable so the plugin's code-free settings can take over later (OPS 03).
 *
 * @package Lodelicious
 */

defined( 'ABSPATH' ) || exit;

/**
 * @return array{name:string, street:string, locality:string, phone:string, phone_e164:string, email:string, hours:array<string,string>, hours_label:string, closed:string[]}
 */
function ldl_store_info(): array {
	return apply_filters(
		'ldl_store_info',
		array(
			'name'        => 'Lodelicious Gifts & Sweets',
			'street'      => '24 Manomet Point Rd.',
			'locality'    => 'Plymouth, MA 02360',
			'phone'       => '(774) 283-4676',
			'phone_e164'  => '+17742834676',
			'email'       => 'lodelicious1@gmail.com',
			'hours_label' => __( 'Fall & winter hours', 'lodelicious' ),
			'hours'       => array(
				__( 'Mon–Thu', 'lodelicious' ) => '11 AM – 6 PM',
				__( 'Fri–Sat', 'lodelicious' ) => '11 AM – 7 PM',
				__( 'Sun', 'lodelicious' )     => '11 AM – 5 PM',
			),
			'closed'      => array(
				__( 'Christmas Day', 'lodelicious' ),
				__( 'New Year’s Day', 'lodelicious' ),
				__( 'Labor Day', 'lodelicious' ),
			),
		)
	);
}
