/**
 * Send low-kit-stock alert using the same MailService template as production.
 *
 * Usage:
 *   ENV_FILE=env/development.env node scripts/test_low_kit_stock_email.js
 *   TEST_TO=you@example.com ENV_FILE=env/development.env node scripts/test_low_kit_stock_email.js
 */
const fs = require("fs");
const path = require("path");

const envPath = process.env.ENV_FILE || "env/development.env";
const envFile = path.resolve(process.cwd(), envPath);
if (!fs.existsSync(envFile)) {
  console.error(`ENV file not found: ${envFile}`);
  process.exit(1);
}

const envText = fs.readFileSync(envFile, "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].trim();
  }
}

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const { createPool } = require("../src/database/Database");
const { setPool } = require("../src/server");
const MailService = require("../src/services/MailService").default;

const TO = process.env.TEST_TO || "info@youth-revisited.co.uk";

(async () => {
  setPool(await createPool());

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

  console.log("SUCCESS: low kit stock email sent to", TO);
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
