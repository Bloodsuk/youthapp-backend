# Global Payments Test Data

Test JSON payloads for Global Payments endpoints based on sample order #17837.

## Sample Order Reference
- **Order ID**: 17837
- **Customer ID**: 19438
- **Client Name**: system test
- **Subtotal**: 250.00
- **Total**: 250.00
- **Practitioner ID**: 286

---

## 1. Global Payments Checkout - New Card

**Endpoint**: `POST /api/orders/global_payments/checkout`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN_HERE
Content-Type: application/json
```

**Body** (Based on sample order):
```json
{
  "customer_id": 19438,
  "test_ids": [1, 2],
  "shipping_type": 1,
  "service_ids": [],
  "discount": 0,
  "current_medication": "No",
  "last_trained": "",
  "fasted": "No",
  "hydrated": "Yes",
  "drank_alcohol": "No",
  "drugs_taken": "",
  "supplements": "",
  "enhancing_drugs": "",
  "booking": {},
  "payment_method": {
    "number": "4263970000005262",
    "exp_month": "12",
    "exp_year": "2025",
    "cvv": "123",
    "card_holder_name": "system test"
  },
  "save_payment_method": true,
  "currency": "GBP"
}
```

**Note**: If you get error `50024 - currency card combination not allowed`, try using `"currency": "USD"` instead. Some test cards/accounts may not support GBP.

**Expected Response**:
```json
{
  "success": true,
  "order_id": 123,
  "order_number": "#YRV-241255555",
  "authorization": {
    "transactionId": "TRN_...",
    "status": "Preauthorized",
    "amount": 250.00,
    "currency": "GBP"
  },
  "payment_token_id": 5
}
```

---

## 2. Global Payments Checkout - Using Saved Token

**Endpoint**: `POST /api/orders/global_payments/checkout`

**Body**:
```json
{
  "customer_id": 19438,
  "test_ids": [1, 2],
  "shipping_type": 1,
  "service_ids": [],
  "discount": 0,
  "current_medication": "No",
  "last_trained": "",
  "fasted": "No",
  "hydrated": "Yes",
  "drank_alcohol": "No",
  "drugs_taken": "",
  "supplements": "",
  "enhancing_drugs": "",
  "booking": {},
  "payment_token_id": 1,
  "currency": "GBP"
}
```

---

## 3. Global Payments Checkout - With Discount

**Endpoint**: `POST /api/orders/global_payments/checkout`

**Body**:
```json
{
  "customer_id": 19438,
  "test_ids": [1, 2],
  "shipping_type": 1,
  "service_ids": [1],
  "discount": 25.00,
  "current_medication": "No",
  "last_trained": "",
  "fasted": "No",
  "hydrated": "Yes",
  "drank_alcohol": "No",
  "drugs_taken": "",
  "supplements": "",
  "enhancing_drugs": "",
  "booking": {},
  "payment_method": {
    "number": "4263970000005262",
    "exp_month": "12",
    "exp_year": "2025",
    "cvv": "123",
    "card_holder_name": "system test"
  },
  "save_payment_method": false,
  "currency": "GBP"
}
```

---

## 4. Global Payments Checkout - Full Health Details

**Endpoint**: `POST /api/orders/global_payments/checkout`

**Body**:
```json
{
  "customer_id": 19438,
  "test_ids": [1, 2, 3],
  "shipping_type": 2,
  "service_ids": [1, 2],
  "discount": 0,
  "current_medication": "Aspirin, Vitamin D",
  "last_trained": "2025-01-15",
  "fasted": "Yes",
  "hydrated": "Yes",
  "drank_alcohol": "No",
  "drugs_taken": "None",
  "supplements": "Multivitamin, Omega-3",
  "enhancing_drugs": "None",
  "booking": {
    "appointment_date": "2025-12-01",
    "appointment_time": "10:00"
  },
  "payment_method": {
    "number": "4263970000005262",
    "exp_month": "12",
    "exp_year": "2025",
    "cvv": "123",
    "card_holder_name": "system test"
  },
  "save_payment_method": true,
  "currency": "GBP"
}
```

---

## 5. Capture Payment

**Endpoint**: `POST /api/orders/global_payments/capture`

**Body**:
```json
{
  "order_id": 123,
  "amount": 250.00,
  "currency": "GBP"
}
```

**Note**: Replace `order_id` with the actual order ID from checkout response. `amount` is optional - if not provided, uses order's `total_val`.

---

## 6. Release Payment (Cancel Hold)

**Endpoint**: `POST /api/orders/global_payments/release`

**Body**:
```json
{
  "order_id": 123
}
```

**Note**: Replace `order_id` with the actual order ID.

---

## 7. Tokenize Card (Save for Future)

**Endpoint**: `POST /api/orders/global_payments/tokenize`

**Body**:
```json
{
  "payment_method": {
    "number": "4263970000005262",
    "exp_month": "12",
    "exp_year": "2025",
    "cvv": "123",
    "card_holder_name": "system test"
  },
  "save": true
}
```

---

## 8. Get Saved Payment Tokens

**Endpoint**: `GET /api/orders/global_payments/payment_tokens`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

**No body required**

---

## 9. Delete Payment Token

**Endpoint**: `DELETE /api/orders/global_payments/payment_tokens/:id`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

**Example**: `DELETE /api/orders/global_payments/payment_tokens/1`

---

## Test Card Numbers (Global Payments Test Environment)

- **Visa**: `4263970000005262`
- **Mastercard**: `5425230000004415`
- **Amex**: `374101000000608`
- **CVV**: Any 3-4 digits (e.g., `123`)
- **Expiry**: Any future date (e.g., `12/2025`)

### ⚠️ Important: Currency Compatibility

**Error 50024 - "currency card combination not allowed"** means:
- The test card may not support the selected currency (e.g., GBP)
- Your merchant account may not be configured for this currency/card combination

**Solutions:**
1. **Use USD for testing**: Change `"currency": "GBP"` to `"currency": "USD"` in your test requests
2. **Check merchant account**: Verify your Global Payments merchant account supports the currency you're using
3. **Contact Global Payments**: If testing with GBP is required, contact Global Payments support to configure your test account

**Example with USD (recommended for testing):**
```json
{
  ...
  "currency": "USD"
}
```

---

## cURL Examples

### Checkout with New Card
```bash
curl --location 'http://localhost:7020/api/orders/global_payments/checkout' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN_HERE' \
--data '{
  "customer_id": 19438,
  "test_ids": [1, 2],
  "shipping_type": 1,
  "service_ids": [],
  "discount": 0,
  "current_medication": "No",
  "last_trained": "",
  "fasted": "No",
  "hydrated": "Yes",
  "drank_alcohol": "No",
  "drugs_taken": "",
  "supplements": "",
  "enhancing_drugs": "",
  "booking": {},
  "payment_method": {
    "number": "4263970000005262",
    "exp_month": "12",
    "exp_year": "2025",
    "cvv": "123",
    "card_holder_name": "system test"
  },
  "save_payment_method": true,
  "currency": "GBP"
}'
```

### Capture Payment
```bash
curl --location 'http://localhost:7020/api/orders/global_payments/capture' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN_HERE' \
--data '{
  "order_id": 123,
  "amount": 250.00,
  "currency": "GBP"
}'
```

### Release Payment
```bash
curl --location 'http://localhost:7020/api/orders/global_payments/release' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN_HERE' \
--data '{
  "order_id": 123
}'
```

