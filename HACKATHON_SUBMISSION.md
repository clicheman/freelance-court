# Freelance Court — Hackathon Submission Kit

## One-line summary

Freelance Court is a freelance escrow app where disputes are resolved onchain by a GenLayer Intelligent Contract. The contract reads the submitted deliverable URL and decides whether to release, refund, or split payment.

## Why this fits GenLayer

- Uses an Intelligent Contract on Bradbury.
- Uses Optimistic Democracy for non-deterministic consensus.
- Uses the Equivalence Principle in the dispute-resolution path.
- Uses `gl.get_webpage()` to inspect live deliverables from the public web.
- Uses `gl.exec_prompt()` to evaluate submitted work against plain-English acceptance criteria.

## Recommended tracks

- AI Legal Frameworks
- Performance-Based Payments

## Product scope

This submission is intentionally narrow. It focuses on one core primitive:
escrow plus dispute resolution over a submitted URL.

The goal is not to look broad or complicated. The goal is to show a concrete use
case where GenLayer matters because the contract has to evaluate real web content
against natural-language requirements.

## Core user flow

1. Client posts a job and locks GEN in escrow.
2. Freelancer accepts the job.
3. Freelancer submits a public URL for the deliverable.
4. Client either approves payment or raises a dispute.
5. The contract fetches the submitted URL, evaluates it against the brief and criteria, and distributes funds automatically.

## Demo plan

### Preferred demo

- Open the app in `Interactive demo` mode.
- Use the actor switcher to move between client and freelancer roles.
- Show:
  - accepting an open job,
  - submitting a URL,
  - raising a dispute,
  - resolving the dispute with the built-in AI arbitration simulation.

### Live mode

- Switch to `Live Bradbury`.
- Show the deployed contract address and wallet/network integration.
- If Bradbury writes are unstable, return to `Interactive demo` and continue the product walkthrough there.

## What matters in judging

- This is not just a marketplace clone; the core primitive is dispute resolution over real web content.
- Acceptance criteria are written in natural language, which is where GenLayer becomes meaningfully different from deterministic chains.
- The scope is deliberate: one serious contract flow, one clear demo, and no filler systems added just to make the project look larger.
- The product can evolve into a reusable arbitration layer for other marketplaces and escrow systems.

## Current contract path

- Contract source: `contracts/freelance_court.py`
- Frontend app: `frontend/`
- Deploy script: `deploy/deployScript.ts`
- Seed script: `deploy/seedJobs.ts`

## Known Bradbury note

Bradbury testnet can intermittently leave write transactions in empty `PENDING` or `PROPOSING` states with no validator progress. The app therefore ships with an interactive demo path so the full product can still be evaluated reliably during judging.
