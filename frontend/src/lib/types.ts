export interface JobRecord {
  id: number;
  client: string;
  freelancer: string;
  title: string;
  brief: string;
  criteria: string;
  budget: bigint;
  deadline_days: number;
  created_at: number;
  submission_url: string;
  submission_note: string;
  status: string;
  verdict: string;
  verdict_reason: string;
  partial_pct: number;
}

export interface JobActionApi {
  createJob: (
    signer: string,
    title: string,
    brief: string,
    criteria: string,
    deadlineDays: number,
    budgetWei: bigint,
  ) => Promise<unknown>;
  acceptJob: (signer: string, jobId: number) => Promise<unknown>;
  submitWork: (signer: string, jobId: number, url: string, note: string) => Promise<unknown>;
  approveWork: (signer: string, jobId: number) => Promise<unknown>;
  raiseDispute: (signer: string, jobId: number) => Promise<unknown>;
  resolveDispute: (signer: string, jobId: number) => Promise<unknown>;
  cancelJob: (signer: string, jobId: number) => Promise<unknown>;
}
