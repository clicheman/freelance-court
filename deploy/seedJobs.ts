import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import * as dotenv from "dotenv";
import { writeContractCompat } from "./genlayerWrite.js";
dotenv.config();

const JOBS = [
  {
    title: "Build a landing page for SaaS product",
    brief: "Responsive landing page for DataSync with hero, features, pricing, and footer. Blue/white design, HTML/CSS/JS.",
    criteria: "All 4 sections present, mobile-friendly, clean design, CTA included, public URL works.",
    budget_gen: 2.0,
    deadline_days: 7,
  },
  {
    title: "Write API documentation for payment endpoints",
    brief: "Document 5 payment API endpoints in Swagger or Markdown with params, schemas, and examples.",
    criteria: "All 5 endpoints covered, request/response examples included, errors documented, structure is clear.",
    budget_gen: 1.0,
    deadline_days: 5,
  },
  {
    title: "Logo and brand identity for DeFi startup",
    brief: "Create logo and mini brand kit for Meridian Finance: SVG logo, colors, typography, and short usage guide.",
    criteria: "SVG available by URL, light/dark versions provided, palette and font included, brief guide included.",
    budget_gen: 1.5,
    deadline_days: 10,
  },
];

const GEN = (n: number) => BigInt(Math.round(n * 1e18));
const RETRYABLE_ERRORS = [
  "NOT_VOTED",
  "LEADER_TIMEOUT",
  "VALIDATORS_TIMEOUT",
  "Timed out during",
  "Stale ",
  "Transaction status is not ACCEPTED",
];
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 8_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableSeedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_ERRORS.some((needle) => message.includes(needle));
}

async function seed() {
  const pk = process.env.PRIVATE_KEY;
  const contract = process.env.CONTRACT_ADDRESS as `0x${string}`;
  if (!pk) throw new Error("PRIVATE_KEY missing in .env");
  if (!contract || contract.startsWith("0x000")) {
    throw new Error("CONTRACT_ADDRESS missing — run npm run deploy first");
  }

  const account = createAccount(pk as `0x${string}`);
  const client = createClient({ chain: testnetBradbury, account });

  console.log(`\n🌱 Seeding ${JOBS.length} demo jobs`);
  console.log(`   From: ${account.address}\n`);

  for (let i = 0; i < JOBS.length; i++) {
    const j = JOBS[i];
    console.log(`[${i + 1}/${JOBS.length}] "${j.title}"`);
    console.log(`  ⏳ Creating…`);

    let txId: `0x${string}` | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await writeContractCompat({
          client,
          account,
          address: contract,
          functionName: "create_job",
          args: [j.title, j.brief, j.criteria, j.deadline_days],
          value: GEN(j.budget_gen),
          retries: 72,
          interval: 5_000,
          proposingTimeoutMs: 120_000,
          log: (message) => console.log(`     ${message}`),
        });
        txId = result.txId;
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`     attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message}`);

        if (attempt >= MAX_ATTEMPTS || !isRetryableSeedError(error)) {
          throw error;
        }

        console.log(`     retrying in ${RETRY_DELAY_MS / 1000}s`);
        await sleep(RETRY_DELAY_MS);
      }
    }

    console.log(`     tx=${txId}`);
    console.log(` ✓  (${j.budget_gen} GEN locked)`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  const total = JOBS.reduce((s, j) => s + j.budget_gen, 0);
  console.log(`\n✅ Done — ${JOBS.length} jobs, ${total} GEN in escrow\n`);
}

seed().catch(console.error);
