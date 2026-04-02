"use client";

import type { JobActionApi, JobRecord } from "./types";

const STORAGE_KEY = "fc_demo_jobs_v2";
const LATENCY_MS = 450;
const toWei = (value: string) => BigInt(value) * BigInt("1000000000000000000");

export const DEMO_ACTORS = [
  {
    label: "Client / Alice",
    address: "0xA11ce00000000000000000000000000000000001",
    role: "client",
  },
  {
    label: "Freelancer / Maya",
    address: "0xB0b0000000000000000000000000000000000002",
    role: "freelancer",
  },
  {
    label: "Freelancer / Leo",
    address: "0xCaFe000000000000000000000000000000000003",
    role: "freelancer",
  },
] as const;

type StoredJob = Omit<JobRecord, "budget"> & { budget: string };

const now = () => Math.floor(Date.now() / 1000);

function delay(ms = LATENCY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeJob(job: StoredJob): JobRecord {
  return {
    ...job,
    budget: BigInt(job.budget),
  };
}

function serializeJobs(jobs: JobRecord[]): StoredJob[] {
  return jobs.map((job) => ({
    ...job,
    budget: job.budget.toString(),
  }));
}

function initialJobs(): JobRecord[] {
  const current = now();
  return [
    {
      id: 0,
      client: DEMO_ACTORS[0].address,
      freelancer: "",
      title: "Build a launch page for an AI payroll product",
      brief: "Create a responsive marketing page for PayrollPilot with a strong hero, proof points, pricing snapshot, and FAQ section.",
      criteria: "Hero with CTA, benefits section, pricing snapshot, FAQ, mobile layout, public delivery URL.",
      budget: toWei("2"),
      deadline_days: 7,
      created_at: current - 60 * 55,
      submission_url: "",
      submission_note: "",
      status: "OPEN",
      verdict: "",
      verdict_reason: "",
      partial_pct: 0,
    },
    {
      id: 1,
      client: DEMO_ACTORS[0].address,
      freelancer: DEMO_ACTORS[1].address,
      title: "Write API docs for payment webhooks",
      brief: "Document five payment endpoints with auth, payload schema, examples, and operational caveats.",
      criteria: "Endpoints documented, request/response examples, auth section, webhook retry rules, readable structure.",
      budget: toWei("1"),
      deadline_days: 5,
      created_at: current - 60 * 60 * 6,
      submission_url: "https://github.com/example/payment-docs",
      submission_note: "OpenAPI draft plus markdown examples.",
      status: "SUBMITTED",
      verdict: "",
      verdict_reason: "",
      partial_pct: 0,
    },
    {
      id: 2,
      client: DEMO_ACTORS[0].address,
      freelancer: DEMO_ACTORS[2].address,
      title: "Logo and mini brand kit for Meridian Finance",
      brief: "Deliver logo concepts, SVG export, palette, typography, and a short usage guide.",
      criteria: "SVG logo, light/dark variants, palette, font recommendation, concise brand guide.",
      budget: BigInt("1500000000000000000"),
      deadline_days: 10,
      created_at: current - 60 * 60 * 24,
      submission_url: "https://www.figma.com/file/demo/meridian-finance-kit",
      submission_note: "Primary logo is complete, brand guide is still light.",
      status: "RESOLVED",
      verdict: "partial",
      verdict_reason: "The deliverable covers the core identity assets, but the usage guide is too thin for a full payout.",
      partial_pct: 60,
    },
    {
      id: 3,
      client: DEMO_ACTORS[0].address,
      freelancer: DEMO_ACTORS[1].address,
      title: "Audit landing page copy for a DeFi startup",
      brief: "Rewrite headline, social proof, and onboarding copy to improve clarity and trust.",
      criteria: "Updated headline, clearer proof section, improved CTA copy, concise tone.",
      budget: BigInt("800000000000000000"),
      deadline_days: 3,
      created_at: current - 60 * 90,
      submission_url: "",
      submission_note: "",
      status: "ACCEPTED",
      verdict: "",
      verdict_reason: "",
      partial_pct: 0,
    },
  ];
}

function loadJobs(): JobRecord[] {
  if (typeof window === "undefined") return initialJobs();

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const seeded = initialJobs();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeJobs(seeded)));
    return seeded;
  }

  try {
    const parsed = JSON.parse(stored) as StoredJob[];
    return parsed.map(normalizeJob);
  } catch {
    const seeded = initialJobs();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeJobs(seeded)));
    return seeded;
  }
}

function saveJobs(jobs: JobRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeJobs(jobs)));
}

function updateJob(jobId: number, mutator: (job: JobRecord) => JobRecord): JobRecord[] {
  const jobs = loadJobs();
  const next = jobs.map((job) => (job.id === jobId ? mutator({ ...job }) : job));
  saveJobs(next);
  return next;
}

function requireJob(jobId: number): JobRecord {
  const job = loadJobs().find((candidate) => candidate.id === jobId);
  if (!job) throw new Error("Demo job not found.");
  return job;
}

function resolveVerdict(job: JobRecord) {
  const evidence = `${job.submission_url} ${job.submission_note}`.toLowerCase();

  if (!job.submission_url) {
    return {
      verdict: "refund",
      partial_pct: 0,
      verdict_reason: "No public deliverable URL was provided, so the escrow returns to the client.",
    };
  }

  if (evidence.includes("draft") || evidence.includes("wip") || evidence.includes("incomplete")) {
    return {
      verdict: "partial",
      partial_pct: 40,
      verdict_reason: "The submission shows real progress, but it reads like an incomplete draft rather than a finished delivery.",
    };
  }

  if (
    evidence.includes("github.com") ||
    evidence.includes("vercel.app") ||
    evidence.includes("figma.com") ||
    evidence.includes("notion.site")
  ) {
    return {
      verdict: "release",
      partial_pct: 0,
      verdict_reason: "The submission is accessible and materially matches the requested deliverable, so payment is released.",
    };
  }

  return {
    verdict: "partial",
    partial_pct: 60,
    verdict_reason: "The deliverable is present but not complete enough for a full release, so the escrow is split.",
  };
}

export function resetDemoJobs() {
  const seeded = initialJobs();
  saveJobs(seeded);
  return seeded;
}

export async function getDemoJobs(): Promise<JobRecord[]> {
  await delay(200);
  return loadJobs().sort((a, b) => a.id - b.id);
}

export const demoActions: JobActionApi = {
  async createJob(signer, title, brief, criteria, deadlineDays, budgetWei) {
    await delay();
    const jobs = loadJobs();
    const nextJob: JobRecord = {
      id: jobs.length,
      client: signer,
      freelancer: "",
      title,
      brief,
      criteria,
      budget: budgetWei,
      deadline_days: deadlineDays,
      created_at: now(),
      submission_url: "",
      submission_note: "",
      status: "OPEN",
      verdict: "",
      verdict_reason: "",
      partial_pct: 0,
    };
    saveJobs([...jobs, nextJob]);
    return nextJob;
  },

  async acceptJob(signer, jobId) {
    await delay();
    const job = requireJob(jobId);
    if (job.status !== "OPEN") throw new Error("Job is no longer open.");
    if (job.client.toLowerCase() === signer.toLowerCase()) throw new Error("Client cannot accept their own job.");
    updateJob(jobId, (current) => ({ ...current, freelancer: signer, status: "ACCEPTED" }));
  },

  async submitWork(signer, jobId, url, note) {
    await delay();
    const job = requireJob(jobId);
    if (job.status !== "ACCEPTED") throw new Error("Job must be accepted first.");
    if (job.freelancer.toLowerCase() !== signer.toLowerCase()) throw new Error("Only the assigned freelancer can submit work.");
    updateJob(jobId, (current) => ({
      ...current,
      submission_url: url,
      submission_note: note,
      status: "SUBMITTED",
    }));
  },

  async approveWork(signer, jobId) {
    await delay();
    const job = requireJob(jobId);
    if (job.status !== "SUBMITTED") throw new Error("Work has not been submitted.");
    if (job.client.toLowerCase() !== signer.toLowerCase()) throw new Error("Only the client can approve.");
    updateJob(jobId, (current) => ({ ...current, status: "APPROVED" }));
  },

  async raiseDispute(signer, jobId) {
    await delay();
    const job = requireJob(jobId);
    if (job.status !== "SUBMITTED") throw new Error("Only submitted jobs can be disputed.");
    if (job.client.toLowerCase() !== signer.toLowerCase()) throw new Error("Only the client can raise a dispute.");
    updateJob(jobId, (current) => ({ ...current, status: "DISPUTED" }));
  },

  async resolveDispute(_signer, jobId) {
    await delay(900);
    const job = requireJob(jobId);
    if (job.status !== "DISPUTED") throw new Error("Job is not in dispute.");
    const result = resolveVerdict(job);
    updateJob(jobId, (current) => ({
      ...current,
      status: "RESOLVED",
      verdict: result.verdict,
      verdict_reason: result.verdict_reason,
      partial_pct: result.partial_pct,
    }));
  },

  async cancelJob(signer, jobId) {
    await delay();
    const job = requireJob(jobId);
    if (job.status !== "OPEN") throw new Error("Only open jobs can be cancelled.");
    if (job.client.toLowerCase() !== signer.toLowerCase()) throw new Error("Only the client can cancel.");
    updateJob(jobId, (current) => ({ ...current, status: "CANCELLED" }));
  },
};
