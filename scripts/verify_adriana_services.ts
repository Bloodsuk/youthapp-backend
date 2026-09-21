/**
 * Service-level verify using the same pool helper as the app.
 *   PATH="/opt/homebrew/opt/node@20/bin:$PATH" npx ts-node --files -r tsconfig-paths/register scripts/verify_adriana_services.ts
 */
process.argv.push("-e", "live");
import "./../src/pre-start";
import * as server from "@src/server";
import { createPool } from "@src/database/Database";
import PhlebContractService from "@src/services/PhlebContractService";
import PhlebComplianceService from "@src/services/PhlebComplianceService";
import PhlebSopService from "@src/services/PhlebSopService";

async function main() {
  (server as { pool: unknown }).pool = await createPool();

  const phlebId = 1585;
  const contracts = await PhlebContractService.getContractsByPhlebId(phlebId);
  const items = await PhlebComplianceService.getItemsByPhlebId(phlebId);
  const sops = await PhlebSopService.listForPhleb(phlebId);

  console.log("contracts:", contracts.length);
  if (contracts[0]) {
    console.log({
      id: contracts[0].id,
      status: contracts[0].status,
      name: contracts[0].full_name,
      dbs_url: Boolean(contracts[0].dbs_adults_url),
      hep_url: Boolean(contracts[0].hep_b_proof_url),
      rtw_url: Boolean(contracts[0].right_to_work_url),
      cv_url: Boolean(contracts[0].cv_file_url),
    });
  }

  console.log(
    "compliance:",
    items.map((i) => `${i.item_key}=${i.status}${i.current_document ? "+file" : ""}`)
  );
  console.log("sops:", {
    required_total: sops.required_total,
    titles: sops.documents.map(
      (d) => `${d.title}${d.requires_acknowledgement ? " [req]" : " [ref]"}`
    ),
  });

  const pass =
    contracts.length === 1 &&
    items.filter((i) => i.status === "pendingReview").length >= 4 &&
    sops.required_total === 3 &&
    !sops.documents.some((d) => /Presentation/i.test(d.title));
  console.log(pass ? "SERVICE_VERIFY PASS" : "SERVICE_VERIFY FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
