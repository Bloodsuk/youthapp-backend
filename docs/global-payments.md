# Global Payments (GpApi) – Discovery & Setup

This note records everything needed before wiring the new Global Payments
pre-authorisation flow into the YouthApp backend.

## SDK & Platform Requirements

- **Package**: `globalpayments-api` (latest 3.10.8) published by Global Payments.
- **Runtime**: requires Node.js ≥ 16.20.2 per the package manifest, which is
  already satisfied by our toolchain.
- **Key classes** (from the SDK):
  - `GpApiConfig` – config object that accepts `appId`, `appKey`, `merchantId`,
    `channel`, optional notification URLs, and `AccessTokenInfo`.
  - `ServicesContainer.configureService(config)` – registers the config and
    returns a client for subsequent requests.
  - `CreditCardData.authorize(amount)` – creates a pre-authorisation (a hold).
  - `Transaction.fromId(transactionId)` – helper for follow-up calls such as
    `capture`, `release`, `void`, or `reverse`.

## Credential & Environment Matrix

| Env key | Purpose |
| --- | --- |
| `GP_APP_ID` / `GP_APP_KEY` | OAuth-like credentials used by `GpApiConfig`. |
| `GP_MERCHANT_ID` | Merchant reference returned on responses and required on capture/void operations. |
| `GP_CHANNEL` | Should be `CNP` (card-not-present) for our checkout flow. |
| `GP_COUNTRY` | ISO country code used when configuring the connector (default `GB`). |
| `GP_ENVIRONMENT` | `TEST` or `PRODUCTION`, determines `serviceUrl`. |
| `GP_DEFAULT_CURRENCY` | Currency code sent to `.withCurrency(...)` (`GBP`). |
| `GP_TXN_ACCOUNT_NAME` / `GP_TXN_ACCOUNT_ID` | The Transaction Processing account info required by `AccessTokenInfo`. |
| `GP_RISK_ACCOUNT_NAME` / `GP_RISK_ACCOUNT_ID` | Optional but available for Risk Assessment requests. |
| `GP_METHOD_NOTIFICATION_URL`, `GP_CHALLENGE_NOTIFICATION_URL`, `GP_MERCHANT_CONTACT_URL` | URLs registered for 3DS method/challenge callbacks (only needed when enabling 3DS). |

All keys are now scaffolded in every `env/*.env` file and exposed via
`EnvVars.GlobalPayments`.

## Flow Mapping (pre-auth → capture → release)

```ts
import {
  AccessTokenInfo,
  Channel,
  CreditCardData,
  Environment,
  GpApiConfig,
  ServicesContainer,
  Transaction,
} from "globalpayments-api";
import EnvVars from "@src/constants/EnvVars";

const config = new GpApiConfig();
config.appId = EnvVars.GlobalPayments.AppId;
config.appKey = EnvVars.GlobalPayments.AppKey;
config.merchantId = EnvVars.GlobalPayments.MerchantId;
config.channel = Channel.CardNotPresent;
config.country = EnvVars.GlobalPayments.Country;
config.environment =
  EnvVars.GlobalPayments.Environment === "PRODUCTION"
    ? Environment.Production
    : Environment.Test;
config.accessTokenInfo = new AccessTokenInfo();
config.accessTokenInfo.transactionProcessingAccountName =
  EnvVars.GlobalPayments.TransactionAccountName;
config.accessTokenInfo.transactionProcessingAccountID =
  EnvVars.GlobalPayments.TransactionAccountId;

ServicesContainer.configureService(config);

// 1) Pre-authorise to place a hold
const card = new CreditCardData();
// Populate card or use a token:
const auth = await card
  .authorize(totalVal)
  .withCurrency(EnvVars.GlobalPayments.DefaultCurrency)
  .withAllowDuplicates(false)
  .execute();

// 2) Capture when we are ready to collect funds
await Transaction.fromId(auth.transactionId)
  .capture(totalVal)
  .execute();

// 3) Release/void if the hold should be cancelled
await Transaction.fromId(auth.transactionId).release().execute();
// or .void().execute() depending on the gateway/account settings.
```

The SDK exposes `capture`, `release`, `reverse`, and `void` builders off the
`Transaction` entity (`src/Entities/Transaction.ts` in the SDK), so we only
need to persist the `transactionId` plus any metadata (expiry, amount) inside
our `orders` table to support the full hold lifecycle.

## Saved Cards / Tokenization

- Every time a raw card is used with `save_payment_method: true` we call
  `withRequestMultiUseToken(true)` so Global Payments returns a reusable token.
- Metadata (fingerprint, brand, last4, exp dates) are stored in the new
  `payment_tokens` table and can be listed/deleted via dedicated endpoints.
- Future checkouts can pass `payment_token_id` instead of raw card data.

Table schema (added to `scripts/create_tables.sql`):

```
CREATE TABLE payment_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'GlobalPayments',
  token VARCHAR(255) NOT NULL,
  fingerprint VARCHAR(255),
  brand VARCHAR(50),
  last4 VARCHAR(4),
  exp_month VARCHAR(2),
  exp_year VARCHAR(4),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_provider_fingerprint (user_id, provider, fingerprint)
);
```

## API Endpoints for Postman

All endpoints live under `/api/orders` and require the usual session auth.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/global_payments/tokenize` | Exchanges raw card details for a Global Payments token. Set `save: true` (default) to store it in `payment_tokens`. |
| `POST` | `/global_payments/authorize` | Places a hold against an existing `order_id`. Body includes `order_id` plus either `payment_token_id` or raw `payment_method`. |
| `POST` | `/global_payments/capture` | Captures a prior authorization. Body: `{ "order_id": 123, "amount": 99.5 }`. |
| `POST` | `/global_payments/release` | Voids/releases a pre-auth. Body: `{ "order_id": 123 }`. |
| `GET` | `/global_payments/payment_tokens` | Lists saved Global Payments cards for the logged-in user. |
| `DELETE` | `/global_payments/payment_tokens/:id` | Deletes a stored card token. |

### Sample `POST /global_payments/tokenize`

```
{
  "payment_method": {
    "number": "4263970000005262",
    "exp_month": "12",
    "exp_year": "2025",
    "cvv": "123",
    "card_holder_name": "Test User"
  },
  "save": true
}
```

Response includes the GP token plus `payment_token_id` if it was saved.

### Sample `POST /global_payments/authorize`

```
{
  "order_id": 123,
  "payment_token_id": 45
}
```

Or send raw card data if the user hasn’t tokenized yet:

```
{
  "order_id": 123,
  "payment_method": {
    "number": "4263970000005262",
    "exp_month": "12",
    "exp_year": "2025",
    "cvv": "123",
    "card_holder_name": "Test User"
  },
  "save_payment_method": true
}
```

## Next Steps

1. Install `globalpayments-api` and create a thin wrapper similar to
   `StripeService` for auth/capture/void helpers.
2. Extend the `orders` table/model with `payment_provider`, hold metadata
   (transaction id, status, expiry), and capture audit fields.
3. Introduce controller endpoints for:
   - initiating the pre-auth checkout,
   - capturing a hold (admin action or fulfillment trigger),
   - releasing/voiding expired or cancelled holds,
   - managing saved payment tokens,
   - consuming Global Payments webhook notifications (if enabled).
4. Update reporting (`CreditRequestService`, outstanding payments view) to
   treat `"Authorized"` orders separately from `"Pending"` (credit) and `"Paid"`.

