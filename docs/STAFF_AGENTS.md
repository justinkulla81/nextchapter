# Staff agents for the institutional buyers (design, first agent built)

Status: shared core, the rapid-response agent and the career-services agent are built behind `STAFF_AGENTS_ENABLED` (off) and, per organization, `enabledFeatures.agents.rapidResponse` / `agents.careerServices` (off). The other four are designed here, not built. Nothing runs or spends until the owner approves the cost model and switches it on.

Same idea as the seat agent (`docs/OUTPLACEMENT_AGENT.md`): software does the preparation, a person decides and sends. Each agent writes its result straight into the place staff already work (no copy-paste), as a draft that is not public and not sent until staff press the existing button. Nothing is written to anyone's Google account, nothing screens or replies to applicants, and every agent runs only for organizations that switched it on.

## The six agents
| Buyer | Workspace today | What the agent does by itself | Staff click | Status |
|---|---|---|---|---|
| Rapid response professional | Rapid response (`/i/<slug>/...`, `screens-lifecycle.tsx`) | A WARN notice filed in the organization's own counties with no offer yet gets a drafted sign-up page (title and text) saved as a closed offer marked "draft ready" | Publish | **Built** |
| Career services (higher ed) | Career, caseloads (`caseload.ts`, `views.ts`) | People on a caseload who share search detail and went quiet (14+ days, or a sprint with nothing done) get a drafted check-in note under their name on the caseload screen | Edit and send from own email | **Built** |
| Alumni services (higher ed) | Alumni, check-ins, layoff matches (`layoffs.ts`, `outreach.ts`) | Weekly: alumni in transition and a drafted "we have your back" note, saved as a draft campaign | Review and send campaign | Designed |
| Development / fundraising (higher ed) | Development, Resilience Fund (`fund.ts`, `gratitude.ts`, `outcomes-report.ts`) | Alumni who landed work after help and donors to thank: drafted stewardship notes and the donor-report paragraph from the real numbers | Review and send | Designed |
| Workforce development professional | Workforce hub (`hub-actions.ts`, member companies, board intel) | Weekly: member-company layoffs and hiring signals, participants who stalled (counts only unless consented), drafted employer outreach | Send from hub | Designed |
| Department of labor / state agency | No portal today (`/government-workforce` is a marketing page) | Weekly regional brief from public data only (WARN filings, job counts, board figures) plus a drafted narrative for the agency's own report. No member data at all | Needs a decision: a small workspace, or a weekly email | Designed, needs owner decision |

Reuse: every agent takes its facts from existing functions (no new data collection), calls the same Haiku model, and goes through one cap. The core is `src/lib/staff-agents/`: `switch.ts` (global and per-organization switch), `cap.ts` and `reserve.ts` (counters), one file per agent for the prompt and reply checks, and `run.ts` for the daily run. Adding an agent means one prompt file, one gatherer and one key in `StaffAgentKey`.

## Cost model (internal)
Model `claude-haiku-4-5-20251001` ($1 per million input tokens, $5 per million output). One drafted offer is about 400 input and 200 output tokens: about $0.0014 typical, $0.0029 worst (output capped at 500).

- Rapid response: a few new local WARN notices a month per organization, so about 3 to 6 calls: **about $0.01 per organization per month**.
- Career services: at most 5 notes a run, never the same person within 14 days; about 300 input and 150 output tokens a note, about $0.001, so a college with 10 quiet people a month is **about $0.01 to $0.02 a month**.
- Hard per-organization cap: **60 calls a month across all staff agents** = **about $0.18 worst case per organization**. Agent-wide ceilings 150 a day and 2,500 a month (about $7.50 worst case a month).
- When the other five ship (weekly briefs with a few drafts each) I estimate **$0.10 to $0.40 per organization per month typical**, not measured. The per-organization cap would be raised deliberately then, not by accident.
- Separate counters (`staff-agents-*` in `ApiUsageCounter`), so staff agents, the seat agent and the free tools can never use each other's calls. Fails closed. PostHog: `staff_agent_rapid_response_drafted` (tokens), `staff_agent_cap_hit`, `staff_agents_daily_run`.

## Rapid-response agent (built)
- Eligible: non-sample organization, `enabledFeatures.agents.rapidResponse === true`, at least one program with an open cohort.
- Acts only on notices inside the organization's own counties (not the whole-state fallback), not already covered by an offer, newest first, at most 3 a day.
- Saves a `RapidResponse` with `isActive=false` and `createdBy='agent:rapid-response'`. The staff list shows "draft ready, review and publish" and a Publish button; publishing marks it staff-owned.
- Guards on the reply: must name the employer, no guarantee, free-tuition or placement promises, valid JSON, minimum length; otherwise discarded. The prompt allows "may be eligible" only for programs marked WIOA-eligible.

## Career-services agent (built)
- Eligible: `enabledFeatures.agents.careerServices === true`, non-sample organization. Reads `private.v_caseload_activity`, the same view as the caseload screen, and only members with `shareSearchDetail` on.
- Activity and sprint numbers decide who gets a note. They are never given to the model, and the note is rejected if it says it noticed activity, mentions a sprint or promises anything. The model sees first name, class year and situation only.
- Saved in `StaffAgentDraft` (one row per member and week), shown under the name on the caseload screen as "Check-in note ready" with an "Open in your email" link the counselor sends themselves. Apply `prisma/manual/staff-agent-draft.sql` first; the screen shows no drafts if the table is missing.

## To turn on (after the owner approves the cost model)
1. Set `STAFF_AGENTS_ENABLED=on` in Vercel production and redeploy. 2. Switch an organization on by setting `agents.rapidResponse` and/or `agents.careerServices` to true in its `enabledFeatures`. Rapid response needs no database change; career services needs `prisma/manual/staff-agent-draft.sql` applied first.

## Not built, and not verified
The other four agents; a staff-facing switch screen (today the per-organization switch is set in the database); a run against a real organization's region and programs (not done here).
