# Workforce-system vendors: where we compete and where we partner

Research done 2026-10-14 from web searches and one pasted vendor page (CareerTeam). Mostly press releases and company-profile aggregators, not current product documentation. Treat headcounts, funding and state counts as rough. Nothing here was confirmed with the vendors.

## The vendors

| Vendor | What they sell | Size signals | Notes |
|---|---|---|---|
| **Geographic Solutions** (VOS Sapphire) | One integrated system for state agencies: labor exchange, case management, labor market information, service tracking, fund management, provider services, federal reporting. Azure-based AI features. | Private, Palm Harbor FL, founded 1992, about 340 to 375 staff, "30 to 40+" states and territories | Pitches an integrated platform over parts from different vendors. Partnered with CollegeNET (campus career centers and interview practice) and FutureWork Systems (data pipeline into VOS). No public API or partner program found. |
| **CareerTeam / Career Edge** | Case management across WIOA, Wagner-Peyser, TAA, SNAP E&T, RESEA, Apprenticeship and Youth; embedded federal (PIRL) reporting; AI labor exchange; employer ATS | Iron Creek recapitalized it in 2021 to 2022; profiles list about 377 staff | Also delivers services itself, not just software. |
| **myOneFlow** | Low-code WIOA case management, client portal, resume builder, AI job recommendations | Listing price from $10,000 | Search results confused it with an unrelated Swedish company; only vendor-site snippets were usable. |
| **MonsterWorks** (Monster Government Solutions), **Casebook** | Case management for agencies and nonprofits | not researched | |
| **FutureFit AI** | Skills-based career navigation sold to governments and partners | C$5.7M round (2022); revenue and headcount estimates conflict | Closest to a consumer-facing competitor. |
| **GoSprout** | Apprenticeship and work-based-learning management | about $1.2M seed | Not our user. |
| **Emsi / Lightcast** | Labor market data | n/a | A data supplier, not a competitor. |

## Where we compete, where we do not

- **Not competing:** case management, eligibility, fund management, federal reporting. Do not build these.
- **Competing:** basic job-seeker tools (resume builder, job search, LMI, career pathing) wherever an agency deploys them, because residents get them free. We win on quality for professionals, not on having the features.
- **Ours alone, as far as we found:** the professional and executive layer (coaching, confidential search, outreach tracking, references, recruiter introductions), outplacement employers, and layoff-specific tools.

## Partnering

- Precedent exists for outside tools alongside VOS (CollegeNET, FutureWork), but their integrated-platform pitch suggests few hooks. **Ask before assuming.**
- Realistic first shape: a workforce board refers laid-off professionals through a source-tagged link; we send back consented outcome counts by CSV or webhook.
- Pilot with one workforce board first; approach vendors once there are results.

## What this implies for the product

1. State and metro wage and projection data from BLS (free), so the Pivot Tool is locally accurate.
2. Outcome reporting that agencies can use, after a privacy review of anything participant-level.
3. White-label for boards. A workforce-board portal does not exist yet; institutions and outplacement employers have branding (see `docs/OPEN_ITEMS.md`).
