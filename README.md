# Freelance Court — Dispute Resolution on GenLayer

Freelance escrow where disputes are resolved by an Intelligent Contract.
No marketplace moderation layer required.

The contract fetches submitted work URLs live on-chain via `gl.get_webpage()`,
passes content to 5 LLM validators with acceptance criteria, and distributes funds
automatically via Optimistic Democracy.

## Hackathon-ready demo mode

The repo now includes an `Interactive demo` frontend mode alongside `Live Bradbury`.
Use demo mode for judge walkthroughs when Bradbury testnet is unstable:

- no wallet required
- seeded sample jobs across multiple states
- full click-through for accept, submit, approve, dispute, and AI resolution
- live mode still points at the deployed GenLayer contract

For the submission kit, see [HACKATHON_SUBMISSION.md](./HACKATHON_SUBMISSION.md).

---

## Project scope

This project stays narrow on purpose. It does one hard thing:
resolve a freelance payment dispute by reading a submitted URL and comparing it
against natural-language acceptance criteria on GenLayer.

It does not try to fake depth with extra token mechanics, governance, reputation,
or marketplace sprawl. The focus is the contract path, the dispute workflow, and
the reason this needs GenLayer rather than a deterministic chain.

---

## Why this fits Bradbury

**Covers two prize tracks:** AI Legal Frameworks + Performance-Based Payments.

**Uses natural-language requirements:** The brief can say
*"build a responsive landing page in a minimalist style"*. A normal smart contract
cannot evaluate that. This contract can.

**Has a clear fee path:** Every job creates escrow transactions. Every
dispute triggers additional consensus work. If the product gets reused,
that maps cleanly to GenLayer's dev fee model.

---

## Full flow

```
Client posts job (budget locked in escrow)
        ↓
Freelancer accepts
        ↓
Freelancer submits work URL (GitHub, Figma, Google Doc, etc.)
        ↓
     ┌──────────────────────┐
     │  Client reviews      │
     │  Approve → pay out   │
     │  Dispute → contract review │
     └──────────────────────┘
              ↓ (if disputed)
  gl.get_webpage(submission_url)  ← fetches URL ON-CHAIN
              ↓
  gl.exec_prompt(brief + criteria + content)
              ↓
  5 LLM validators vote independently
              ↓
  Optimistic Democracy consensus
              ↓
  Verdict: "release" | "refund" | "partial X%"
  Funds distributed automatically
```

---

## Deploy in 3 steps

### 1. Deploy contract

```bash
npm install
cp .env.example .env
# Edit .env → add PRIVATE_KEY=0x...

npm run deploy
# → Contract deployed at: 0xABC...
# Add to .env: CONTRACT_ADDRESS=0xABC...
```

### 2. Seed demo jobs

```bash
npm run seed
# → 3 demo jobs created with locked GEN
```

### 3. Deploy frontend to Vercel

```bash
cd frontend && npm install   # test build locally first
npm run dev                  # → http://localhost:3000

# Push to GitHub, import on vercel.com
# Add env var: NEXT_PUBLIC_CONTRACT_ADDRESS=0xABC...
# Deploy → get public URL
```

---

## How dispute resolution works

```python
# Inside freelance_court.py — runs on 5 LLM validators simultaneously

# 1. Fetch submitted work LIVE from internet
submission_content = gl.get_webpage(job.submission_url, mode="text")

# 2. Ask LLM to evaluate
result = gl.exec_prompt(f"""
  BRIEF: {job.brief}
  CRITERIA: {job.criteria}
  SUBMITTED WORK: {submission_content}
  
  Verdict: release | refund | partial
""")

# 3. Parse + distribute funds
verdict = json.loads(result)["verdict"]
# → funds go to freelancer, client, or split
```

Five validators run this code independently.
Majority vote = final verdict written on-chain.
Funds distributed in the same transaction.

---

## Submission URLs that work well

The LLM can read any publicly accessible page:
- GitHub repository (`github.com/user/repo`)
- Deployed website (`yourproject.vercel.app`)
- Google Doc (set to "Anyone with link can view")
- Figma file (set to "Anyone can view")
- Notion page (public)
- Raw GitHub file

---

## Links

- Faucet:   https://testnet-faucet.genlayer.foundation
- Explorer: https://zksync-os-testnet-genlayer.explorer.zksync.dev
- Docs:     https://docs.genlayer.com
- Hackathon: https://dorahacks.io/hackathon/genlayer-bradbury/detail
