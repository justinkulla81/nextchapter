# Agent-delivered outplacement (design, first slice)

Status: first slice built behind `OUTPLACEMENT_AGENT_ENABLED` (off). Not enabled for any real seat. Enabling needs the owner's approval of the cost model below.

## What it is
Each departing employee who holds an outplacement seat gets an agent that runs their search week: it finds the people they already know who are worth writing to, drafts the note, and has it waiting on their This week page. The buyer is the employer doing the layoff (or a workforce board), who pays per seat at a fraction of a human outplacement price. The seat model, counts-only reporting and compliance record already exist (`OutplacementSeat`, `src/lib/employer/outplacement-*.ts`) and are unchanged.

## What runs by itself and what needs a click
Nothing the agent makes is copy-paste: results are already in place when the person opens the page. Nothing is sent for them.

| Task | Runs by itself | Needs the member | Cost |
|---|---|---|---|
| Weekly plan: who to write to (people they know at companies they applied to, starred, gone-quiet warm contacts) | Yes, Monday cron (built: `getWeeklyOutreachPlan`) | No | None (database only) |
| Drafted note per person in the plan | Yes, Monday cron (**this slice**) | Reads, edits, sends it themselves | 1 small model call each, max 5 a week |
| Track the search (applications, outreach log, follow-ups) | Yes (exists) | No | None |
| Tailored application (résumé tailoring for a job they chose) | No, runs when they pick a job, result saved to their résumé versions | One click to choose the job | 1 medium call (later slice) |
| Interview prep for a booked interview | Yes, when a calendar event or logged interview appears (later slice) | Reads it | 1 to 3 calls (later slice) |
| Anything that sends, or touches Google | Never | Member does it, from a draft, link or `.ics` | None |

Hard rules kept: no write to a member's Google account; no automated screening or auto-replies to applicants (LL144 counsel pending); employers see counts only, never names, and never see drafts (`OutplacementAgentDraft` is not read by any employer code); no public price, promise or disclaimer is added.

## Cost model (internal)
Model: `claude-haiku-4-5-20251001` ($1 per million input tokens, $5 per million output), the same model as the free tools. One draft call is about 450 input tokens and about 180 output tokens, with output capped at 450.

- One draft: about $0.0014 typical, $0.0027 worst case.
- A week (5 drafts): about $0.007. A month (about 22 drafts): about **$0.03 per seat**.
- Hard per-seat cap: **30 calls a month** = **$0.08 per seat per month at the worst case**, whatever the person or the plan does.
- Agent-wide ceilings: 300 calls a day, 4,000 a month (worst case about $11 a month if every ceiling is hit). A daily ceiling of 300 supports about 60 seats' full weekly run on one Monday.
- Later slices (tailored applications, interview prep) would raise the estimate to roughly **$0.25 to $0.60 per seat per month** typical (estimate, not measured), still capped per seat (suggest $1.50 a month as the whole-agent cap when those ship).

Spend tracking: every draft sends `outplacement_agent_draft_made` to PostHog with token counts and the seat id; cap hits send `outplacement_agent_cap_hit`; the weekly run sends `outplacement_agent_week_run`.

## The paid cap is separate from the free cap
`src/lib/outplacement-agent/` has its own counters in `ApiUsageCounter` (`outplacement-agent-seat:<seatId>`, `outplacement-agent-day`, `outplacement-agent-month`), so a free visitor can never use a seat's calls and a seat can never drain the free tools. It fails closed when a counter cannot be read. Limits are tunable with `OUTPLACEMENT_AGENT_SEAT_MONTHLY_CALLS`, `OUTPLACEMENT_AGENT_DAILY_CALLS`, `OUTPLACEMENT_AGENT_MONTHLY_CALLS`.

## What a seat can carry
AI cost is a rounding error (cents). The price has to cover the rest: onboarding, support, the compliance record, sales cost, and the plan's margin. No seat prices are recorded in the repo (they are set per plan), and I did not verify human-outplacement prices, so the price is the owner's call. The AI cost gives a floor of about $1 per seat per month at today's slice and about $3 with later slices; anything above that is margin, so a seat can sit far below a human coach's per-person fee and still be very profitable.

## Slice built
- `src/lib/outplacement-agent/`: switch, cap, reserve, prompt, run.
- Cron `/api/cron/outplacement-agent`, Mondays 11:00 UTC, no-op while the switch is off.
- Table `OutplacementAgentDraft` (`prisma/manual/outplacement-agent-draft.sql`, **not yet applied to production**; the code reads it only when the switch is on).
- This week page (`/dashboard/network/this-week`) shows "Your draft is ready" under each person when a draft exists.
- Only activated seats on an active contract, not sample seats, within the access window, run.

## Not in this slice
Employer-facing counts (drafts made, notes the person marked sent; minimum cell size 10), tailored applications, interview prep, a per-seat opt-out, and a test with a real member's contacts (blocked here: reading a real member's contact list was not permitted in the session).
