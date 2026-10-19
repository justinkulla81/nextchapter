# No more exclusive jobs (owner decision, 2026-10-18)

Every job is shown to every member. The dossier goes with an application only if the member
chooses to attach it. Candidate+ is a mark the poster sees when true, hidden in Confidential
Search Mode.

| Where | What it did | Changed / left |
| --- | --- | --- |
| `ExclusiveJobPosting` table, `prisma.exclusiveJobPosting` (about 60 files) | The name of the one job table. Every job lives in it. | Left. Database name only, no schema change. |
| Job board, job page, apply kit visibility (`find-my-job`, `jobs/[id]`, `apply-actions.ts`) | Already shows every job to every member (2026-10-16 rule). | Left. Nothing gated. |
| `getModuleGateStatus('matchedJobsFullDetail')` in `src/lib/scoring/dossier-unlock.ts` | "Matched jobs full detail / apply" gate: send one reference request. Shown on stats and in the ladder. | Removed. Nothing read it for access. |
| `src/lib/unlocks/ladder.ts` rung `jobDetail` ("Full job detail and Community") | Told members job detail was locked. | Replaced by a `community` rung that only covers Community. |
| `src/lib/journey/engagement.ts` ("A-List jobs") | Reference nudges promised A-List jobs. | Wording removed. |
| `src/app/dev-preview/_mockups/home.tsx` | Mockup said "Opens exclusive jobs". | Wording removed. |
| `src/lib/reports/market-reality-sections.ts` ("exclusive roles") | Lever label in the member report. | Now "unposted roles". |
| Native apply (`NativeApply.tsx`, `apply-actions.ts`, `native-apply.ts`) | No dossier option. | Added "Attach my dossier" / "Don't attach" (default off, asked every time, not remembered). Attaching creates a 30-day revocable `ProfileShare` link and puts it in the application. PostHog `dossier_attach_chosen {jobId, attached}` on the choice; `native_apply_submitted` now carries `dossierAttached`, `candidatePlusShown`. |
| Candidate+ mark to the poster | Not signaled on applications. | Application message says "Candidate+ member" when true and not in Confidential Search Mode. The talent and recruiter search lists already filter on Candidate+ visibility. |
| Candidate+ extras on a job (who to contact, apply kit, explain my gaps) in `candidate-plus-extras.ts` | Tools, not job content, gated to Candidate+ (owner rule, 2026-10-16). | **Left. Owner to decide** whether these also open to everyone. |
| Admin: `support/admin/exclusive-jobs`, `ExclusiveJobPostingForm` ("Add exclusive posting"), AdminNav | Staff job entry. No exclusive flag on the form; the word is only the page name. | Left (not candidate-facing). |
| Employer and recruiter posting forms | No exclusive toggle exists. | Left. Unchanged. |
| `src/app/terms/page.tsx` | "exclusive" appears only as "non-exclusive licence", "exclusive defense" and "exclusive jurisdiction". | Left. No wording about exclusive jobs. |
| Emails (`src/emails`) | No exclusive-jobs wording. | Left. |
| Prisma SQL | No schema change. | None to apply. |
