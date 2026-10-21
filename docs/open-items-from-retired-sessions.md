# Open items carried over from retired sessions

Five sessions were closed out on 2026-10-21 after their open items were written down here. Nothing below is in progress anywhere else.

## Needs the owner's decision before anyone acts

- **Drop unused database pieces.** `CandidateVisitDay` and an `EffortCycle` column are unused (from the market reality report redesign). `AiShareSnapshot` is an empty table (from the AI skills audit). `_MetroStage` is a leftover staging table (from the career pivot tool). Dropping any of them is destructive, so each needs a yes first.
- **Private pause reason.** The career story's "pause" what-if stores the reason a person gives. Decide whether it stays stored.
- **"Chief of staff for your career search" positioning.** The analysis found no competitor using the phrase. The claim only holds if the product acts unprompted, holds the whole search, says no when it should, sends nothing without approval, gives a weekly review, and is safe for employer buyers. Risks: the claim outruns the product, cost per user, harder fit for junior users. Reference only; nothing was built.

## Still to do

- **Visual review of the candidate pages against real data.** The owner has never seen about ten dashboard pages against real data. Do it signed in.
- **Career story page, signed in.** Live check with a real account. Also have someone expert review the cost and time ranges shown.
- **180-minute unlock bar.** Left open by the market reality report redesign.
- **"Only roles that pay more" filter on the pivot tool.** The like-for-like pay change per role exists (`comparePay` in `src/lib/careers/local-pay.ts`). The filter itself is not built.
- **Data-source defaults.** The "Import career taxonomy" workflow still points at older O*NET and BLS files. Current: O*NET 31.0 (Aug 2026), BLS May 2025 wages, projections 2025 to 2035. Its parsers are untested on the newer layouts. The wage data itself was loaded separately from the May 2025 files (states and metros).
- **Review emails for people who are working.** `IN_WORK_REVIEW_EMAILS_ENABLED` exists in Vercel production; confirm it is set the way the owner wants.
