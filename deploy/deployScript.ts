import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import * as dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function deploy() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("Set PRIVATE_KEY in .env");

  const account = createAccount(privateKey as `0x${string}`);
  const client = createClient({ chain: testnetBradbury, account });

  console.log(`\n🚀 Deploying FreelanceCourt to Testnet Bradbury`);
  console.log(`   From: ${account.address}\n`);

  const code = readFileSync(
    resolve(__dirname, "../contracts/freelance_court.py"),
    "utf-8"
  );

  const hash: any = await client.deployContract({ code, args: [], leaderOnly: false });
  console.log(`📝 Deploy tx: ${hash}`);
  console.log(`⏳ Waiting for confirmation (30–120s)…`);

  const receipt: any = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 60,
    interval: 5000,
  });

  if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    console.error(`\n❌ Deploy execution failed: ${receipt.txExecutionResultName ?? "unknown"}`);

    try {
      const trace: any = await client.debugTraceTransaction({ hash, round: 0 });
      if (trace?.stderr) {
        console.error(trace.stderr.trim());
      }
    } catch {
      // Best-effort trace fetch for clearer deploy errors.
    }

    throw new Error("Contract deployment failed");
  }

  const addr = receipt.txDataDecoded?.contractAddress ?? receipt.recipient;
  if (!addr) {
    throw new Error("Deploy succeeded but contract address is missing from receipt");
  }

  console.log(`\n✅ Contract: ${addr}`);
  console.log(`\n👉 Add to .env and frontend/.env.local:`);
  console.log(`   CONTRACT_ADDRESS=${addr}`);
  console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${addr}\n`);
}

deploy().catch(console.error);
