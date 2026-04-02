# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json
import typing


@allow_storage
@dataclass
class Job:
    id: u64
    client: str
    freelancer: str
    title: str
    brief: str
    criteria: str
    budget: u256
    deadline_days: u64
    created_at: u64
    submission_url: str
    submission_note: str
    status: str
    verdict: str
    verdict_reason: str
    partial_pct: u8


class FreelanceCourt(gl.Contract):
    jobs: TreeMap[str, Job]
    job_count: u64

    def __init__(self) -> None:
        self.jobs = TreeMap()
        self.job_count = u64(0)

    def _job_key(self, job_id: u64) -> str:
        return str(job_id)

    def _get_job(self, job_id: u64) -> Job:
        return self.jobs[self._job_key(job_id)]

    def _save_job(self, job_id: u64, job: Job) -> None:
        self.jobs[self._job_key(job_id)] = job

    def _job_view(self, job: Job) -> typing.Any:
        return {
            "id": job.id,
            "client": job.client,
            "freelancer": job.freelancer,
            "title": job.title,
            "brief": job.brief,
            "criteria": job.criteria,
            "budget": job.budget,
            "deadline_days": job.deadline_days,
            "created_at": job.created_at,
            "submission_url": job.submission_url,
            "submission_note": job.submission_note,
            "status": job.status,
            "verdict": job.verdict,
            "verdict_reason": job.verdict_reason,
            "partial_pct": job.partial_pct,
        }

    @gl.public.write.payable
    def create_job(
        self,
        title: str,
        brief: str,
        criteria: str,
        deadline_days: u64,
    ) -> u64:
        budget = u256(gl.message.value)
        assert budget > 0, "Must send GEN to fund the job"
        job_id = u64(self.job_count)

        job = Job(
            id=job_id,
            client=str(gl.message.sender_address),
            freelancer="",
            title=title,
            brief=brief,
            criteria=criteria,
            budget=budget,
            deadline_days=u64(deadline_days),
            created_at=u64(gl.message.block_timestamp),
            submission_url="",
            submission_note="",
            status="OPEN",
            verdict="",
            verdict_reason="",
            partial_pct=u8(0),
        )
        self._save_job(job_id, job)
        self.job_count = u64(self.job_count + 1)
        return job_id

    @gl.public.write
    def cancel_job(self, job_id: u64) -> None:
        job = self._get_job(job_id)
        assert job.status == "OPEN", "Can only cancel an open job"
        assert str(gl.message.sender_address) == job.client, "Only client"
        job.status = "CANCELLED"
        self._save_job(job_id, job)
        gl.message.sender_address.transfer(job.budget)

    @gl.public.write
    def accept_job(self, job_id: u64) -> None:
        job = self._get_job(job_id)
        assert job.status == "OPEN", "Job not open"
        assert str(gl.message.sender_address) != job.client, "Client cannot accept"
        job.freelancer = str(gl.message.sender_address)
        job.status = "ACCEPTED"
        self._save_job(job_id, job)

    @gl.public.write
    def submit_work(self, job_id: u64, submission_url: str, note: str) -> None:
        job = self._get_job(job_id)
        assert job.status == "ACCEPTED", "Job must be accepted first"
        assert str(gl.message.sender_address) == job.freelancer, "Only freelancer"
        job.submission_url = submission_url
        job.submission_note = note
        job.status = "SUBMITTED"
        self._save_job(job_id, job)

    @gl.public.write
    def approve_work(self, job_id: u64) -> None:
        job = self._get_job(job_id)
        assert job.status == "SUBMITTED", "Work not submitted"
        assert str(gl.message.sender_address) == job.client, "Only client"
        job.status = "APPROVED"
        self._save_job(job_id, job)
        gl.Address(job.freelancer).transfer(job.budget)

    @gl.public.write
    def raise_dispute(self, job_id: u64) -> None:
        job = self._get_job(job_id)
        assert job.status == "SUBMITTED", "Work not submitted"
        assert str(gl.message.sender_address) == job.client, "Only client"
        job.status = "DISPUTED"
        self._save_job(job_id, job)

    @gl.public.write
    def resolve_dispute(self, job_id: u64) -> str:
        job = self._get_job(job_id)
        assert job.status == "DISPUTED", "Not in dispute"

        # Capture to local vars before entering closure (storage objects can't be captured)
        url = job.submission_url
        title = job.title
        brief = job.brief
        criteria = job.criteria
        note = job.submission_note

        # Fetch submitted work deterministically
        def fetch_work() -> str:
            return gl.get_webpage(url, mode="text")

        submission_content = gl.eq_principle_strict_eq(fetch_work)

        # LLM evaluation — non-deterministic, validators reach consensus
        prompt = f"""You are an impartial arbitrator for a freelance dispute.

JOB TITLE: {title}

ORIGINAL BRIEF:
{brief}

ACCEPTANCE CRITERIA:
{criteria}

SUBMITTED WORK:
---
{submission_content[:4000]}
---

FREELANCER NOTE: {note}

Does the submitted work meet the acceptance criteria?
Respond ONLY with valid JSON (no markdown, no extra text):
{{"verdict": "release", "partial_pct": 0, "reasoning": "one sentence explanation"}}

verdict must be exactly one of: "release", "refund", "partial"
partial_pct is 0 unless verdict is "partial" (then 10-90)"""

        result_raw = gl.exec_prompt(prompt)

        try:
            clean = result_raw.strip()
            if clean.startswith("```"):
                lines = clean.split("\n")
                clean = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            data = json.loads(clean)
            verdict = str(data.get("verdict", "refund"))
            partial_pct = int(data.get("partial_pct", 0))
            reasoning = str(data.get("reasoning", ""))
            if verdict not in ("release", "refund", "partial"):
                verdict = "refund"
            if verdict == "partial":
                if partial_pct < 10 or partial_pct > 90:
                    partial_pct = 50
            else:
                partial_pct = 0
        except Exception:
            verdict = "refund"
            partial_pct = 0
            reasoning = "Parse error"

        job.status = "RESOLVED"
        job.verdict = verdict
        job.verdict_reason = reasoning
        job.partial_pct = u8(partial_pct)
        self._save_job(job_id, job)

        budget = job.budget
        client_addr = gl.Address(job.client)
        freelancer_addr = gl.Address(job.freelancer)

        if verdict == "release":
            freelancer_addr.transfer(budget)
        elif verdict == "refund":
            client_addr.transfer(budget)
        else:
            freelancer_share = (budget * u256(partial_pct)) // u256(100)
            client_share = budget - freelancer_share
            if freelancer_share > 0:
                freelancer_addr.transfer(freelancer_share)
            if client_share > 0:
                client_addr.transfer(client_share)

        return verdict

    @gl.public.view
    def get_job(self, job_id: u64) -> typing.Any:
        return self._job_view(self._get_job(job_id))

    @gl.public.view
    def get_all_jobs(self) -> typing.Any:
        result = []
        job_id = u64(0)
        while job_id < self.job_count:
            result.append(self._job_view(self._get_job(job_id)))
            job_id = u64(job_id + 1)
        return result

    @gl.public.view
    def get_job_count(self) -> u64:
        return self.job_count
