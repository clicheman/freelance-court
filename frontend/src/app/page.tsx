"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import JobDetail from "@/components/JobDetail";
import PostJobModal from "@/components/PostJobModal";
import { demoActions, DEMO_ACTORS, getDemoJobs, resetDemoJobs } from "@/lib/demo";
import {
  acceptJob,
  approveWork,
  cancelJob,
  CONTRACT_ADDRESS,
  createJob,
  GEN,
  getAllJobs,
  raiseDispute,
  resolveDispute,
  STATUS_LABEL,
  submitWork,
} from "@/lib/genlayer";
import type { JobActionApi, JobRecord } from "@/lib/types";
import { useWallet } from "@/lib/useWallet";

type AppMode = "demo" | "live";

const MODE_STORAGE_KEY = "fc_app_mode";
const ACTOR_STORAGE_KEY = "fc_demo_actor";

const STATUS_STYLE: Record<string, string> = {
  OPEN: "background:#e8f5ec;color:#1a5c2a",
  ACCEPTED: "background:#fef3e2;color:#7a4510",
  SUBMITTED: "background:#fef3e2;color:#7a4510",
  APPROVED: "background:#e8eef8;color:#1a2e6b",
  DISPUTED: "background:#fde8e8;color:#7a1515",
  RESOLVED: "background:#e8eef8;color:#1a2e6b",
  CANCELLED: "background:#f2f0eb;color:#888",
};

const LIVE_ACTIONS: JobActionApi = {
  createJob,
  acceptJob,
  submitWork,
  approveWork,
  raiseDispute,
  resolveDispute,
  cancelJob,
};

const MODE_LABELS: Record<AppMode, string> = {
  demo: "Local demo flow for judge walkthroughs",
  live: "Live Bradbury flow against the deployed contract",
};

function timeAgo(ts: number) {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Home() {
  const { address, state, error, connect, disconnect, switchNetwork } = useWallet();
  const [mode, setMode] = useState<AppMode>("demo");
  const [demoActor, setDemoActor] = useState<string>(DEMO_ACTORS[0].address);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<JobRecord | null>(null);
  const [showPost, setShowPost] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "mine" | "history">("all");
  const [tick, setTick] = useState(0);
  const [lastLoadError, setLastLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedMode = window.localStorage.getItem(MODE_STORAGE_KEY) as AppMode | null;
    const savedActor = window.localStorage.getItem(ACTOR_STORAGE_KEY);
    if (savedMode === "demo" || savedMode === "live") setMode(savedMode);
    if (savedActor && DEMO_ACTORS.some((actor) => actor.address === savedActor)) setDemoActor(savedActor);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACTOR_STORAGE_KEY, demoActor);
  }, [demoActor]);

  const activeAddress = mode === "demo" ? demoActor : state === "connected" ? address : null;
  const missing = CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000";
  const actions = mode === "demo" ? demoActions : LIVE_ACTIONS;
  const canPost = mode === "demo" || (state === "connected" && !missing);

  const load = useCallback(() => {
    const fetchJobs = mode === "demo" ? getDemoJobs : getAllJobs;

    if (mode === "live" && missing) {
      setLoading(false);
      setLastLoadError("Set NEXT_PUBLIC_CONTRACT_ADDRESS to enable live Bradbury mode.");
      return;
    }

    setLoading(true);
    setLastLoadError(null);

    fetchJobs()
      .then((list) => {
        const normalized = list as JobRecord[];
        setJobs(normalized);
        if (normalized.length === 0) {
          setSelected(null);
          return;
        }
        const refreshed = normalized.find((job) => job.id === selected?.id);
        setSelected(refreshed ?? normalized[0]);
      })
      .catch((loadError: any) => {
        setJobs([]);
        if (mode === "live") {
          setLastLoadError(loadError?.message || "Failed to read from Bradbury.");
        }
      })
      .finally(() => setLoading(false));
  }, [missing, mode, selected?.id]);

  useEffect(() => {
    load();
  }, [load, tick]);

  const refresh = () => setTick((value) => value + 1);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (activeTab === "mine") return job.client === activeAddress || job.freelancer === activeAddress;
      if (activeTab === "history") return ["APPROVED", "RESOLVED", "CANCELLED"].includes(job.status);
      return !["APPROVED", "RESOLVED", "CANCELLED"].includes(job.status);
    });
  }, [activeAddress, activeTab, jobs]);

  const currentActor = DEMO_ACTORS.find((actor) => actor.address === demoActor) ?? DEMO_ACTORS[0];

  const emptyDetail = (
    <div style={{ padding: "36px 32px", maxWidth: "760px" }}>
      <div style={{
        background: "linear-gradient(135deg, #f3efe6 0%, #faf8f3 100%)",
        border: "1px solid #e8e0d1",
        borderRadius: "16px",
        padding: "28px",
        boxShadow: "0 20px 50px rgba(28, 24, 18, 0.06)",
      }}>
        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#8a7a63", marginBottom: "10px" }}>
          Hackathon build
        </div>
        <h1 style={{ fontSize: "32px", lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "12px", maxWidth: "560px" }}>
          Freelance escrow with onchain dispute review.
        </h1>
        <p style={{ fontSize: "15px", lineHeight: 1.7, color: "#5b5142", maxWidth: "620px", marginBottom: "22px" }}>
          Clients lock funds in escrow, freelancers submit a public URL, and disputes are resolved by a GenLayer Intelligent Contract
          that evaluates the live deliverable against plain-English acceptance criteria.
        </p>
        <p style={{ fontSize: "13px", lineHeight: 1.7, color: "#7b6f5d", maxWidth: "620px", marginBottom: "18px" }}>
          The scope is intentionally narrow: one escrow flow, one dispute flow, and one contract path that only makes sense on GenLayer.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "18px" }}>
          {[
            "Optimistic Democracy",
            "Equivalence Principle",
            "gl.get_webpage()",
            "Escrow + partial payout",
          ].map((item) => (
            <span
              key={item}
              style={{
                fontSize: "12px",
                padding: "6px 10px",
                borderRadius: "999px",
                background: "#fff",
                border: "1px solid #e6ddd0",
                color: "#4d4436",
              }}
            >
              {item}
            </span>
          ))}
        </div>
        <div style={{ fontSize: "12px", color: "#7b6f5d", lineHeight: 1.7 }}>
          {mode === "demo"
            ? "Demo mode is active, so the full flow can be shown without depending on Bradbury availability."
            : `Live mode points to ${CONTRACT_ADDRESS}. If Bradbury stalls, switch back to demo mode and continue from there.`}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateRows: "56px 1fr", overflow: "hidden" }}>
      {mode === "live" && state === "wrong_network" && (
        <div style={{
          position: "fixed",
          top: 56,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "#fde8e8",
          borderBottom: "1px solid #f5cac7",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "12px",
        }}>
          <span style={{ color: "#7a1515" }}>Wrong network.</span>
          <span style={{ color: "#b07070" }}>Switch to GenLayer Testnet Bradbury.</span>
          <button
            onClick={switchNetwork}
            style={{
              marginLeft: "auto",
              fontSize: "12px",
              color: "#7a1515",
              background: "none",
              border: "1px solid #f5cac7",
              padding: "3px 10px",
              borderRadius: "4px",
            }}
          >
            Switch network
          </button>
        </div>
      )}

      <nav style={{
        background: "#fffdf9",
        borderBottom: "1px solid #e8e0d1",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: "18px",
      }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a18", letterSpacing: "-0.02em" }}>Freelance Court</div>
          <div style={{ fontSize: "11px", color: "#8f8371" }}>Freelance escrow for the GenLayer Bradbury hackathon</div>
        </div>

        <div style={{ display: "flex", gap: "6px", marginLeft: "8px" }}>
          {(["demo", "live"] as const).map((candidate) => (
            <button
              key={candidate}
              onClick={() => setMode(candidate)}
              style={{
                fontSize: "12px",
                padding: "6px 12px",
                borderRadius: "999px",
                border: candidate === mode ? "1px solid #1a1a18" : "1px solid #e3dccf",
                background: candidate === mode ? "#1a1a18" : "#fff",
                color: candidate === mode ? "#fff" : "#5c5347",
                fontWeight: 500,
              }}
            >
              {candidate === "demo" ? "Interactive demo" : "Live Bradbury"}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            fontSize: "11px",
            fontFamily: "'Geist Mono', monospace",
            color: "#6d614d",
            background: "#f3ede2",
            padding: "4px 8px",
            borderRadius: "6px",
          }}>
            {mode === "demo" ? "Demo fallback" : "Bradbury testnet"}
          </span>

          {mode === "demo" ? (
            <>
              <select
                value={demoActor}
                onChange={(event) => setDemoActor(event.target.value)}
                style={{
                  fontSize: "12px",
                  border: "1px solid #ddd4c5",
                  borderRadius: "6px",
                  padding: "6px 10px",
                  background: "#fff",
                  color: "#3c342a",
                }}
              >
                {DEMO_ACTORS.map((actor) => (
                  <option key={actor.address} value={actor.address}>
                    {actor.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  resetDemoJobs();
                  refresh();
                }}
                style={{
                  fontSize: "12px",
                  background: "#fff",
                  color: "#5c5347",
                  border: "1px solid #ddd4c5",
                  padding: "6px 10px",
                  borderRadius: "6px",
                }}
              >
                Reset demo
              </button>
            </>
          ) : (
            <>
              {state === "disconnected" && (
                <button
                  onClick={connect}
                  style={{
                    fontSize: "12px",
                    background: "#1a1a18",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "6px",
                  }}
                >
                  Connect wallet
                </button>
              )}
              {state === "connecting" && <span style={{ fontSize: "12px", color: "#888" }}>Connecting…</span>}
              {state === "wrong_network" && (
                <button
                  onClick={switchNetwork}
                  style={{
                    fontSize: "12px",
                    background: "#fde8e8",
                    color: "#7a1515",
                    border: "1px solid #f5cac7",
                    padding: "6px 12px",
                    borderRadius: "6px",
                  }}
                >
                  Switch network
                </button>
              )}
              {state === "connected" && address && (
                <button
                  onClick={disconnect}
                  title="Disconnect wallet"
                  style={{
                    fontSize: "12px",
                    fontFamily: "'Geist Mono', monospace",
                    background: "#f3ede2",
                    color: "#1a1a18",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "6px",
                  }}
                >
                  {address.slice(0, 6)}…{address.slice(-4)}
                </button>
              )}
              {error && <span style={{ fontSize: "11px", color: "#c0392b", maxWidth: "180px" }}>{error}</span>}
            </>
          )}
        </div>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", overflow: "hidden" }}>
        <aside style={{
          borderRight: "1px solid #e8e0d1",
          background: "#fffdf9",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{ padding: "16px", borderBottom: "1px solid #eee5d9" }}>
            <div style={{
              background: "linear-gradient(180deg, #fff 0%, #f8f4ed 100%)",
              border: "1px solid #eadfce",
              borderRadius: "12px",
              padding: "14px",
            }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#8f8068", marginBottom: "6px" }}>
                Current mode
              </div>
              <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "6px", letterSpacing: "-0.02em" }}>
                {mode === "demo" ? "Interactive walkthrough" : "Live contract view"}
              </div>
              <div style={{ fontSize: "12px", color: "#6b5f4f", lineHeight: 1.65 }}>
                {MODE_LABELS[mode]}
              </div>
              {mode === "demo" && (
                <div style={{ fontSize: "12px", color: "#8f8068", marginTop: "10px" }}>
                  Active actor: <span style={{ color: "#2c241b" }}>{currentActor.label}</span>
                </div>
              )}
              {mode === "live" && (
                <div style={{ fontSize: "11px", color: "#8f8068", marginTop: "10px", wordBreak: "break-all" }}>
                  Contract: {CONTRACT_ADDRESS}
                </div>
              )}
            </div>
          </div>

          <div style={{
            padding: "10px 14px",
            borderBottom: "1px solid #f0ede8",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={{ fontSize: "11px", color: "#999", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                onClick={refresh}
                style={{ fontSize: "11px", color: "#8f8068", background: "none", border: "none" }}
              >
                Refresh
              </button>
              {canPost && (
                <button
                  onClick={() => setShowPost(true)}
                  style={{
                    fontSize: "11px",
                    background: "#1a1a18",
                    color: "#fff",
                    border: "none",
                    padding: "4px 10px",
                    borderRadius: "5px",
                  }}
                >
                  Post job
                </button>
              )}
            </div>
          </div>

          <div style={{ padding: "10px 14px", borderBottom: "1px solid #f4efe6", display: "flex", gap: "4px" }}>
            {(["all", "mine", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  border: "none",
                  background: activeTab === tab ? "#efe8db" : "transparent",
                  color: activeTab === tab ? "#1a1a18" : "#888",
                  fontWeight: activeTab === tab ? 500 : 400,
                }}
              >
                {tab === "all" ? "Open jobs" : tab === "mine" ? "My role" : "History"}
              </button>
            ))}
          </div>

          {mode === "live" && lastLoadError && (
            <div style={{ padding: "14px" }}>
              <div style={{
                background: "#fff5f5",
                border: "1px solid #f1d4d4",
                borderRadius: "10px",
                padding: "12px",
                fontSize: "12px",
                color: "#7a3434",
                lineHeight: 1.6,
              }}>
                Bradbury read/write path is unstable right now.
                <div style={{ marginTop: "6px", color: "#9d5e5e" }}>{lastLoadError}</div>
                <button
                  onClick={() => setMode("demo")}
                  style={{
                    marginTop: "10px",
                    fontSize: "12px",
                    background: "#7a3434",
                    color: "#fff",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "6px",
                  }}
                >
                  Switch to interactive demo
                </button>
              </div>
            </div>
          )}

          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <div style={{ padding: "16px 14px", fontSize: "12px", color: "#8f8068" }}>Loading jobs…</div>
            ) : filteredJobs.length === 0 ? (
              <div style={{ padding: "16px 14px", fontSize: "12px", color: "#8f8068", lineHeight: 1.7 }}>
                No jobs in this view.
                {mode === "demo" && (
                  <button
                    onClick={() => {
                      resetDemoJobs();
                      refresh();
                    }}
                    style={{
                      display: "block",
                      marginTop: "10px",
                      fontSize: "12px",
                      background: "#1a1a18",
                      color: "#fff",
                      border: "none",
                      padding: "7px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    Reload demo dataset
                  </button>
                )}
              </div>
            ) : (
              filteredJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setSelected(job)}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f4efe6",
                    cursor: "pointer",
                    background: selected?.id === job.id ? "#f6f1e8" : "transparent",
                    borderLeft: selected?.id === job.id ? "2px solid #1a1a18" : "2px solid transparent",
                    paddingLeft: selected?.id === job.id ? "12px" : "14px",
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a18", marginBottom: "5px", lineHeight: 1.35 }}>
                    {job.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#7f7362", lineHeight: 1.55, marginBottom: "8px" }}>
                    {job.brief.slice(0, 84)}{job.brief.length > 84 ? "…" : ""}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: "11px", color: "#1a1a18" }}>
                      {GEN(job.budget)}
                    </span>
                    <span style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "999px",
                      fontWeight: 600,
                      ...(Object.fromEntries((STATUS_STYLE[job.status] ?? "background:#f2f0eb;color:#888").split(";").map((s) => s.split(":")))),
                    }}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </span>
                    <span style={{ fontSize: "11px", color: "#b8aa95", marginLeft: "auto" }}>
                      {timeAgo(job.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        <main style={{ overflowY: "auto", background: "radial-gradient(circle at top left, #fbf7ef 0%, #fafaf9 38%, #f7f6f3 100%)" }}>
          {selected ? (
            <JobDetail
              job={selected}
              userAddress={activeAddress}
              onUpdate={refresh}
              actions={actions}
              modeLabel={MODE_LABELS[mode]}
            />
          ) : (
            emptyDetail
          )}
        </main>
      </div>

      {showPost && activeAddress && (
        <PostJobModal
          userAddress={activeAddress}
          onClose={() => setShowPost(false)}
          onCreated={() => {
            setShowPost(false);
            refresh();
          }}
          createJobFn={actions.createJob}
          modeLabel={MODE_LABELS[mode]}
        />
      )}
    </div>
  );
}
