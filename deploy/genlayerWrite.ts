import { abi as glAbi } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import { encodeFunctionData, parseEventLogs } from "viem";

const CONSENSUS_ADDRESS = testnetBradbury.consensusMainContract!.address;
const CONSENSUS_ABI = testnetBradbury.consensusMainContract!.abi;
const GAS_FALLBACK = 200_000n;
const RPC_TIMEOUT_MS = 20_000;
const DECIDED_STATUS_NAMES = new Set([
  "ACCEPTED",
  "UNDETERMINED",
  "LEADER_TIMEOUT",
  "VALIDATORS_TIMEOUT",
  "CANCELED",
  "FINALIZED",
]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toNonceBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
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

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out during ${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function waitForEvmReceipt(
  client: any,
  hash: `0x${string}`,
  retries = 60,
  interval = 3_000,
) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const receipt = await client.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    });

    if (receipt) return receipt;
    await sleep(interval);
  }

  throw new Error(`Timed out waiting for L1 receipt: ${hash}`);
}

async function waitForGenLayerReceipt(args: {
  client: any;
  hash: `0x${string}`;
  status: TransactionStatus;
  retries: number;
  interval: number;
  proposingTimeoutMs: number;
  log?: (message: string) => void;
}) {
  const { client, hash, status, retries, interval, proposingTimeoutMs, log } = args;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const receipt = await withTimeout(
      client.getTransaction({ hash }),
      RPC_TIMEOUT_MS,
      "transaction status poll",
    ) as any;

    const statusName = String(receipt?.statusName ?? "");
    const executionName = String(receipt?.txExecutionResultName ?? "");

    if (statusName === status || (status === TransactionStatus.ACCEPTED && DECIDED_STATUS_NAMES.has(statusName))) {
      return receipt;
    }

    const createdTimestamp = BigInt(receipt?.createdTimestamp ?? 0);
    const currentTimestamp = BigInt(receipt?.currentTimestamp ?? 0);
    const ageMs = Number(currentTimestamp - createdTimestamp) * 1000;
    const proposalBlock = BigInt(receipt?.readStateBlockRange?.proposalBlock ?? 0);
    const processingBlock = BigInt(receipt?.readStateBlockRange?.processingBlock ?? 0);
    const lastVoteTimestamp = BigInt(receipt?.lastVoteTimestamp ?? 0);

    if (
      (statusName === "PENDING" || statusName === "PROPOSING") &&
      executionName === "NOT_VOTED" &&
      proposalBlock === 0n &&
      processingBlock === 0n &&
      lastVoteTimestamp === 0n &&
      ageMs >= proposingTimeoutMs
    ) {
      throw new Error(`Stale ${statusName} tx without votes: ${hash}`);
    }

    if (attempt === retries) {
      throw new Error(`Transaction status is not ${status}`);
    }

    if ((attempt + 1) % 3 === 0) {
      log?.(`still waiting: status=${statusName || "unknown"} execution=${executionName || "unknown"}`);
    }

    await sleep(interval);
  }

  throw new Error(`Transaction status is not ${status}`);
}

async function ensureExecutionSucceeded(client: any, txId: `0x${string}`, receipt: any) {
  if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_RETURN) {
    return receipt;
  }

  let stderr = "";
  try {
    const trace: any = await client.debugTraceTransaction({ hash: txId, round: 0 });
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

export async function writeContractCompat(args: {
  client: any;
  account: any;
  address: `0x${string}`;
  functionName: string;
  args?: unknown[];
  value?: bigint;
  status?: TransactionStatus;
  retries?: number;
  interval?: number;
  proposingTimeoutMs?: number;
  log?: (message: string) => void;
}) {
  const {
    client,
    account,
    address,
    functionName,
    args: functionArgs = [],
    value = 0n,
    status = TransactionStatus.ACCEPTED,
    retries = 60,
    interval = 5_000,
    proposingTimeoutMs = 120_000,
    log,
  } = args;

  const encodedCall = glAbi.calldata.encode(
    glAbi.calldata.makeCalldataObject(functionName, functionArgs as any[], undefined),
  );
  const serializedData = glAbi.transactions.serialize([encodedCall, false]);

  const addTransactionData = encodeFunctionData({
    abi: CONSENSUS_ABI,
    functionName: "addTransaction",
    args: [
      account.address,
      address,
      testnetBradbury.defaultNumberOfInitialValidators,
      testnetBradbury.defaultConsensusMaxRotations,
      serializedData,
      0n,
    ],
  });

  log?.(`preparing ${functionName}`);

  const nonce = toNonceBigInt(
    await withTimeout(
      client.getCurrentNonce({ address: account.address }),
      RPC_TIMEOUT_MS,
      "nonce fetch",
    ),
  );
  log?.(`nonce=${nonce.toString()}`);

  let gas = GAS_FALLBACK;
  try {
    log?.("estimating gas");
    gas = await withTimeout(
      client.estimateTransactionGas({
        from: account.address,
        to: CONSENSUS_ADDRESS,
        data: addTransactionData,
        value,
      }),
      RPC_TIMEOUT_MS,
      "gas estimation",
    );
    log?.(`estimated gas=${gas.toString()}`);
  } catch (error) {
    log?.(`gas estimate unavailable, using fallback ${GAS_FALLBACK.toString()}: ${(error as Error).message}`);
  }

  log?.("fetching gas price");
  const gasPriceHex = await withTimeout(
    client.request({ method: "eth_gasPrice" }),
    RPC_TIMEOUT_MS,
    "gas price fetch",
  ) as string;
  const serializedTransaction = await account.signTransaction({
    account,
    to: CONSENSUS_ADDRESS,
    data: addTransactionData,
    type: "legacy",
    nonce: Number(nonce),
    value,
    gas,
    gasPrice: BigInt(gasPriceHex),
    chainId: testnetBradbury.id,
  });

  log?.("sending raw transaction");
  const l1Hash = await withTimeout(
    client.sendRawTransaction({ serializedTransaction }),
    RPC_TIMEOUT_MS,
    "raw transaction send",
  ) as `0x${string}`;
  log?.(`l1Hash=${l1Hash}`);

  log?.("waiting for L1 receipt");
  const l1Receipt = await waitForEvmReceipt(client, l1Hash);

  if (!isSuccessStatus(l1Receipt.status)) {
    throw new Error(`L1 addTransaction reverted: ${l1Hash}`);
  }

  const txId = extractConsensusTxId(l1Receipt);
  log?.(`txId=${txId}`);
  log?.(`waiting for GenLayer status=${status}`);
  const receipt = await waitForGenLayerReceipt({
    client,
    hash: txId,
    status,
    retries,
    interval,
    proposingTimeoutMs,
    log,
  }) as any;

  await ensureExecutionSucceeded(client, txId, receipt);
  log?.(`execution=${receipt.txExecutionResultName ?? "unknown"}`);

  return { l1Hash, txId, receipt };
}
