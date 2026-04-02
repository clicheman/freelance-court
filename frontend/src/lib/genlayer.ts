import { abi as glAbi, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import { encodeFunctionData, parseEventLogs } from "viem";

export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

// Actual values from genlayer-js v0.27.6
// testnetBradbury.id = 4221
// testnetBradbury.rpcUrls.default.http[0] = "https://rpc-bradbury.genlayer.com"
// testnetBradbury.blockExplorers.default.url = "https://explorer-bradbury.genlayer.com/"
const RPC_URL = testnetBradbury.rpcUrls.default.http[0];
const CONSENSUS_ADDRESS = testnetBradbury.consensusMainContract!.address;
const CONSENSUS_ABI = testnetBradbury.consensusMainContract!.abi;
const GAS_FALLBACK = BigInt(200_000);
export const EXPLORER_URL = testnetBradbury.blockExplorers?.default?.url ?? "https://explorer-bradbury.genlayer.com/";
export const CHAIN_ID_HEX = "0x" + testnetBradbury.id.toString(16);

export const publicClient = createClient({ chain: testnetBradbury });

export function signingClient(address: string) {
  return createClient({
    chain: testnetBradbury,
    account: address as `0x${string}`,
  });
}

export { TransactionStatus };

// ─── Add network to MetaMask ──────────────────────────────────────────────────
export async function addGenLayerNetwork() {
  if (!window.ethereum) return;
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [{
      chainId: CHAIN_ID_HEX,
      chainName: "GenLayer Testnet Bradbury",
      nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
      rpcUrls: [RPC_URL],
      blockExplorerUrls: [EXPLORER_URL],
    }],
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
type Client = ReturnType<typeof signingClient>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toNonceBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
}

function toHexQuantity(value: bigint): `0x${string}` {
  return `0x${value.toString(16)}` as `0x${string}`;
}

function isSuccessStatus(status: unknown): boolean {
  return status === "0x1" || status === 1 || status === "success";
}

function extractConsensusTxId(l1Receipt: any): `0x${string}` {
  const parsed = parseEventLogs({
    abi: CONSENSUS_ABI,
    logs: l1Receipt.logs ?? [],
    strict: false,
  }) as any[];

  const created = parsed.find((event) => event.eventName === "CreatedTransaction");
  const legacy = parsed.find((event) => event.eventName === "NewTransaction");
  const txId = (created ?? legacy)?.args?.txId;

  if (!txId) {
    throw new Error("Consensus tx id is missing from L1 receipt logs");
  }

  return txId as `0x${string}`;
}

async function waitForEvmReceipt(client: Client, hash: `0x${string}`, retries = 60, interval = 3000) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const receipt = await (client as any).request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    });

    if (receipt) return receipt;
    await sleep(interval);
  }

  throw new Error(`Timed out waiting for L1 receipt: ${hash}`);
}

async function ensureExecutionSucceeded(client: Client, txId: `0x${string}`, receipt: any) {
  if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_RETURN) {
    return receipt;
  }

  let stderr = "";
  try {
    const trace: any = await client.debugTraceTransaction({ hash: txId as any, round: 0 });
    stderr = trace?.stderr?.trim() ?? "";
  } catch {
    // Best-effort trace fetch.
  }

  const lines = [
    `GenLayer execution failed: ${receipt.txExecutionResultName ?? "unknown"}`,
    stderr,
  ].filter(Boolean);

  throw new Error(lines.join("\n"));
}

async function waitAccepted(client: Client, hash: `0x${string}`) {
  const receipt: any = await client.waitForTransactionReceipt({
    hash: hash as any, status: TransactionStatus.ACCEPTED, retries: 60, interval: 5000,
  });
  return ensureExecutionSucceeded(client, hash, receipt);
}

async function waitFinalized(client: Client, hash: `0x${string}`) {
  const receipt: any = await client.waitForTransactionReceipt({
    hash: hash as any, status: TransactionStatus.FINALIZED, retries: 120, interval: 5000,
  });
  return ensureExecutionSucceeded(client, hash, receipt);
}

async function writeContractCompat(
  client: Client,
  signer: string,
  functionName: string,
  args: unknown[],
  value: bigint,
) {
  const encodedCall = glAbi.calldata.encode(
    glAbi.calldata.makeCalldataObject(functionName, args as any[], undefined),
  );
  const serializedData = glAbi.transactions.serialize([encodedCall, false]);
  const addTransactionData = encodeFunctionData({
    abi: CONSENSUS_ABI,
    functionName: "addTransaction",
    args: [
      signer,
      CONTRACT_ADDRESS,
      testnetBradbury.defaultNumberOfInitialValidators,
      testnetBradbury.defaultConsensusMaxRotations,
      serializedData,
      BigInt(0),
    ],
  });

  const nonce = toNonceBigInt(await client.getCurrentNonce({ address: signer as `0x${string}` }));

  let gas = GAS_FALLBACK;
  try {
    gas = await client.estimateTransactionGas({
      from: signer as `0x${string}`,
      to: CONSENSUS_ADDRESS,
      data: addTransactionData,
      value,
    });
  } catch {
    // Keep fallback gas on estimate errors.
  }

  const gasPriceHex = await client.request({ method: "eth_gasPrice" });
  const request = {
    from: signer as `0x${string}`,
    to: CONSENSUS_ADDRESS,
    data: addTransactionData,
    value: toHexQuantity(value),
    gas: toHexQuantity(gas),
    nonce: toHexQuantity(nonce),
    type: "0x0" as const,
    chainId: toHexQuantity(BigInt(testnetBradbury.id)),
    gasPrice: gasPriceHex,
  };

  const l1Hash = await (client as any).request({
    method: "eth_sendTransaction",
    params: [request],
  }) as `0x${string}`;
  const l1Receipt = await waitForEvmReceipt(client, l1Hash);

  if (!isSuccessStatus(l1Receipt.status)) {
    throw new Error(`L1 addTransaction reverted: ${l1Hash}`);
  }

  return extractConsensusTxId(l1Receipt);
}

// ─── Read ─────────────────────────────────────────────────────────────────────
export async function getAllJobs(): Promise<any[]> {
  const r: any = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_all_jobs",
    args: [],
  });
  return Array.isArray(r) ? r : [];
}

export async function getJob(id: number): Promise<any> {
  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_job",
    args: [id],
  });
}

// ─── Write ────────────────────────────────────────────────────────────────────
export async function createJob(
  signer: string, title: string, brief: string,
  criteria: string, deadlineDays: number, budgetWei: bigint,
) {
  const c = signingClient(signer);
  const txId = await writeContractCompat(
    c,
    signer,
    "create_job",
    [title, brief, criteria, BigInt(deadlineDays)],
    budgetWei,
  );
  return waitAccepted(c, txId);
}

export async function acceptJob(signer: string, jobId: number) {
  const c = signingClient(signer);
  const txId = await writeContractCompat(c, signer, "accept_job", [BigInt(jobId)], BigInt(0));
  return waitAccepted(c, txId);
}

export async function submitWork(signer: string, jobId: number, url: string, note: string) {
  const c = signingClient(signer);
  const txId = await writeContractCompat(c, signer, "submit_work", [BigInt(jobId), url, note], BigInt(0));
  return waitAccepted(c, txId);
}

export async function approveWork(signer: string, jobId: number) {
  const c = signingClient(signer);
  const txId = await writeContractCompat(c, signer, "approve_work", [BigInt(jobId)], BigInt(0));
  return waitAccepted(c, txId);
}

export async function raiseDispute(signer: string, jobId: number) {
  const c = signingClient(signer);
  const txId = await writeContractCompat(c, signer, "raise_dispute", [BigInt(jobId)], BigInt(0));
  return waitAccepted(c, txId);
}

export async function resolveDispute(signer: string, jobId: number) {
  // This triggers gl.get_webpage() + 5 LLM validators — wait for FINALIZED (~2 min)
  const c = signingClient(signer);
  const txId = await writeContractCompat(c, signer, "resolve_dispute", [BigInt(jobId)], BigInt(0));
  return waitFinalized(c, txId);
}

export async function cancelJob(signer: string, jobId: number) {
  const c = signingClient(signer);
  const txId = await writeContractCompat(c, signer, "cancel_job", [BigInt(jobId)], BigInt(0));
  return waitAccepted(c, txId);
}

// ─── Display utils ────────────────────────────────────────────────────────────
export const GEN = (wei: number | bigint) =>
  (Number(wei) / 1e18).toFixed(3) + " GEN";

export const STATUS_LABEL: Record<string, string> = {
  OPEN:      "Open",
  ACCEPTED:  "In progress",
  SUBMITTED: "Under review",
  APPROVED:  "Completed",
  DISPUTED:  "Disputed",
  RESOLVED:  "Resolved",
  CANCELLED: "Cancelled",
};

export const STATUS_COLOR: Record<string, string> = {
  OPEN:      "var(--green)",
  ACCEPTED:  "var(--amber)",
  SUBMITTED: "var(--amber)",
  APPROVED:  "var(--indigo)",
  DISPUTED:  "var(--red)",
  RESOLVED:  "var(--indigo)",
  CANCELLED: "var(--text5)",
};
