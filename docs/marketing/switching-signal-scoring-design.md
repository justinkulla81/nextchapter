# Switching-signal scoring — design note (NOT BUILT)

Partners Master Build Script §D2.3 ("Renewal-window targeting") and §D6
("Switching-signal scoring extends the existing WARN lead-generation
pipeline. Do not duplicate it.")

## Status: not implemented this phase, and should not be implemented as a
## working feature until its real dependency exists.

§D2.3 describes a sales/targeting tool — a scored list of companies worth
approaching for an outplacement renewal — built from five signals:

| Signal | Source per spec |
|---|---|
| WARN filing | "Existing agent" |
| Hiring contraction | `ncrawl` posting trajectory |
| Members listing them as current employer, searching | Internal, aggregate only |
| Known incumbent | Waitlist intel, candidate reports, public sources |
| Leadership change in HR | News monitoring |

**The premise doesn't hold in this codebase.** §D2.3 assumes "the existing
WARN lead-generation pipeline" and calls it "the existing agent." Phase 9 of
this build (Market Intelligence) confirmed no such WARN monitoring
pipeline exists — there is no automated WARN-filing ingestion or agent
anywhere in this codebase. Building switching-signal scoring as if that
input were live would mean shipping either fake data or a feature that
silently returns nothing for its primary signal, both worse than not
shipping it. Per this phase's explicit instructions: **do not build this as
a working feature.**

## What does exist, honestly, among the five signals

Two of the five signals have a real, working source in this codebase today
and could — in a real future phase, once WARN monitoring exists to anchor
the score — feed a genuine version of this tool:

1. **Hiring contraction** — `src/lib/companies/signals.ts` computes
   `Trajectory` (`growing` / `flat` / `contracting`) per company from
   `ExclusiveJobPosting` data via `ncrawl`, on a real 12-week relative/
   absolute-delta threshold. This is live and real today.
2. **Members listing them as current employer, searching** — internal
   candidate work-history and search-status data exists and could be
   aggregated per employer, subject to the same aggregate-only privacy wall
   already enforced elsewhere in this codebase (e.g. the employer-reporting
   boundary described on `/employers` and `/insights/outplacement-reporting`:
   an org never sees identifiable individual activity, only aggregates).

The other three signals (WARN filing, known incumbent, HR leadership
change) have no real source in this codebase. "Known incumbent" is
partially addressed — the employer waitlist already captures a `current
provider` field per §C4.3 — but that alone is not enough to anchor a
scored targeting list; it's one input among five, and the spec's own
design treats WARN filing as the anchor signal ("the WARN agent already
identifies companies running reductions. Extend it...").

## If this is built for real later

- Do not build a "switching-signal score" that silently substitutes zero or
  a placeholder for the WARN-filing input. Either build real WARN
  monitoring first, or ship a tool that's explicit about which signals it
  actually has (hiring contraction + aggregate member employer-mentions
  only) and labels itself accordingly — not a five-signal score with two
  signals silently missing.
- This is a sales/targeting tool per §D2.3, not public-facing content. It
  belongs in an internal admin surface (e.g. alongside the existing
  `support/admin` Market Intelligence tooling from Phase 9), never exposed
  on the marketing site.
- Reuse the aggregate-only privacy boundary already enforced for employer
  reporting — an admin targeting tool built from member search-status data
  must not expose any individual candidate's identity or activity outside
  the boundaries already established for that data.
