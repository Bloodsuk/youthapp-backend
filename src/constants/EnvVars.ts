/**
 * Environments variables declared here.
 */

/* eslint-disable node/no-process-env */

export default {
  NodeEnv: process.env.NODE_ENV ?? "",
  Port: process.env.PORT ?? 0,
  CookieProps: {
    Key: "ExpressGeneratorTs",
    Secret: process.env.COOKIE_SECRET ?? "",
    // Casing to match express cookie options
    Options: {
      httpOnly: true,
      signed: true,
      path: process.env.COOKIE_PATH ?? "",
      maxAge: Number(process.env.COOKIE_EXP ?? 0),
      domain: process.env.COOKIE_DOMAIN ?? "",
      secure: process.env.SECURE_COOKIE === "true",
    },
  },
  Jwt: {
    Secret: process.env.JWT_SECRET ?? "",
    Exp: process.env.COOKIE_EXP ?? "", // exp at the same time as the cookie
  },
  MySQL: {
    User: process.env.DB_USER ?? "",
    Password: process.env.PASSWORD ?? "",
    Host: process.env.DB_HOST ?? "",
    Database: process.env.DATABASE ?? "",
  },
  Stripe: {
    Secret: process.env.STRIPE_SECRET_KEY ?? "",
  },
  GlobalPayments: {
    AppId: process.env.GP_APP_ID ?? "",
    AppKey: process.env.GP_APP_KEY ?? "",
    MerchantId: process.env.GP_MERCHANT_ID ?? "",
    Channel: process.env.GP_CHANNEL ?? "CNP",
    Country: process.env.GP_COUNTRY ?? "GB",
    Environment: process.env.GP_ENVIRONMENT ?? "TEST",
    DefaultCurrency: process.env.GP_DEFAULT_CURRENCY ?? "GBP",
    TransactionAccountName: process.env.GP_TXN_ACCOUNT_NAME ?? "",
    TransactionAccountId: process.env.GP_TXN_ACCOUNT_ID ?? "",
    RiskAccountName: process.env.GP_RISK_ACCOUNT_NAME ?? "",
    RiskAccountId: process.env.GP_RISK_ACCOUNT_ID ?? "",
    MethodNotificationUrl: process.env.GP_METHOD_NOTIFICATION_URL ?? "",
    ChallengeNotificationUrl:
      process.env.GP_CHALLENGE_NOTIFICATION_URL ?? "",
    MerchantContactUrl: process.env.GP_MERCHANT_CONTACT_URL ?? "",
  },
} as const;
