<?php
/**
 * Youth Revisited — Sample Returns / Royal Mail addresses
 *
 * Confirmed with Wajid:
 * - SEND TO (QR destination) = fixed company address below — yr_rm_return_address()
 * - RETURN TO (if undeliverable) = customer from order — yr_rm_customer_return_address()
 *
 * Keep these company values EXACT — do not substitute customer address here.
 */

if (!function_exists('yr_rm_return_address')) {
	/**
	 * Fixed send-to / QR destination — Youth Revisited (all fields set).
	 *
	 * @return array<string, string>
	 */
	function yr_rm_return_address() {
		return array(
			'firstName'      => 'Youth',
			'lastName'       => 'Revisited',
			'addressLine1'   => 'PO Box 689',
			'city'           => 'Grimsby',
			'postcode'       => 'DN31 9LR',
			'country'        => 'United Kingdom',
			'countryIsoCode' => 'GBR',
		);
	}
}

if (!function_exists('yr_rm_destination_address')) {
	/** Alias of yr_rm_return_address() — same company destination. */
	function yr_rm_destination_address() {
		return yr_rm_return_address();
	}
}

if (!function_exists('yr_rm_customer_return_address')) {
	/**
	 * Undeliverable return-to = customer on the order (dynamic).
	 *
	 * @param int|string $order_id Internal orders.id
	 * @return array<string, string>|null
	 */
	function yr_rm_customer_return_address($order_id) {
		global $wpdb;

		$order_id = (int) $order_id;
		if ($order_id <= 0) {
			return null;
		}

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT c.fore_name, c.sur_name, c.address, c.town, c.postal_code, c.email, c.country
				 FROM orders o
				 INNER JOIN customers c ON c.id = o.customer_id
				 WHERE o.id = %d
				 LIMIT 1",
				$order_id
			),
			ARRAY_A
		);

		if (!$row) {
			return null;
		}

		$first = trim((string) ($row['fore_name'] ?? ''));
		$last  = trim((string) ($row['sur_name'] ?? ''));
		$line1 = trim((string) ($row['address'] ?? ''));
		$city  = trim((string) ($row['town'] ?? ''));
		$post  = trim((string) ($row['postal_code'] ?? ''));
		$country = trim((string) ($row['country'] ?? ''));
		if ($country === '') {
			$country = 'United Kingdom';
		}

		if ($line1 === '' || $post === '') {
			return null;
		}

		return array(
			'firstName'      => $first !== '' ? $first : 'Customer',
			'lastName'       => $last,
			'addressLine1'   => $line1,
			'city'           => $city,
			'postcode'       => $post,
			'country'        => $country,
			'countryIsoCode' => 'GBR',
			'email'          => trim((string) ($row['email'] ?? '')),
		);
	}
}
