# NextChapter for Partners — Master Build Script

**Authoritative for all partner-side work.** Where this conflicts with any other file, earlier session instructions, or shipped code, follow this.

**Save to `docs/specs/` and read from there.** Do not rely on chat context — it gets compacted away. After any compaction, re-read this file rather than working from task summaries.

**Depends on:** `NextChapter_MASTER_BUILD_SCRIPT.md` (candidate scoring engine, five components, competency grid) and `NextChapter_PHASE2_MASTER_SCRIPT.md` (candidate dashboard, resume tools, community, admin analytics, company pages).

---

## What "Partners" means

**NextChapter for Partners** is the umbrella for every non-candidate surface. A coach, a recruiter, a hiring manager, and an employer are all partners in someone's transition.

| Surface | Name | Route |
|---|---|---|
| Coach | NextChapter for Coaches | `/coach` |
| Executive recruiter | NextChapter for Recruiters | `/recruiter` |
| Hiring manager | NextChapter for Hiring | `/hiring` |
| Employer / outplacement buyer | NextChapter for Employers | `/employer` |
| Internal | NextChapter Admin | `/admin` |

The candidate side is never called anything but **NextChapter**. It is the product; everything else is a qualified variant.

**Removed from scope:** recruiter-administered assessments. If a third-party instrument administered through our platform has disparate impact, we may share liability as the administering party. The upside was modest; the exposure wasn't.

---

## Contents

| Part | Covers |
|---|---|
| **A** | Identity architecture, the seven portals, plans and pricing, Market Intelligence, Benefits Network |
| **B** | Shared design system and the four differentiation cues |
| **C** | Positioning, messaging by audience, site architecture, waitlists |
| **D** | Competitive strategy against LHH, RiseSmart, Careerminds, INTOO |
| **E** | Build sequence and open decisions |

---

# PART A — Portals, Plans & Pricing

**Depends on:** `NextChapter_MASTER_BUILD_SCRIPT.md`, `NextChapter_PHASE2_MASTER_SCRIPT.md`.

**Removed from scope:** recruiter-administered assessments. If a third-party instrument administered through our platform has disparate impact, we may share liability as the administering party. The upside was modest; the exposure wasn't.

---

## A1. Identity and portal architecture

### 1.1 One identity, many roles, hard walls

A single person will be a candidate, then an alum, then a hiring manager, then a candidate again. Some will be a coach and an alum at once. **One identity record with role grants** — separate user tables per portal guarantees duplicate-identity reconciliation within a year and makes the conflict rules unenforceable.

**Role grants:** `candidate` · `alum` · `member` · `coach` · `recruiter` · `hiring_manager` · `employer_admin` · `employer_viewer` · `nc_admin`

Each granted separately, gated separately, logged separately.

### 1.2 The wall

The scenario that sets the requirement: an HR business partner at a client company buys outplacement seats **and is quietly job-searching herself** in Confidential Search Mode. Her colleagues use the same employer portal.

1. **Separate authenticated sessions.** Logging into the org portal does not log you into the candidate portal. Explicit switch, re-auth, persistent context banner.
2. **No org-side query joins to candidate data.** Enforced at the query layer. Employer aggregates compute from views that structurally cannot resolve to a person.
3. **An org user can never determine whether anyone — including themselves — has a candidate account.** No "already registered" errors, no differenceable counts, no search that returns a hit.
4. **A candidate who is also an org user never sees their own record from the org side.** Suppressed entirely, not greyed.
5. **Hiring managers cannot see candidates for their own reqs when a conflict is flagged** — same current employer, declared relationship, same household.
6. **Aggregates computed before role context is applied.**

### 1.3 The differencing problem

"9 of 11 seats activated" this month and "10 of 11" next month tells an employer something about one person. Minimum cell size alone does not fix this.

**Mitigations, all three:**
- Employer aggregates round to the nearest 5 below 50 seats
- Cohorts under 20 seats report quarterly, not monthly
- Any metric that could isolate a single member is suppressed entirely rather than rounded

---

## A2. Plans and pricing

### 2.1 Competitive context

| Incumbent | Typical price |
|---|---|
| LHH executive outplacement | $8,000–15,000+ per person, 6–12 months |
| LHH / Randstad RiseSmart mid-level | $3,500–7,000 |
| Virtual-first (Careerminds, INTOO) | $1,000–3,000 |

**Positioning: undercut by 25–40% while carrying better technology.** Incumbents are expensive because of physical offices, legacy sales, and coach-heavy delivery. Our cost base is software plus contract coaches.

### 2.2 Outplacement — employer pays

| | **Core** | **Plus** | **Premium** |
|---|---|---|---|
| **Price / seat** | **$895** | **$2,450** | **$7,450** |
| Term | 6 months | 6 months | 12 months |
| vs. incumbent | ~40% under virtual-first | ~35% under mid-level | ~40% under LHH executive |
| Coaching | None | 6 sessions | 12 sessions + named coach, 48h response |
| Resume | Studio + ATS matrix | + 1 human review | + unlimited reviews, all versions |
| Dossier | Full | Full | Full |
| Recruiter network | Standard intros | Standard intros | **Dedicated recruiter relationship** |
| Market Intelligence | Basic | Standard | **Full (Part 3)** |
| Interim & fractional | Boards + playbook | + curated openings | + direct introductions |
| Workspace | — | — | **Private cohort space + coworking stipend** |
| Premium plays | — | — | Board search, fractional CRO/CFO track, advisory placement |

**Unit economics per seat:**

| | Core | Plus | Premium |
|---|---|---|---|
| Platform, support, content | $150 | $180 | $280 |
| Coaching (contractor) | — | $660 | $1,800 |
| Recruiter time | — | — | $800 |
| Licensed data | $10 | $25 | $120 |
| **Total cost** | **$160** | **$865** | **$3,000** |
| **Gross margin** | **82%** | **65%** | **60%** |

**Volume discounts:** 25+ seats −10% · 100+ −18% · 250+ −25%. Floor at 45% gross margin on Premium.

### 2.3 Direct-to-consumer — candidate pays

| Plan | Price | Contents |
|---|---|---|
| **Free** | $0 | Market Reality Report, Resume Studio, job matching, community, company pages |
| **Resume** | **$99** one-time | Everything free, plus one human resume review, unlimited versions, per-job tailoring, full ATS matrix |
| **Coaching Plus** | **$299/mo** | 2 sessions/month, resume review included, priority support |
| **Coaching Premium** | **$599/mo** | 4 sessions/month, mock interviews with recorded feedback, negotiation support at offer stage, named coach |

**Resume-only candidates still receive the Market Reality Grade**, with Your Evidence and Your Effort visible but locked. The locked state is the upgrade motive — hiding the grade entirely makes the product feel thin and removes the reason to go further.

**Comparison:** Jobscan $49.95/mo · Enhancv $25–29/mo · TopResume writing $149–349 one-time. A $99 one-time with human review and per-parser testing undercuts all three on total cost of a search.

### 2.4 Membership and alumni

| Tier | Price | Contents |
|---|---|---|
| **Alumni** | Free, permanent | Dossier stays live · remain an insider · give references · refer others · quarterly market pulse |
| **Membership** | **$19/mo or $180/yr** | Annual Dossier refresh · quarterly market check with comp benchmarking · network maintenance nudges · **Benefits Network (Part 4)** · board and advisory listings · priority coach booking · **break-glass reactivation** |

Membership is offered at placement — the only moment it converts. Free for 12 months to anyone placed through a Premium outplacement seat; the employer already paid, and an active alum is worth more than $180.

### 2.5 Coaching fees — admin-managed, versioned

Coach pay rates are **configuration, not code.** Admin sets them; they change over time without a deploy.

| Field | Default |
|---|---|
| Standard session rate | $110 |
| Executive-band session rate | $150 |
| Mock interview (90 min) | $175 |
| Resume review (flat) | $85 |
| Intake session | $130 |
| Rate effective date | — |

**Rules:** rates are versioned with effective dates; an engagement locks the rate at assignment so mid-engagement changes don't apply retroactively; admin can set per-coach overrides; every change is logged with actor and timestamp. Historical reporting uses the rate in effect at the time of the session.

---

## A3. Market Intelligence (the PitchBook answer)

### 3.1 The licensing problem, stated plainly

**PitchBook cannot be resold.** Seats run $25k+/year and the license prohibits sublicensing or redistribution to non-seat-holders. The same is true of most premium financial-data products. Any plan promising "PitchBook access" is promising something we cannot legally deliver, and this must not appear in a sales deck.

### 3.2 What we build instead — and why it's better for this buyer

An executive in transition does not need deal comps and fund IRRs. They need to know **who is hiring at their level, who is contracting, who to talk to, and what it pays.** That is a different product, and we already own most of the inputs.

**Proprietary layer — already built, nobody else has it:**

| Source | Yields |
|---|---|
| `ncrawl` (18+ ATS platforms, director-and-above) | Open roles by company, function, level, geography · hiring trajectory · skills demanded · **posting age** · which ATS each employer runs |
| WARN monitoring agent | Layoff filings, headcount, location, timing |
| Insider network | Interview process, decision-makers, what gets tested |
| Aggregated postings | **Comp bands by role, level, and metro** |
| Application outcomes | Response and interview rates by company, aggregate |

**Licensed layer — economical and redistributable under standard commercial agreements:**

| Need | Vendor options | Note |
|---|---|---|
| Company firmographics, funding, ownership | Crunchbase (API/enterprise), Grata, PrivCo | Far cheaper than PitchBook; PrivCo covers private financials |
| Contact data | Apollo.io, Clearbit | Apollo's API terms are the most workable for in-product use |
| News and signals | Owler, NewsAPI | Cheap |
| Executive movement | Live Data Technologies or similar | Optional |

**Before building:** confirm redistribution rights in writing with each vendor. Terms vary and change. Budget $1,500–4,000/month at early scale across the licensed layer.

### 3.3 Tiers

| | Core | Plus | Premium |
|---|---|---|---|
| Company pages | ✓ | ✓ | ✓ |
| Hiring trajectory, WARN, posting age | ✓ | ✓ | ✓ |
| Skills demanded | ✓ | ✓ | ✓ |
| Comp bands for their target | — | ✓ | ✓ |
| Insider network access | — | ✓ | ✓ |
| **Target list builder** — filter by trajectory, size, ownership, geography | — | — | ✓ |
| **Decision-maker mapping** — who to reach at target companies | — | — | ✓ |
| **Contact data** with warm-path routing through their network | — | — | ✓ |
| **PE/VC ownership and portfolio mapping** | — | — | ✓ |
| **Weekly personalized market brief** | — | — | ✓ |
| **Board and advisory opportunity feed** | — | — | ✓ |

### 3.4 The weekly brief — Premium

Generated, not curated by hand:

> **Your market, week of August 17**
>
> **Openings at your level:** 34 in enterprise software GM roles, Bay Area — up 6 from last week
> **New this week:** 3 companies posted President or SVP GM roles. Two are PE-backed and hiring after a platform acquisition.
> **Contracting:** Verity filed WARN, 90 positions. They were on your target list — worth pausing.
> **Comp:** the band for your target moved to $385K–$520K base, up 3% this quarter.
> **Warm paths:** you're two degrees from the CEO at Northline through Marcus H. and a Kellogg contact.
> **Board opportunity:** an audit committee seat at a PE-backed healthcare business is open to first-time directors.

**This is more useful to a job-seeking executive than a PitchBook seat**, and it's honest about being ours.

### 3.5 Workspace — Premium

LHH's differentiator was physical office space. Match it without leases:

- Private cohort space for that employer's Premium seats — peer group, shared intel, weekly facilitated session
- **Coworking stipend** — day passes at WeWork/Industrious, $200/month for the term
- Meeting-room credits for in-person networking
- Executive presence: a professional video background pack and a virtual mailing address if needed

Cost roughly $250/seat over 12 months. Preserves the benefit an employer is used to buying, without the fixed cost that makes incumbents expensive.

---

## A4. Alumni Benefits Network

### 4.1 The model

**Not user-generated courses.** A benefits program sourced through alumni relationships: alumni who work at universities, executive-education programs, professional associations, certification bodies, or training providers extend their institution's offerings to NextChapter membership, free or discounted, on terms the alum negotiates.

The institution carries the quality. The alum carries the relationship. NextChapter carries neither the content risk nor a revenue share to administer.

### 4.2 Flow

1. Alum proposes: institution, program, terms, discount, seat count, expiry, redemption method
2. **Verification** — the institution is real, the alum can authorize it. Anything material requires confirmation from an institutional email address, not the alum's word
3. Listed in the catalog with the alum credited and their relationship disclosed
4. Members redeem by code or link
5. Redemptions tracked, credited to the alum in points and standing

### 4.3 Catalog

Filterable by function, level, format, cost, time commitment, credential type. **Tied to the skills gap:**

> Your target roles ask for FP&A depth. **Kellogg exec-ed is offering members 40% off** the Corporate Finance certificate through November — sourced by Priya R.

### 4.4 Guardrails

| Risk | Handling |
|---|---|
| Authority to offer | Institutional confirmation required for material offers |
| Institution doesn't honor it | Stated remedy, delisting process, member reports it in one tap |
| Weak program reflects on us | Light curation gate, member ratings, delist on sustained poor feedback |
| Terms drift | Every offer has an owner, a review date, and auto-expiry |
| Conflict of interest | Alum's relationship disclosed on every listing |
| Vulnerable buyers | No urgency marketing, no upsells inside the search flow, total cost stated including anything not covered |
| Tax | Discounts to individuals are generally not taxable; if an employer contract funds any of it, that changes. Confirm before bundling into Premium |

### 4.5 Course completion and the Dossier

A completed course appears in the Dossier as **evidence of effort, never as a competency score.** A certificate proves someone did the work, not that they can do the job — treating it otherwise repeats the error of scoring a resume-derived Leadership grade.

---

## A5. Coach portal

### 5.1 Structured session notes

Seven tracked dimensions, each with status, trend, and coach note. This is what makes notes a diagnostic rather than prose, and what lets a second coach pick up a client cleanly.

| Dimension | Tracked |
|---|---|
| **Targeting** | Applying to the right jobs? Match quality, level fit, scattershot rate |
| **Motivation** | Energy, discouragement, momentum — coach-rated each session |
| **Networking** | Volume, warmth, reply rate, comfort trend |
| **Application volume** | Rate, conversion, right channel for their level |
| **Skills** | Named gaps, progress against them |
| **Narrative** | Can they tell their story? Gap explanation, "why you" |
| **Interview practice** | Sessions completed, stage where they lose, specific weaknesses |

Each renders as a trend line, feeds the pre-session brief, and drives intervention suggestions. Free-form notes sit underneath.

### 5.2 Portal

Everything in the four-surface audit: roster sorted by attention-needed · full client detail · coach-only layer (blockers, motivations, emotional state, tone preference, Operating Profile, detections) · auto-generated pre-session brief · action items pushed into the client's Search Action Plan · trigger alerts including good news · intervention library keyed to trigger · draft follow-up email · async check-ins · hours and outcomes · the coach's own performance dashboard.

**Integrate, don't build:** Zoom/Meet, Google/Outlook Calendar.

### 5.3 Admin-managed coaching settings

Every one of these is configuration, editable by admin, versioned and logged:

- Session rates by type and band (§2.5)
- Session length defaults
- Sessions included per plan
- Coach capacity limits (max active clients)
- Matching rules — function, level, industry, timezone, style weighting
- Assignment mode: auto-match, admin-assign, or candidate choice
- Cancellation and no-show policy, and whether the hour is consumed
- Unused-hours policy at contract end: expire, roll over, or refund
- Response-time SLA by plan
- Trigger thresholds (interviews-without-offers count, dormancy days, streak break)
- Escalation path and reassignment rules
- Session rating prompts and removal thresholds

### 5.4 Coaching operations — gaps to close

| Gap | Resolution |
|---|---|
| **Surge capacity** | A 200-person RIF lands Monday. Maintain a bench of on-call coaches with a retainer; admin sets a surge threshold that triggers outreach |
| **Coach departure mid-engagement** | Handoff protocol using structured notes — this is exactly why §5.1 exists |
| **Unused hours** | Contractual, set per employer agreement, defaulted in admin |
| **Coach-candidate mismatch** | One-tap reassignment request from either side, no blame, admin routes |
| **Quality control** | Post-session rating, escalation queue, removal threshold |

---

## A6. Recruiter portal

### 6.1 What changed

**Recruiter-administered assessments are removed.**

**Added:**
- Recruiters see candidates who have **activated accounts**, not only Dossier-complete
- **Dossier-complete candidates are promoted** — ranked higher and visually badged
- **References flagged as available for hiring-manager calls** (see §6.3)

### 6.2 Portal

Consented candidates only, never browsable · the Dossier with evidence behind each competency · designated resume version · **branded submission packet** generated with the recruiter's own logo · one-click export to Greenhouse/Lever/Bullhorn · availability and notice · feedback loop (reviewed / screened / submitted / interviewed / placed / passed with reason) · placement and fee tracking.

**Never:** Market Reality Grade, component grades, detections, badges, application history, other candidates.

### 6.3 References available for hiring-manager calls

At reference completion, ask the reference: *"If this person reaches final stages, would you take a short call from the hiring manager?"* — Yes / Maybe, ask me first / No.

Surfaced in the Dossier as **"3 of 5 references available for hiring manager calls."**

Recruiters normally collect references at offer stage, costing weeks. Having them pre-collected and pre-willing is a genuine timeline advantage and a strong reason for a search firm to prefer our candidates.

### 6.4 Admin-managed recruiter settings

- Firm onboarding, verification, and status
- Per-firm access scope and seat count
- Consent requirements and expiry windows
- Ranking weights — how much Dossier completeness promotes a candidate
- Feedback SLA and enforcement (suspend on repeated non-response)
- Fee arrangements and placement tracking terms
- Export destinations enabled per firm
- Suspension and removal

---

## A7. Employer portal

Core / Plus / Premium tiers per §2.2. Contents per the four-surface audit: enrollment (single, bulk CSV, API) · live seat utilizat

<!-- TRUNCATED IN SOURCE — message cut off here. A7 (Employer portal) is incomplete, and Parts B (design system), C (positioning/messaging/site architecture), D (competitive strategy vs. LHH/RiseSmart/Careerminds/INTOO), and E (build sequence + open decisions) were not included in this paste at all. -->
