# Stripe Payment Flow Test

Manual test for the **Payment Intent → Checkout** flow before implementing in Flutter.

## Prerequisites

1. **Server running**: `npm run dev` (on port 7020)
2. **Database**: Valid `customer_id`, `test_ids`, `shipping_type` in your DB
3. **Stripe**: Use `sk_test_*` key in `env/development.env`
4. **User**: Valid login credentials for the API

## Run the test

```bash
# Set credentials via env, then run:
LOGIN_EMAIL=your@email.com LOGIN_PASSWORD=yourpass npm run test:stripe-flow
```

Or create a `.env` in project root (or use `env/development.env`):

```
LOGIN_EMAIL=your@email.com
LOGIN_PASSWORD=yourpassword
CUSTOMER_ID=1          # optional, default 1
TEST_IDS=1,2           # optional, default 1
SHIPPING_TYPE=1        # optional, default 1
BASE_URL=http://localhost:7020   # optional
```

Then:

```bash
npm run test:stripe-flow
```

## What it does

1. **Login** – Gets JWT token
2. **Create Payment Intent** – POST `/api/orders/stripe/payment_intent` with order params
3. **Confirm payment** – Uses Stripe SDK with test card `4242 4242 4242 4242`
4. **Checkout** – POST `/api/orders/stripe_checkout` with `payment_intent_id`

If all steps succeed, an order is created in the DB with `payment_status: "Paid"` and the Stripe charge ID stored as `transaction_id`.
