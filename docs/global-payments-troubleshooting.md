# Global Payments Troubleshooting Guide

## Error 50024: "currency card combination not allowed"

This error occurs when your Global Payments merchant account is not properly configured to process transactions.

### Root Causes

1. **Missing Transaction Processing Account Configuration**
   - The `GP_TXN_ACCOUNT_NAME` and/or `GP_TXN_ACCOUNT_ID` environment variables may not be set
   - These are typically required for the Global Payments API to process transactions

2. **Merchant Account Not Activated**
   - Your merchant account in the Global Payments portal may not be fully activated
   - Test accounts sometimes require manual activation by Global Payments support

3. **Account Configuration Issues**
   - The merchant account may not be configured to accept any currencies
   - The account may not be linked to a transaction processing account

### How to Fix

#### Step 1: Verify Environment Variables

Check your `.env` file has these variables set:

```bash
GP_APP_ID=your_app_id
GP_APP_KEY=your_app_key
GP_MERCHANT_ID=your_merchant_id
GP_TXN_ACCOUNT_NAME=your_transaction_account_name  # ← Required
GP_TXN_ACCOUNT_ID=your_transaction_account_id      # ← Required
GP_ENVIRONMENT=TEST
GP_DEFAULT_CURRENCY=GBP
```

#### Step 2: Check Global Payments Portal

1. Log into your Global Payments merchant portal
2. Verify your merchant account status is "Active"
3. Check that Transaction Processing Account is configured
4. Verify the account supports the currency you're testing (GBP/USD)

#### Step 3: Contact Global Payments Support

If the error persists after verifying configuration:

1. **Contact Global Payments Support** with:
   - Your merchant ID
   - Error code: 50024
   - Request: "Please verify my test merchant account is fully configured and activated for transaction processing"

2. **Ask them to verify**:
   - Merchant account is activated
   - Transaction Processing Account is linked
   - Account supports the currencies you need (GBP, USD, etc.)
   - Test environment is properly configured

#### Step 4: Check Server Logs

After restarting your server, check the logs for configuration details:

```
Global Payments - Configuration: {
  environment: 'TEST',
  channel: 'CardNotPresent',
  country: 'GB',
  merchantId: 'SET',
  hasAccessTokenInfo: true
}
Global Payments - AccessTokenInfo configured: {
  hasTransactionAccount: true,
  hasRiskAccount: false
}
```

If `hasTransactionAccount: false`, you need to set `GP_TXN_ACCOUNT_NAME` or `GP_TXN_ACCOUNT_ID`.

### Alternative: Test Without Transaction Account

Some Global Payments accounts may work without explicit transaction account configuration. Try:

1. Remove or comment out `GP_TXN_ACCOUNT_NAME` and `GP_TXN_ACCOUNT_ID`
2. Restart the server
3. Try the transaction again

**Note**: This depends on your Global Payments account setup. Most accounts require transaction account configuration.

### Common Issues

| Issue | Solution |
|-------|----------|
| `hasTransactionAccount: false` | Set `GP_TXN_ACCOUNT_NAME` or `GP_TXN_ACCOUNT_ID` in `.env` |
| Error with both GBP and USD | Merchant account not activated - contact Global Payments |
| Works in production but not test | Verify test environment credentials are correct |
| Account activated but still errors | Verify transaction processing account is linked in portal |

### Getting Help

If you continue to experience issues:

1. Check server logs for configuration details
2. Verify all environment variables are set correctly
3. Contact Global Payments support with:
   - Merchant ID
   - Error code and message
   - Configuration details (without sensitive keys)

