import {
  AccessTokenInfo,
  Channel,
  CreditCardData,
  Environment as GpEnvironment,
  GpApiConfig,
  ServicesContainer,
  Transaction,
} from "globalpayments-api";
import EnvVars from "@src/constants/EnvVars";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { RouteError } from "@src/other/classes";

const CONFIG_NAME = "global-payments";

type ConfiguredChannel = Channel.CardPresent | Channel.CardNotPresent;

export interface IPaymentMethodInput {
  token?: string;
  number?: string;
  expMonth?: string;
  expYear?: string;
  cvv?: string;
  cardHolderName?: string;
}

export interface IAuthorizeParams {
  amount: number | string;
  currency?: string;
  clientTransactionId?: string;
  orderId?: string;
  allowDuplicates?: boolean;
  requestMultiUseToken?: boolean;
  paymentMethod: IPaymentMethodInput;
}

export interface IFollowUpParams {
  transactionId: string;
  amount?: number | string | null;
  currency?: string;
}

export interface IGpTransactionResult {
  success: boolean;
  status: string;
  transactionId: string;
  authorizationCode?: string | null;
  responseCode?: string;
  responseMessage?: string;
  token?: string | null;
  raw: Transaction;
}

export interface IGpTokenizeResult {
  token: string;
  fingerprint?: string | null;
  cardType?: string;
  cardLast4?: string;
  raw: Transaction;
}

let isConfigured = false;

function ensureConfigured() {
  if (isConfigured) {
    return;
  }
  const gp = EnvVars.GlobalPayments;
  if (!gp.AppId || !gp.AppKey) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Global Payments credentials are not configured",
    );
  }
  const config = new GpApiConfig();
  config.appId = gp.AppId;
  config.appKey = gp.AppKey;
  config.merchantId = gp.MerchantId;
  config.channel = resolveChannel(gp.Channel);
  config.country = gp.Country || "GB";
  config.environment =
    gp.Environment?.toUpperCase() === "PRODUCTION"
      ? GpEnvironment.Production
      : GpEnvironment.Test;
  if (gp.MethodNotificationUrl) {
    config.methodNotificationUrl = gp.MethodNotificationUrl;
  }
  if (gp.ChallengeNotificationUrl) {
    config.challengeNotificationUrl = gp.ChallengeNotificationUrl;
  }
  if (gp.MerchantContactUrl) {
    config.merchantContactUrl = gp.MerchantContactUrl;
  }
  const accessInfo = buildAccessTokenInfo();
  if (accessInfo) {
    config.accessTokenInfo = accessInfo;
    const hasTransactionAccount = !!(accessInfo.transactionProcessingAccountName || accessInfo.transactionProcessingAccountID);
    console.log("Global Payments - AccessTokenInfo configured:", {
      hasTransactionAccount,
      hasRiskAccount: !!(accessInfo.riskAssessmentAccountName || accessInfo.riskAssessmentAccountID),
    });
    if (!hasTransactionAccount) {
      console.warn("Global Payments - Transaction Processing Account not configured. This may cause 'currency card combination not allowed' errors.");
    }
  } else {
    console.warn("Global Payments - AccessTokenInfo not configured. Transaction accounts (GP_TXN_ACCOUNT_NAME/ID) are typically required for processing.");
  }
  
  console.log("Global Payments - Configuration:", {
    environment: config.environment === GpEnvironment.Production ? "PRODUCTION" : "TEST",
    channel: config.channel,
    country: config.country,
    merchantId: config.merchantId ? "SET" : "NOT SET",
    hasAccessTokenInfo: !!config.accessTokenInfo,
  });
  
  ServicesContainer.configureService(config, CONFIG_NAME);
  isConfigured = true;
}

function resolveChannel(channel?: string): ConfiguredChannel {
  return channel?.toUpperCase() === Channel.CardPresent
    ? Channel.CardPresent
    : Channel.CardNotPresent;
}

function buildAccessTokenInfo() {
  const {
    TransactionAccountName,
    TransactionAccountId,
    RiskAccountName,
    RiskAccountId,
  } = EnvVars.GlobalPayments;
  if (
    !TransactionAccountName &&
    !TransactionAccountId &&
    !RiskAccountName &&
    !RiskAccountId
  ) {
    return undefined;
  }
  const info = new AccessTokenInfo();
  if (TransactionAccountName) {
    info.transactionProcessingAccountName = TransactionAccountName;
  }
  if (TransactionAccountId) {
    info.transactionProcessingAccountID = TransactionAccountId;
  }
  if (RiskAccountName) {
    info.riskAssessmentAccountName = RiskAccountName;
  }
  if (RiskAccountId) {
    info.riskAssessmentAccountID = RiskAccountId;
  }
  return info;
}

function buildCardData(payment: IPaymentMethodInput) {
  const card = new CreditCardData();
  if (payment.token) {
    card.token = payment.token;
  } else {
    if (!payment.number || !payment.expMonth || !payment.expYear) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Incomplete card details for Global Payments authorization",
      );
    }
    // Clean card number: remove spaces and dashes
    card.number = String(payment.number).replace(/[\s-]/g, "");
    // Ensure expMonth and expYear are strings
    card.expMonth = String(payment.expMonth).padStart(2, "0");
    card.expYear = String(payment.expYear);
    // If expYear is 2 digits, assume 20XX
    if (card.expYear.length === 2) {
      card.expYear = "20" + card.expYear;
    }
  }
  if (payment.cvv) {
    card.cvn = String(payment.cvv);
  }
  if (payment.cardHolderName) {
    card.cardHolderName = String(payment.cardHolderName).trim();
  }
  return card;
}

function formatResult(
  transaction: Transaction,
  status: string,
): IGpTransactionResult {
  return {
    success: transaction.responseCode === "00",
    status,
    transactionId: transaction.transactionId || "",
    authorizationCode: transaction.authorizationCode,
    responseCode: transaction.responseCode,
    responseMessage: transaction.responseMessage,
    token: transaction.token || null,
    raw: transaction,
  };
}

function handleProviderError(error: unknown): never {
  if (error instanceof RouteError) {
    throw error;
  }
  
  // Extract detailed error information from Global Payments SDK
  let message = "Unknown Global Payments error";
  let helpfulHint = "";
  
  if (error && typeof error === "object") {
    if ("message" in error) {
      message = String((error as { message: string }).message);
    }
    // Global Payments SDK often includes responseCode and responseMessage
    if ("responseCode" in error) {
      const code = (error as { responseCode: string }).responseCode;
      const responseMsg = "responseMessage" in error 
        ? String((error as { responseMessage: string }).responseMessage)
        : "";
      message = `Status Code: ${code}${responseMsg ? ` - ${responseMsg}` : ""}`;
      
      // Add helpful hints for common errors
      if (code === "50024") {
        helpfulHint = " This error typically indicates that your Global Payments merchant account is not properly configured to accept transactions. Please verify: 1) Your merchant account is activated in the Global Payments portal, 2) Transaction Processing Account (GP_TXN_ACCOUNT_NAME/ID) is correctly set in environment variables, 3) Your account supports the currency you're using, 4) Contact Global Payments support to ensure your test account is fully configured.";
      } else if (code === "40213") {
        helpfulHint = " The reference field (clientTransactionId) contains invalid characters. It should be alphanumeric only, max 50 characters.";
      }
    }
  }
  
  console.error("Global Payments API Error:", error);
  throw new RouteError(
    HttpStatusCodes.BAD_GATEWAY,
    `Global Payments error: ${message}${helpfulHint}`,
  );
}

async function authorize(
  params: IAuthorizeParams,
): Promise<IGpTransactionResult> {
  try {
    ensureConfigured();
    const card = buildCardData(params.paymentMethod);
    const currency = params.currency || EnvVars.GlobalPayments.DefaultCurrency;
    
    // Ensure amount is a number, not string
    const amount = typeof params.amount === "string" 
      ? parseFloat(params.amount) 
      : params.amount;
    
    let builder = card.authorize(amount).withCurrency(currency);
    if (params.allowDuplicates !== undefined) {
      builder = builder.withAllowDuplicates(params.allowDuplicates);
    }
    // clientTransactionId: Optional merchant reference
    // Global Payments requires alphanumeric only, max 50 chars
    // If provided, sanitize it; otherwise Global Payments will generate one
    if (params.clientTransactionId) {
      const sanitized = String(params.clientTransactionId)
        .replace(/[^a-zA-Z0-9]/g, "") // Remove non-alphanumeric
        .substring(0, 50); // Max 50 characters
      // Only set if we have a valid sanitized value
      // If empty after sanitization, skip it (Global Payments will auto-generate)
      if (sanitized.length > 0 && sanitized.length >= 3) {
        console.log("Global Payments - Setting clientTransactionId:", sanitized);
        builder = builder.withClientTransactionId(sanitized);
      } else {
        console.log("Global Payments - Skipping clientTransactionId (invalid format)");
      }
    }
    // Note: orderId is not directly supported in the SDK builder pattern
    // Use clientTransactionId for merchant reference instead
    if (params.requestMultiUseToken) {
      builder = builder.withRequestMultiUseToken(true);
    }
    
    console.log("Global Payments - Authorize request:", {
      amount,
      currency,
      hasToken: !!params.paymentMethod.token,
      hasCardNumber: !!params.paymentMethod.number,
      requestMultiUseToken: params.requestMultiUseToken,
    });
    
    const transaction = await builder.execute(CONFIG_NAME);
    return formatResult(transaction, "Authorized");
  } catch (error) {
    handleProviderError(error);
  }
}

async function charge(
  params: IAuthorizeParams,
): Promise<IGpTransactionResult> {
  try {
    ensureConfigured();
    const card = buildCardData(params.paymentMethod);
    const currency = params.currency || EnvVars.GlobalPayments.DefaultCurrency;
    
    // Ensure amount is a number, not string
    const amount = typeof params.amount === "string" 
      ? parseFloat(params.amount) 
      : params.amount;
    
    let builder = card.charge(amount).withCurrency(currency);
    if (params.allowDuplicates !== undefined) {
      builder = builder.withAllowDuplicates(params.allowDuplicates);
    }
    // clientTransactionId: Optional merchant reference
    // Global Payments requires alphanumeric only, max 50 chars
    if (params.clientTransactionId) {
      const sanitized = String(params.clientTransactionId)
        .replace(/[^a-zA-Z0-9]/g, "") // Remove non-alphanumeric
        .substring(0, 50); // Max 50 characters
      if (sanitized.length > 0 && sanitized.length >= 3) {
        console.log("Global Payments - Setting clientTransactionId:", sanitized);
        builder = builder.withClientTransactionId(sanitized);
      } else {
        console.log("Global Payments - Skipping clientTransactionId (invalid format)");
      }
    }
    if (params.requestMultiUseToken) {
      builder = builder.withRequestMultiUseToken(true);
    }
    
    console.log("Global Payments - Charge request:", {
      amount,
      currency,
      hasToken: !!params.paymentMethod.token,
      hasCardNumber: !!params.paymentMethod.number,
      requestMultiUseToken: params.requestMultiUseToken,
    });
    
    const transaction = await builder.execute(CONFIG_NAME);
    return formatResult(transaction, "Charged");
  } catch (error) {
    handleProviderError(error);
  }
}

async function capture(
  params: IFollowUpParams,
): Promise<IGpTransactionResult> {
  try {
    ensureConfigured();
    const tx = Transaction.fromId(params.transactionId);
    let builder = tx.capture(params.amount ?? undefined);
    if (params.currency) {
      builder = builder.withCurrency(params.currency);
    }
    const transaction = await builder.execute(CONFIG_NAME);
    return formatResult(transaction, "Captured");
  } catch (error) {
    handleProviderError(error);
  }
}

async function release(
  transactionId: string,
): Promise<IGpTransactionResult> {
  try {
    ensureConfigured();
    const transaction = await Transaction.fromId(transactionId)
      .release()
      .execute(CONFIG_NAME);
    return formatResult(transaction, "Released");
  } catch (error) {
    handleProviderError(error);
  }
}

async function voidAuthorization(
  transactionId: string,
): Promise<IGpTransactionResult> {
  try {
    ensureConfigured();
    const transaction = await Transaction.fromId(transactionId)
      .void()
      .execute(CONFIG_NAME);
    return formatResult(transaction, "Voided");
  } catch (error) {
    handleProviderError(error);
  }
}

async function tokenize(
  paymentMethod: IPaymentMethodInput,
): Promise<IGpTokenizeResult> {
  try {
    ensureConfigured();
    const card = buildCardData(paymentMethod);
    const transaction = await card.tokenize().execute(CONFIG_NAME);
    return {
      token: transaction.token,
      fingerprint: transaction.fingerprint || null,
      cardType: transaction.cardType,
      cardLast4: transaction.cardLast4,
      raw: transaction,
    };
  } catch (error) {
    handleProviderError(error);
  }
}

export default {
  authorize,
  charge,
  capture,
  release,
  void: voidAuthorization,
  tokenize,
};

