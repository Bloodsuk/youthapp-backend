# Sample Returns — Royal Mail addresses (WordPress)

Confirmed with Wajid (Sep 2026).

## Two addresses

| Role | Value | Source |
|---|---|---|
| **Send to (QR destination)** | Youth Revisited, PO Box 689, Grimsby DN31 9LR, UK | Hardcoded — `yr_rm_destination_address()` / `yr_rm_return_address()` |
| **Return-to (if not delivered)** | Customer home address | Dynamic — `yr_rm_customer_return_address($order_id)` via `orders` + `customers` |

Phleb collects sample at customer → posts with Royal Mail → package goes to **company**.  
If the lab/office does not receive it, RM uses the **customer** return-to address.

## Install

1. Copy helpers from `yr-rm-return-address-fix.php` into the live WP sample-returns plugin (or merge into `create-return.php`).
2. In the Royal Mail create-shipment payload:
   - destination / recipient = company helper
   - return / undeliverable address = customer helper
3. Create a **new** test return to verify (old QRs do not update).

## App / Node

- Snapshot `return_address` = company destination (label shown as where to send).
- Snapshot `customer_return_address` = customer (shown as return-if-failed).
