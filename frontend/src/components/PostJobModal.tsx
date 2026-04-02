"use client";
import { useState } from "react";
import type { JobActionApi } from "@/lib/types";

interface Props {
  userAddress: string;
  onClose: () => void;
  onCreated: () => void;
  createJobFn: JobActionApi["createJob"];
  modeLabel: string;
}

const TEMPLATES = [
  {
    title: "Build a landing page",
    brief: "Design and build a responsive landing page for a SaaS product. Include: hero section with headline and CTA button, features section (3 cards), pricing section (3 tiers), and a footer. Use a clean, modern design. Stack: HTML, CSS, vanilla JS. Must be mobile-responsive.",
    criteria: "All four sections present (hero, features, pricing, footer)\nVisually clean and professional\nResponsive on mobile\nAt least one CTA button\nAccessible at the submitted URL",
    budget: "1.0",
    days: 7,
  },
  {
    title: "Write API documentation",
    brief: "Write comprehensive API documentation for a REST API with 5 endpoints. Include request/response schemas, JSON examples, parameter descriptions, authentication, and error codes. Use OpenAPI or clear Markdown.",
    criteria: "All 5 endpoints documented\nRequest and response schemas included\nJSON examples for each endpoint\nError codes section\nReadable and well-structured",
    budget: "0.8",
    days: 5,
  },
  {
    title: "Logo and brand identity",
    brief: "Design a logo and basic brand identity for a tech startup. Deliverables: SVG logo (light and dark versions), color palette with hex codes, font recommendation, and a short brand usage guide. Share via Figma, GitHub, or Google Drive.",
    criteria: "SVG logo accessible via URL\nLight and dark versions included\nColor palette with hex codes\nFont recommendation\nBasic brand usage notes",
    budget: "1.5",
    days: 10,
  },
];

export default function PostJobModal({ userAddress, onClose, onCreated, createJobFn, modeLabel }: Props) {
  const [title, setTitle]       = useState("");
  const [brief, setBrief]       = useState("");
  const [criteria, setCriteria] = useState("");
  const [budget, setBudget]     = useState("1.0");
  const [days, setDays]         = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");

  const apply = (t: (typeof TEMPLATES)[0]) => {
    setTitle(t.title); setBrief(t.brief); setCriteria(t.criteria);
    setBudget(t.budget); setDays(t.days);
  };

  const submit = async () => {
    if (!title.trim() || !brief.trim() || !criteria.trim()) {
      setError("All fields are required."); return;
    }
    const b = parseFloat(budget);
    if (isNaN(b) || b <= 0) { setError("Invalid budget."); return; }
    setSubmitting(true); setError("");
    try {
      await createJobFn(userAddress, title, brief, criteria, days, BigInt(Math.round(b * 1e18)));
      onCreated();
    } catch (e: any) {
      setError(e.message?.slice(0, 100) || "Transaction failed.");
      setSubmitting(false);
    }
  };

  const label = (text: string, note?: string) => (
    <div style={{ marginBottom: "6px" }}>
      <span style={{ fontSize: "11px", color: "#999", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {text}
      </span>
      {note && <span style={{ fontSize: "11px", color: "#bbb", marginLeft: "6px" }}>{note}</span>}
    </div>
  );

  const inputStyle: React.CSSProperties = {
    width: "100%", fontFamily: "inherit", fontSize: "13px",
    border: "1px solid #e0ddd8", borderRadius: "6px",
    padding: "8px 10px", color: "#1a1a18", background: "#fff",
    outline: "none", lineHeight: 1.5,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(26,26,24,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <div style={{
        background: "#fff", borderRadius: "8px", border: "1px solid #e5e3de",
        width: "100%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid #f0ede8",
        }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 500, color: "#1a1a18" }}>Post a job</div>
            <div style={{ fontSize: "11px", color: "#999", marginTop: "2px" }}>{modeLabel}</div>
          </div>
          <button onClick={onClose} style={{ fontSize: "16px", color: "#bbb", background: "none", border: "none", lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ padding: "18px" }}>

          {/* Templates */}
          <div style={{ marginBottom: "18px" }}>
            {label("Quick start")}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {TEMPLATES.map((t, i) => (
                <button
                  key={i}
                  onClick={() => apply(t)}
                  style={{
                    textAlign: "left", fontSize: "12px", color: "#555",
                    background: "#fafaf9", border: "1px solid #eee",
                    borderRadius: "5px", padding: "7px 10px", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {t.title} <span style={{ color: "#bbb" }}>— {t.budget} GEN, {t.days}d</span>
                </button>
              ))}
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #f0ede8", marginBottom: "18px" }} />

          {/* Title */}
          <div style={{ marginBottom: "14px" }}>
            {label("Title")}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you need done?"
              style={inputStyle}
            />
          </div>

          {/* Brief */}
          <div style={{ marginBottom: "14px" }}>
            {label("Brief", "describe the work in plain English")}
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="Describe what you need, the stack or tools, and any constraints."
              style={{ ...inputStyle, resize: "none" }}
            />
          </div>

          {/* Criteria */}
          <div style={{ marginBottom: "14px" }}>
            {label("Acceptance criteria", "the AI evaluates submitted work against this")}
            <textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              rows={4}
              placeholder={"List specific requirements, one per line.\nBe clear — the AI arbitrator uses this text exactly."}
              style={{ ...inputStyle, resize: "none" }}
            />
          </div>

          {/* Budget + days */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
            <div>
              {label("Budget (GEN)", "locked in escrow")}
              <input
                type="number" min="0.01" step="0.1"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              {label("Days to deliver")}
              <input
                type="number" min="1" max="90"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Info */}
          <div style={{
            background: "#fafaf9", border: "1px solid #f0ede8", borderRadius: "6px",
            padding: "10px 12px", marginBottom: "14px", fontSize: "12px", color: "#888", lineHeight: 1.65,
          }}>
            If a dispute is raised, the contract checks the submitted URL against your acceptance criteria and handles the payout. {modeLabel}
          </div>

          {error && (
            <div style={{
              fontSize: "12px", color: "#7a1515", background: "#fde8e8",
              border: "1px solid #f5cac7", borderRadius: "5px", padding: "8px 10px", marginBottom: "12px",
            }}>
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting}
            style={{
              width: "100%", fontSize: "13px", fontWeight: 500,
              background: submitting ? "#888" : "#1a1a18", color: "#fff",
              border: "none", padding: "10px 16px", borderRadius: "7px",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Posting job…" : "Post job"}
          </button>

        </div>
      </div>
    </div>
  );
}
