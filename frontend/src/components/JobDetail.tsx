"use client";
import { useState } from "react";
import { GEN, STATUS_LABEL, EXPLORER_URL } from "@/lib/genlayer";
import type { JobActionApi, JobRecord } from "@/lib/types";

interface Props {
  job: JobRecord;
  userAddress: string | null;
  onUpdate: () => void;
  actions: Omit<JobActionApi, "createJob">;
  modeLabel: string;
}

type TxState = "idle" | "pending" | "success" | "error";

const STATUS_STYLE: Record<string, string> = {
  OPEN:      "background:#e8f5ec;color:#1a5c2a",
  ACCEPTED:  "background:#fef3e2;color:#7a4510",
  SUBMITTED: "background:#fef3e2;color:#7a4510",
  APPROVED:  "background:#e8eef8;color:#1a2e6b",
  DISPUTED:  "background:#fde8e8;color:#7a1515",
  RESOLVED:  "background:#e8eef8;color:#1a2e6b",
  CANCELLED: "background:#f2f0eb;color:#888",
};

export default function JobDetail({ job, userAddress, onUpdate, actions, modeLabel }: Props) {
  const [txState, setTxState] = useState<TxState>("idle");
  const [txMsg, setTxMsg] = useState("");
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitNote, setSubmitNote] = useState("");
  const [showFull, setShowFull] = useState(false);

  const isClient     = userAddress?.toLowerCase() === job.client?.toLowerCase();
  const isFreelancer = userAddress?.toLowerCase() === job.freelancer?.toLowerCase();

  const tx = async (label: string, fn: () => Promise<any>) => {
    setTxState("pending"); setTxMsg(label);
    try {
      await fn();
      setTxState("success"); setTxMsg("Done");
      onUpdate();
      setTimeout(() => setTxState("idle"), 3000);
    } catch (e: any) {
      setTxState("error"); setTxMsg(e.message?.slice(0, 90) || "Transaction failed");
      setTimeout(() => setTxState("idle"), 6000);
    }
  };

  const briefText = job.brief ?? "";
  const briefPreview = briefText.slice(0, 220);
  const briefLong = briefText.length > 220;

  const statusStyle = Object.fromEntries(
    (STATUS_STYLE[job.status] ?? "background:#f2f0eb;color:#888").split(";").map((s) => s.split(":"))
  );

  const section = (label: string, content: React.ReactNode) => (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontSize: "11px", color: "#999", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "7px" }}>
        {label}
      </div>
      {content}
    </div>
  );

  const divider = <hr style={{ border: "none", borderTop: "1px solid #f0ede8", margin: "20px 0" }} />;

  const mono = { fontFamily: "'Geist Mono', monospace" } as React.CSSProperties;

  return (
    <div style={{ padding: "24px 28px", maxWidth: "680px" }}>

      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 500, color: "#1a1a18", lineHeight: 1.3, marginBottom: "10px", letterSpacing: "-0.02em" }}>
          {job.title}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ ...mono, fontSize: "13px" }}>{GEN(job.budget)} locked</span>
          <span style={{ color: "#ddd" }}>·</span>
          <span style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "4px", fontWeight: 500, ...statusStyle }}>
            {STATUS_LABEL[job.status] ?? job.status}
          </span>
          {isClient && <span style={{ fontSize: "11px", color: "#bbb" }}>you posted this</span>}
          {isFreelancer && <span style={{ fontSize: "11px", color: "#1a5c2a" }}>you're working on this</span>}
          <span style={{ marginLeft: "auto", fontSize: "11px", color: "#bbb" }}>#{job.id}</span>
        </div>
      </div>

      {/* Brief */}
      {section("Brief",
        <div style={{ fontSize: "13px", color: "#333", lineHeight: 1.65 }}>
          {showFull ? briefText : briefPreview}
          {briefLong && !showFull && "…"}
          {briefLong && (
            <button
              onClick={() => setShowFull((v) => !v)}
              style={{ fontSize: "12px", color: "#888", background: "none", border: "none", marginLeft: "6px", cursor: "pointer" }}
            >
              {showFull ? "less" : "more"}
            </button>
          )}
        </div>
      )}

      {divider}

      {/* Criteria */}
      {section("Acceptance criteria",
        <>
          <div style={{
            background: "#fff", border: "1px solid #e5e3de", borderRadius: "6px",
            padding: "12px 14px", fontSize: "13px", color: "#333", lineHeight: 1.65,
            whiteSpace: "pre-wrap",
          }}>
            {job.criteria}
          </div>
          <div style={{ fontSize: "11px", color: "#bbb", marginTop: "6px" }}>
            The contract uses these criteria when reviewing a disputed submission.
          </div>
        </>
      )}

      {/* Submitted work */}
      {job.submission_url && <>
        {divider}
        {section("Submitted work",
          <>
            <a
              href={job.submission_url}
              target="_blank"
              rel="noopener"
              style={{ ...mono, fontSize: "12px", color: "#1a1a18", borderBottom: "1px solid #e5e3de", paddingBottom: "1px", wordBreak: "break-all" }}
            >
              {job.submission_url}
            </a>
            {job.submission_note && (
              <div style={{ fontSize: "12px", color: "#666", marginTop: "8px", lineHeight: 1.6 }}>
                {job.submission_note}
              </div>
            )}
          </>
        )}
      </>}

      {/* AI verdict */}
      {job.status === "RESOLVED" && job.verdict && <>
        {divider}
        <div style={{
          background: job.verdict === "release" ? "#f0f8f0" : job.verdict === "refund" ? "#fef5f5" : "#fffbf0",
          border: `1px solid ${job.verdict === "release" ? "#d4e8d4" : job.verdict === "refund" ? "#f5d4d4" : "#e8dfa8"}`,
          borderRadius: "6px", padding: "14px 16px", marginBottom: "20px",
        }}>
          <div style={{ fontSize: "10px", color: "#999", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "5px" }}>
            Dispute result
          </div>
          <div style={{
            fontSize: "18px", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "8px",
            color: job.verdict === "release" ? "#1a5c2a" : job.verdict === "refund" ? "#7a1515" : "#7a5c1a",
          }}>
            {job.verdict === "release" ? "Payment released to freelancer" :
             job.verdict === "refund"  ? "Refunded to client" :
             `Partial — ${job.partial_pct}% to freelancer`}
          </div>
          <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.65 }}>{job.verdict_reason}</div>
          <div style={{ fontSize: "11px", color: "#bbb", marginTop: "8px" }}>
            {modeLabel}
          </div>
        </div>
      </>}

      {divider}

      {/* How dispute resolution works */}
      {section("How dispute resolution works",
        <div style={{ background: "#fff", border: "1px solid #e5e3de", borderRadius: "6px", padding: "12px 14px" }}>
          <div style={{ fontSize: "11px", color: "#bbb", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>
            If a dispute is raised
          </div>
          {[
            ["Contract calls gl.get_webpage(url)", "reads the submitted URL directly from the public web"],
            ["Content goes to 5 LLM validators", "each compares it with the acceptance criteria"],
            ["Optimistic Democracy vote", "the network picks a final result: release, refund, or partial split"],
            ["Funds move automatically", "the payout follows the result without a moderator"],
          ].map(([step, desc], i) => (
            <div key={i} style={{ display: "flex", gap: "10px", padding: "4px 0", alignItems: "flex-start" }}>
              <span style={{ ...mono, fontSize: "10px", color: "#ccc", minWidth: "16px", paddingTop: "2px" }}>
                {i + 1}
              </span>
              <div>
                <span style={{ fontSize: "12px", color: "#1a1a18" }}>{step}</span>
                <span style={{ fontSize: "12px", color: "#999" }}> — {desc}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ACTIONS ── */}

      {/* Freelancer: accept open job */}
      {job.status === "OPEN" && !isClient && userAddress && (
        <button
          onClick={() => tx("Accepting job…", () => actions.acceptJob(userAddress, job.id))}
          disabled={txState === "pending"}
          style={{
            width: "100%", fontSize: "13px", fontWeight: 500,
            background: "#1a1a18", color: "#fff", border: "none",
            padding: "10px 16px", borderRadius: "7px", marginBottom: "8px",
            opacity: txState === "pending" ? 0.5 : 1,
          }}
        >
          Accept this job
        </button>
      )}

      {/* Client: cancel open job */}
      {job.status === "OPEN" && isClient && (
        <button
          onClick={() => tx("Cancelling…", () => actions.cancelJob(userAddress!, job.id))}
          disabled={txState === "pending"}
          style={{
            width: "100%", fontSize: "13px",
            background: "#fff", color: "#c0392b",
            border: "1px solid #f5cac7", padding: "9px 16px", borderRadius: "7px", marginBottom: "8px",
            opacity: txState === "pending" ? 0.5 : 1,
          }}
        >
          Cancel job and reclaim funds
        </button>
      )}

      {/* Freelancer: submit work */}
      {job.status === "ACCEPTED" && isFreelancer && (
        <div style={{ marginBottom: "8px" }}>
          <div style={{ fontSize: "11px", color: "#999", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
            Submit your work
          </div>
          <input
            value={submitUrl}
            onChange={(e) => setSubmitUrl(e.target.value)}
            placeholder="https://github.com/yourrepo or deployed URL"
            style={{
              width: "100%", ...mono, fontSize: "12px", border: "1px solid #e0ddd8",
              borderRadius: "6px", padding: "8px 10px", color: "#1a1a18",
              background: "#fff", outline: "none", marginBottom: "6px",
            }}
          />
          <textarea
            value={submitNote}
            onChange={(e) => setSubmitNote(e.target.value)}
            placeholder="Short note for the client (optional)"
            rows={2}
            style={{
              width: "100%", fontFamily: "inherit", fontSize: "13px",
              border: "1px solid #e0ddd8", borderRadius: "6px", padding: "8px 10px",
              color: "#1a1a18", background: "#fff", outline: "none",
              resize: "none", lineHeight: 1.55, marginBottom: "8px", display: "block",
            }}
          />
          <button
            onClick={() => {
              if (!submitUrl.startsWith("http")) {
                setTxState("error"); setTxMsg("Must be a valid URL starting with http");
                setTimeout(() => setTxState("idle"), 4000); return;
              }
              tx("Submitting…", () => actions.submitWork(userAddress!, job.id, submitUrl, submitNote));
            }}
            disabled={txState === "pending"}
            style={{
              width: "100%", fontSize: "13px", fontWeight: 500,
              background: "#1a1a18", color: "#fff", border: "none",
              padding: "10px 16px", borderRadius: "7px",
              opacity: txState === "pending" ? 0.5 : 1,
            }}
          >
            Submit work
          </button>
        </div>
      )}

      {/* Client: approve or dispute */}
      {job.status === "SUBMITTED" && isClient && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <button
            onClick={() => tx("Approving…", () => actions.approveWork(userAddress!, job.id))}
            disabled={txState === "pending"}
            style={{
              flex: 1, fontSize: "13px", fontWeight: 500,
              background: "#1a1a18", color: "#fff", border: "none",
              padding: "10px 16px", borderRadius: "7px",
              opacity: txState === "pending" ? 0.5 : 1,
            }}
          >
            Approve and release payment
          </button>
          <button
            onClick={() => tx("Raising dispute…", () => actions.raiseDispute(userAddress!, job.id))}
            disabled={txState === "pending"}
            style={{
              flex: 1, fontSize: "13px",
              background: "#fff", color: "#c0392b",
              border: "1px solid #f5cac7", padding: "10px 16px", borderRadius: "7px",
              opacity: txState === "pending" ? 0.5 : 1,
            }}
          >
            Raise dispute
          </button>
        </div>
      )}

      {/* AI resolution */}
      {job.status === "DISPUTED" && userAddress && (
        <div style={{ marginBottom: "8px" }}>
          <div style={{
            background: "#fffbf0", border: "1px solid #e8dfa8",
            borderRadius: "6px", padding: "12px 14px", marginBottom: "8px",
            fontSize: "12px", color: "#7a5c1a", lineHeight: 1.65,
          }}>
            The contract will fetch{" "}
            <span style={{ ...mono, fontSize: "11px", color: "#1a1a18", wordBreak: "break-all" }}>
              {job.submission_url}
            </span>{" "}
            live on-chain and evaluate it against the acceptance criteria. This takes about 1–2 minutes.
          </div>
          <button
            onClick={() => tx(
              "Fetching submission URL and waiting for consensus…",
              () => actions.resolveDispute(userAddress!, job.id)
            )}
            disabled={txState === "pending"}
            style={{
              width: "100%", fontSize: "13px", fontWeight: 500,
              background: "#1a1a18", color: "#fff", border: "none",
              padding: "10px 16px", borderRadius: "7px",
              opacity: txState === "pending" ? 0.5 : 1,
            }}
          >
            {txState === "pending" ? txMsg : "Resolve dispute"}
          </button>
        </div>
      )}

      {/* Tx feedback */}
      {txState !== "idle" && (
        <div style={{
          fontSize: "12px", padding: "8px 12px", borderRadius: "6px", marginBottom: "8px",
          background: txState === "success" ? "#f0f8f0" : txState === "error" ? "#fde8e8" : "#fef3e2",
          color:      txState === "success" ? "#1a5c2a" : txState === "error" ? "#7a1515" : "#7a4510",
          border:     `1px solid ${txState === "success" ? "#d4e8d4" : txState === "error" ? "#f5cac7" : "#e8c87a"}`,
        }}>
          {txMsg}
        </div>
      )}

      {divider}

      {/* Footer metadata */}
      <div style={{ fontSize: "11px", color: "#bbb", display: "flex", flexDirection: "column", gap: "4px" }}>
        <div>
          Client: <span style={mono}>{job.client}</span>
        </div>
        {job.freelancer && (
          <div>
            Freelancer: <span style={mono}>{job.freelancer}</span>
          </div>
        )}
        <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
          <span>{job.deadline_days} day{job.deadline_days !== 1 ? "s" : ""} to deliver</span>
          <a
            href={`${EXPLORER_URL}`}
            target="_blank"
            rel="noopener"
            style={{ color: "#bbb", borderBottom: "1px solid #e5e3de" }}
          >
            View on explorer
          </a>
        </div>
      </div>
    </div>
  );
}
