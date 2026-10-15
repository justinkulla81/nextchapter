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

## Added 2026-10-15: outplacement, hiring, AI job-matching and resume tools

Same caveat: web searches only, nothing confirmed with the companies.

| Company | What it is | Signals | Us |
|---|---|---|---|
| **CareerArc outplacement** | Now **INTOO USA**. Gi Group bought CareerArc's outplacement arm in July 2020 and rebranded it. On-demand outplacement pairing job matching with coaching, assessments and resume help. Executive outplacement is a separate offer. CareerArc's social-recruiting business is separate. | Claims 80,000+ transitions a year and 97% satisfaction (self-reported). No published pricing. | **Direct competitor** for the employer outplacement portal and for laid-off professionals. |
| **Humanly** | Employer-side conversational AI recruiting: two-way chat over SMS, email, voice and video for screening, scheduling and reminders; interview notes; ATS integrations. Bought Sprockets, Qualifi and HourWork. | Funding figures conflict: company says $24M total after a $7M round (May 2025); one directory lists a $25M Series B (April 2026) and $49.1M total. Pricing unpublished. | **Adjacent, employer side.** Not our user. Overlaps only with the Talent and recruiter portals' screening and scheduling, which we have not built. A possible integration partner, not a rival. |
| **Jack & Jill** | AI agents for both sides: "Jack" interviews a candidate (about 20 minutes) and learns what they want; "Jill" represents employers; matched people are introduced directly to the hiring manager instead of applying. London, US expansion. | Seed $20M (October 2025, Creandum) and Series A $40M (Air Street, Madrona, Antler), about $60M in total per press, though one headline says $50M. About 350,000 people on its network. | **Direct competitor** to our job board, matching and coach-style guidance, especially for people who would rather be matched than search. Unknown whether it serves senior professionals as we do. |
| **Apply.io** | **Not found.** Searches returned unrelated products (Applyflow, Applied, onapply). Need its web address or a description. | | |
| **Enhancv** | Freemium resume builder: 20+ templates, LinkedIn import, tailoring to a job description, cover letters, AI content, tracks views and downloads. Founded 2014. | One review lists $79.94 per six months; the free tier is limited. No funding data found. | **Direct competitor to Resume Studio.** Has more templates, LinkedIn import and view tracking than we do. Note our Resume page currently links candidates to Enhancv for professional help. |

### What this changes

- **Outplacement is a real fight.** INTOO is large and established. Our edge: the layoff-specific data (WARN, rapid response), confidential search, recruiter introductions, and per-person outcome reporting that employers can use. We have no published pricing to compare and no payment system yet.
- **Resume Studio gaps vs Enhancv:** import from a LinkedIn profile or uploaded resume into sections, more template choice, per-job tailoring suggestions, and view/download tracking.
- **Jack & Jill's approach** (an interview that builds a profile, then introductions) is the thing to learn from: our onboarding already collects the same facts, so the missing piece is acting on them for the person.
