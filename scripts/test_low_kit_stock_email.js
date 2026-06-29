/**
 * Send a sample low-kit-stock alert email (same template as production).
 *
 * Usage:
 *   ENV_FILE=env/development.env node scripts/test_low_kit_stock_email.js
 *
 * On server after deploy:
 *   ENV_FILE=env/development.env node scripts/test_low_kit_stock_email.js
 */
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const MailService = require("../src/services/MailService").default;

(async () => {
  await MailService.sendLowKitStockAlertEmail({
    phlebId: 1276,
    phlebName: "GPS Test Phleb",
    phlebEmail: "gpsphleb@test.com",
    phlebPhone: "+92 300 0000001",
    totalRemaining: 2,
    threshold: 2,
    balances: [
      { kit_name: "Standard blood kit", current_balance: 1 },
      { kit_name: "Urine kit", current_balance: 1 },
    ],
  });
  console.log("SUCCESS: low kit stock test email sent to info@youth-revisited.co.uk");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
