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

Core / Plus / Premium tiers per §2.2. Contents per the four-surface audit: enrollment (single, bulk CSV, API) · live seat utilization · aggregate engagement and outcomes at minimum cell size 10 · **time-to-placement benchmarks by function and level** · **compliance pack** proving the severance obligation was met · multi-cohort views · aggregate alumni sentiment · boomerang signal · RIF planning support · program branding · invoicing and PO terms.

**Never:** any individual, in any form. A confidential-mode member's participation must never surface.

**Role permissions:** `employer_admin` (enroll, billing, all reporting) · `employer_viewer` (reporting only) · `employer_legal` (compliance pack only) · `employer_finance` (invoices only).

---

## A8. Hiring manager portal

Dossier view for candidates submitted to their req · **generated interview guide from Dossier gaps** · **panel coordination** assigning each interviewer a different competency · structured scorecard tied to the five competencies · side-by-side comparison on shared evidence · reference questions worth asking given what's known · **90-day post-hire feedback**.

**Conflict rule:** cannot see candidates for their own reqs where a conflict is flagged — same current employer, declared relationship, same household.

---

## A9. Admin: commercial management

Beyond analytics and moderation:

- **Plan catalog** — define, price, and version every plan; effective dates; grandfathering
- **Coaching rate card** (§2.5) — versioned, effective-dated, per-coach overrides
- **Coaching settings** (§5.3)
- **Recruiter settings** (§6.4)
- **Employer contracts** — seats, term, tier, discount, PO, renewal date, utilization, renewal risk
- **Benefits Network** — offer approval queue, verification status, redemption tracking, delisting
- **Market Intelligence vendors** — licensed sources, cost, contract terms, redistribution rights on file
- **Margin dashboard** — realized gross margin per seat by tier, flagging any contract below the 45% floor
- **Consent ledger** — every recruiter introduction, what was shared, revocations

---

## A10. Open commercial questions

1. **"Own recruiter" in Premium** — dedicated NextChapter headcount, or a subsidized search-firm relationship? Headcount is cost; a relationship is margin. Decide before the price is quoted.
2. **Licensed data redistribution rights** — confirm in writing with each vendor before any Premium sale references them.
3. **Membership free-for-12-months on Premium seats** — decide whether that's a give or a line item.
4. **Volume discount floor** — 45% gross margin on Premium is the recommended stop. Confirm.
5. **Benefits Network in Premium** — if the employer pays for something alumni sourced free, decide deliberately rather than discovering it at renewal.
6. **Coach employment model** — contractor rates assume 1099. Misclassification risk rises with exclusivity and schedule control. Worth counsel before scaling the bench.

---

# PART B — Partner Design System

---

### 1. Naming

**Umbrella: NextChapter for Partners.**

A coach, a recruiter, a hiring manager, and an employer are all partners in someone's transition. The word is accurate rather than invented, it flatters the user, and it gives one clean token for the wordmark lockup.

| Surface | Name | Route |
|---|---|---|
| Coach | **NextChapter for Coaches** | `/coach` |
| Executive recruiter | **NextChapter for Recruiters** | `/recruiter` |
| Hiring manager | **NextChapter for Hiring** | `/hiring` |
| Employer / outplacement buyer | **NextChapter for Employers** | `/employer` |
| Internal | **NextChapter Admin** | `/admin` |

**Alternative if "Partners" reads as channel-sales:** *Desk* — Coach Desk, Recruiter Desk. Reads as a practitioner's workspace. Pick one and use it everywhere; do not mix.

**Never** call the candidate side anything but **NextChapter**. It is the product. Everything else is a qualified variant.

---

### 2. What stays identical

The two sides must feel like one company. Do not fork the design system.

- Navy / green palette, Volt Lime accent
- Inter + Source Serif 4
- Typographic wordmark — bold "Next", regular "Chapter"
- Every component: buttons, inputs, tables, cards, modals, toasts, empty states
- Spacing scale, radii, elevation, motion curves
- Iconography
- Voice: plain, direct, warm, unsentimental. No invented vocabulary.
- Accessibility standards

A partner-side screenshot beside a candidate screenshot should read as the same product.

---

### 3. What changes — the subtle cue

Four signals, working together. Any one alone is too weak; all four make orientation instant without a redesign.

#### 3.1 Chrome inversion — the primary cue

| Side | Top bar |
|---|---|
| **Candidate** | White / off-white, navy text |
| **Partner** | **Navy, white text** |

A persistent dark top bar is the fastest possible orientation signal. Peripheral vision catches it before anything is read. Everything below the bar stays light in both.

#### 3.2 Wordmark lockup

Candidate: **Next**Chapter

Partner: **Next**Chapter · *Coaches* — the qualifier in Inter regular, 70% opacity, at 0.7× the wordmark size, separated by a thin vertical rule.

#### 3.3 Typography

**Candidate:** Source Serif 4 for section headings, Inter for body. Serif carries warmth where someone is being told hard things about their career.

**Partner:** Inter throughout. No serif. Utilitarian by intent — these are people doing a job, not people processing a life event.

This is the most subtle of the four cues and the one that does the most work over a long session.

#### 3.4 Density

**Candidate:** spacious. One decision per screen where possible. Generous whitespace. Base row height 56px.

**Partner:** dense. Professionals want more per screen and will not thank you for whitespace. Base row height 40px. Tables over cards. Multi-column where the data supports it.

A coach managing 40 clients and a candidate managing one search need opposite layouts.

#### 3.5 Accent discipline

Volt Lime is the candidate's accent — progress, unlocks, encouragement.

On the partner side, **Volt Lime is reserved for primary actions only.** No decorative use, no progress celebration, no badges. Navy and neutral carry the interface. This keeps the partner side from feeling gamified, which would undercut its credibility with professionals.

---

### 4. Role context banner

Required whenever an identity holds more than one role grant.

Persistent, directly under the top bar:

> **You're in Coach view.** Marcus Hollander · Switch to → *Candidate*

**Rules:**
- Always visible when multiple roles exist, never dismissible
- Switching requires re-authentication — see the identity wall in `NextChapter_Portals_Plans_Pricing.md` §1.2
- The banner names the current role explicitly. Never rely on chrome color alone.
- On the employer side, additionally name the account: *"You're in Employer view — Meridian Health."*

---

### 5. Per-surface accent

Within the navy chrome, each surface carries one restrained identifying element — a left-nav accent rule and the wordmark qualifier. Nothing more.

| Surface | Accent |
|---|---|
| Coach | Warm sand |
| Recruiter | Slate blue |
| Hiring | Deep teal |
| Employer | Muted plum |
| Admin | Graphite |

All at low saturation, all passing contrast against navy. These identify a surface at a glance for someone who works across several. **Do not extend them into buttons, charts, or data visualization** — those use the shared palette so a chart means the same thing everywhere.

---

### 6. Shared component adaptations

| Component | Candidate | Partner |
|---|---|---|
| Data table | Rare, card-based | Primary pattern — sortable, filterable, dense, exportable |
| Empty state | Encouraging, names the next step | Factual, states the filter that produced it |
| Progress | Celebrated — unlocks, badges, movement | Reported — a number and a trend, no celebration |
| Charts | Simple, one message | Full analytical set, comparison and drill-down |
| Notifications | Supportive, well-timed | Actionable, batched, filterable |
| Search | Simple | Advanced with saved queries |
| Bulk actions | None | Standard |
| Keyboard shortcuts | Minimal | Full navigation, `/` to search, `j/k` to move rows |

---

### 7. Voice, adjusted

Same principles, different register.

| Candidate | Partner |
|---|---|
| "Your search looks moderately difficult." | "Search difficulty: moderate. Driver: Your Market." |
| "You're 40 points from the top 10." | "Rank 14. 40 points from top 10." |
| "Nice work — that's your best week yet." | "Best week: 185 points, up from 160." |
| "Let's fix three things on your resume." | "3 open resume issues. 2 high impact." |

**Never** carry candidate-facing encouragement into partner views. A coach reading "Nice work!" about their client's data will not trust the tool.

**Never** carry partner-side clinical framing into candidate views. Both directions are failures.

---

### 8. Build notes

- One design token set. Partner variants are token *values*, never a second system.
- Theme by route group at the layout level: `(candidate)` and `(partner)`. Chrome, type, and density derive from it.
- One component library. If a component needs a partner variant, it takes a `density` prop — never a forked component.
- Role context is server-resolved and rendered before hydration. A flash of the wrong role is a trust failure, not a visual bug.
- Screenshot tests on both variants of every shared component.
- Verify contrast on every per-surface accent against navy chrome.

---

# PART C — Positioning, Marketing & Waitlists

---

## C1. Positioning

### 1.1 The core insight

**A resume is the least complete thing about you.**

It shows what you did. It cannot show how you did it, how you handle pressure, or what the people who worked with you would actually say. Every hiring decision turns on those things, and every candidate walks in with only the document that can't speak to them.

**NextChapter builds the document that can.**

This one idea carries every audience. Candidates understand it instantly. Employers understand why it places people faster. Recruiters understand why our candidates are easier to submit. Hiring managers understand why they can interview better.

### 1.2 Positioning statement

> For senior professionals in transition, NextChapter turns a job search into verified evidence. Your resume says what you did. Your Executive Dossier proves how you work — corroborated by the people who worked with you.
>
> For the companies that fund it, that means people land faster, with proof instead of promises.

### 1.3 What we will not claim

Until there is outcome data, **no placement-speed or success-rate claims.** Not "40% faster," not "90% placed," not "average 3 months." These require substantiation, and an unsubstantiated performance claim in a B2B sale is both a legal exposure and the fastest way to lose a CHRO's trust.

**Claim what the product does, not what it produces.** "Five structured references, scored consistently, in a document you control" is verifiable. "Land 40% faster" is not, yet.

Revisit once the recruiter feedback loop and employer outcome data have run long enough to support a claim.

---

## C2. Messaging by audience

### 2.1 Candidates

**Headline:** Your resume is the least complete thing about you.

**Subhead:** NextChapter shows you exactly how the market reads your search — then helps you build the evidence that changes it.

**The three beats:**

1. **Know where you stand.** A Market Reality Grade that tells you how hard this search will be and which of the five things driving it are in your control. Not a judgment of your career — an estimate of the work ahead.
2. **Fix what's fixable.** Your resume tested against the eleven systems that actually read it. Every issue, with the fix, in about twenty minutes.
3. **Build what your resume can't say.** Five references, structured and scored. Two validated assessments. One Executive Dossier you keep forever.

**Free, always.** Say it plainly and early — it's true, and it's disarming for someone who just lost a job.

**Emotional register:** direct, warm, unsentimental. No consolation. Someone fired this morning does not need sympathy from a website; they need to believe there's a plan.

### 2.2 Employers — outplacement buyers

**Headline:** Outplacement that produces proof, not a portal.

**Subhead:** Your departing employees get a verified Executive Dossier and real coaching. You get live reporting, compliance documentation, and a bill that's 35% smaller.

**The four beats:**

1. **They leave with something durable.** Not a login that expires — a Dossier they keep, references that stay collected, and a membership that outlasts the contract.
2. **You see what's actually happening.** Live seat utilization and aggregate outcomes, not a quarterly PDF.
3. **Legal gets what it needs.** An exportable compliance pack proving the severance obligation was met, per employee.
4. **35–40% less than the incumbents.** We don't carry their offices or their sales structure.

**The trust line, stated on the page:** *You will never see an individual's activity, grade, or whether they used it. That boundary is in the contract, and we tell your employees about it.*

That paragraph sells to both sides at once. HR buyers respect it; departing employees need it.

### 2.3 Coaches

**Headline:** Stop rebuilding context before every session.

**Subhead:** Every client's search, scored and current — targeting, motivation, networking, applications, skills, narrative, interview practice — with a generated brief waiting before you dial in.

**Beats:** roster sorted by who needs you, not alphabetically · pre-session brief generated from real activity · action items that land in the client's plan instead of dying in an email · your own outcome data, which nobody has ever given you.

**Supply-side pitch:** clients arrive pre-diagnosed. You spend the hour coaching, not intake.

### 2.4 Recruiters

**Headline:** Candidates who arrive with their references already done.

**Subhead:** Every NextChapter candidate comes with five structured references, two validated assessments, and a Dossier you can put in front of a client under your own brand.

**Beats:** references pre-collected and pre-willing to take hiring-manager calls · a branded submission packet generated from the Dossier · one-click export into Greenhouse, Lever, or Bullhorn · consented candidates only, never a scraped database.

**The compression claim, which is safe to make:** references normally get collected at offer stage. Ours are done before you meet them.

### 2.5 Hiring managers

**Headline:** Interview better, not longer.

**Subhead:** Every candidate arrives with evidence already gathered — so your panel can probe what nobody has answered yet.

**Beats:** a generated interview guide built from what the Dossier does *not* cover · panel coordination so four people don't ask the same question · structured scorecards comparable across interviewers · reference questions worth asking, given what's already known.

### 2.6 Alumni and members

**Headline:** Never start from zero again.

**Subhead:** You just did the hardest professional thing there is. Keep the evidence current so the next time takes weeks, not months.

**Beats:** your Dossier stays alive · quarterly market check with comp movement · benefits from institutions our alumni bring in · board and advisory listings · break-glass reactivation in a day.

---

## C3. Site architecture

### 3.1 Homepage

**Speak to candidates.** That's the emotional story, the SEO volume, and the top of every funnel — including the employer one, since HR buyers are also people who will be job-searching someday.

Give employers a prominent, unmissable path. Do not split the hero.

**Structure:**

1. **Hero** — "Your resume is the least complete thing about you." Primary CTA: *See how the market reads your search — free.* Secondary, top-right and visible: *For employers →*
2. **The problem, in one screen** — the 15 competency cells, with the two a resume can fill highlighted and thirteen greyed. Show it, don't argue it.
3. **The three beats** (§2.1)
4. **Proof of the diagnosis** — an anonymized sample Market Reality Report. Real output beats any description.
5. **The Dossier** — what it contains, who sees it, that they keep it
6. **Free, always** — stated plainly
7. **Audience router** — five clean cards: Employers · Coaches · Recruiters · Hiring managers · Alumni
8. **Waitlist or signup**

### 3.2 Landing pages

| Page | Route | Primary CTA |
|---|---|---|
| Candidates | `/` | Start free |
| Employers | `/employers` | Book a walkthrough |
| Coaches | `/coaches` | Apply to coach |
| Recruiters | `/recruiters` | Request access |
| Hiring managers | `/hiring` | Request access |
| Alumni & membership | `/membership` | Join |
| Pricing | `/pricing` | — |
| How it works | `/how-it-works` | — |
| The Dossier | `/dossier` | — |
| Security & privacy | `/security` | — |

**Every landing page follows one structure:** headline · subhead · the beats · one concrete artifact (screenshot or sample output) · objection handling · CTA. No page ships without a real artifact — abstract benefit copy converts far worse than a picture of the thing.

### 3.3 Pages that carry disproportionate weight

**`/employers`** — this is the revenue page. It needs: the trust boundary stated in full · a sample compliance pack · a real reporting screenshot · price transparency (see §3.4) · the tier comparison · a walkthrough booking flow, not a contact form.

**`/security`** — enterprise procurement will find this page before sales does. It needs: data handling, the employer/candidate boundary, subprocessors, retention, deletion, and an honest current state on SOC 2 ("in progress, expected [date]") rather than silence. Silence reads worse than a roadmap.

**`/dossier`** — the whole product in one page. Show a real Dossier. Explain what's verified and what isn't, plainly: *these are what five people said about working with you, collected and scored consistently. We don't independently verify their claims, and we don't pretend to.*

### 3.4 On publishing prices

**Publish candidate and membership prices.** Transparency converts, and there's no negotiation.

**Publish outplacement list prices with "volume pricing available."** Incumbents hide pricing, which is exactly why publishing it is a wedge — a CHRO who can see $2,450 next to a remembered $6,000 quote will take the call. The risk is anchoring low on large deals; the volume-discount line handles it.

---

## C4. Waitlists

### 4.1 Why waitlists, and what they're really for

Pre-launch, a waitlist is not a mailing list. It is **qualification and sequencing data**. Every question should either route the person or tell sales something.

Separate lists per audience. Never one form with a role dropdown — the questions differ too much and completion drops.

### 4.2 Candidate waitlist

Minimal. This audience should convert to product, not to a list.

- Email
- Current or most recent title
- Situation: worried / resigned / laid off / re-entering / employed and exploring
- Optional: resume upload

**If the product is live, skip the waitlist entirely** and send them into onboarding. A waitlist for a free product is friction with no purpose.

### 4.3 Employer waitlist — the important one

Every field is sales intel.

- Work email *(business domains only — the qualifier)*
- Company, role, company size
- **Are you evaluating outplacement now, in the next 6 months, or exploring?**
- **Current provider** — LHH / Randstad RiseSmart / Careerminds / INTOO / none / other
- Anticipated volume: under 10 / 10–50 / 50–200 / 200+
- Levels affected: IC / manager / director / VP+ / mixed
- What matters most: cost / outcomes / reporting / employee experience / speed
- Timeline

**Auto-scoring:** evaluating now + 50+ seats + has an incumbent = immediate outreach. Everything else nurtures.

**Confirmation should give something:** a sample compliance pack and a one-page cost comparison. Not "we'll be in touch."

### 4.4 Coach waitlist — an application, not a list

- Name, email, LinkedIn
- Coaching experience — years, certifications
- Functional and level specialties
- Industries
- Capacity — clients per month
- Timezone and languages
- Rate expectation
- Have you coached through a layoff or RIF?

Screening matters more than volume. A weak coach damages the product more than an empty bench.

### 4.5 Recruiter waitlist

- Firm, name, work email
- Retained / contingent / in-house
- Functions and levels placed
- Typical search volume
- ATS in use *(feeds the export integration roadmap)*
- Geographies

### 4.6 Alumni and membership

Opened at placement, not before. The only moment it converts.

### 4.7 Mechanics

- Double opt-in on every list
- Confirmation delivers something concrete
- Per-audience nurture, differently paced — employers weekly with substance, candidates only when the product is ready for them
- One-click unsubscribe, honored immediately
- **Never email an address parsed from an uploaded resume.** Consent comes from the form. This is the same CASA boundary as the product.
- Referral capture on every list — this audience refers heavily, and peers of a laid-off executive are often laid off too

---

## C5. Content and organic

Bootstrapped means organic is the channel that matters. Both audiences search.

**Candidate-side, high intent:**
- "how to explain a gap on a resume"
- "does Workday reject resumes"
- "executive resume format"
- "what to do when you're laid off at 50"
- "how to ask for a reference"

Each maps to a real product capability. The article ends in the tool that does the thing.

**Employer-side, high value:**
- "outplacement cost per employee"
- "LHH alternatives"
- "outplacement RFP template"
- "WARN Act notification requirements"
- "what does outplacement actually include"

**Programmatic, at scale:** company pages already generate hiring trajectory, WARN history, skills demanded, and posting age per employer. That is a large, genuinely useful, indexable content set nobody else has — and it doubles as the insider network's front door.

**Publish the comparison honestly.** "NextChapter vs LHH" written fairly, including where LHH is stronger (global footprint, coach supply, brand), converts better than a one-sided table and is the page a CHRO actually forwards.

---

## C6. Build notes

- One design system across marketing and product (`NextChapter_Partner_Design_System.md`). Marketing uses the candidate variant.
- Every landing page carries a real artifact. No stock photography, no abstract illustration of "career growth."
- Waitlist submissions write to the CRM with source, audience, and score.
- Employer page and `/security` are the two that get read before a sales call. Treat them as sales collateral, not marketing pages.
- Nothing on the site claims a placement rate, speed, or success percentage until there is data to substantiate it.

---

# PART D — Competitive Strategy

---

## D1. Where they're actually weak

Be accurate. Attacking a weakness they don't have makes you look like you don't know the category.

| Weakness | Why it's structural |
|---|---|
| **Price** | Physical offices, enterprise sales overhead, coach-heavy delivery. They can discount but they can't restructure. |
| **Reporting latency** | Quarterly PDFs. Their reporting was built for a pre-SaaS buying process. |
| **Nothing durable for the candidate** | Access expires with the contract. The person leaves with a lapsed login. |
| **Generic delivery at volume** | Large caseloads, templated curriculum. Fine at the executive tier, thin below it. |
| **Sold, not chosen** | Frequently bundled into a staffing relationship rather than evaluated on merit. Buyers rarely compared. |
| **No measurement** | They don't score anything, so they can't tell an employer what's actually happening. |

### 1.1 Where they're genuinely stronger — say so

Credibility depends on this. A one-sided comparison gets discounted entirely.

- **Global footprint** — 60+ countries with local labor-law knowledge
- **Coach supply** — thousands, at scale, on demand
- **Procurement readiness** — SOC 2, MSAs, insurance, references
- **Brand safety** — nobody was fired for hiring LHH
- **Physical services** — offices and in-person workshops where a contract requires them

**Concede these clearly and redirect:** *If you're running a 12-country reduction, use LHH. If you're running a US reduction and want your people to land faster with proof they keep, that's us.*

That sentence wins more deals than any feature table.

---

## D2. The plays

### 2.1 The Trojan horse — candidates already in a competitor's program

**The single most aggressive and most legitimate move available.**

> **Already enrolled in outplacement? Use us alongside it. Free.**
>
> Your employer bought you a program. Keep it. Add the Market Reality Report, Resume Studio, and your Executive Dossier at no cost — and see the difference for yourself.

Why it works:

- Zero switching cost, zero risk, no permission needed
- The candidate becomes the internal advocate at the company that bought the incumbent
- They generate a direct comparison you didn't have to run
- **They tell their former HR contact** — and that contact owns the renewal
- Every one becomes a case study and a reference

Instrument it: ask enrolled candidates who their provider is, capture their comparison, and route the strongest to sales as warm employer intel.

### 2.2 RFP hijacking — buyer enablement as a weapon

Publish a free **Outplacement RFP Template** and a **Vendor Evaluation Scorecard.** Make them genuinely useful and vendor-neutral in tone.

Then load them with the questions incumbents answer badly:

- What written deliverable does the participant retain after the contract ends?
- What is your reporting latency — real time, monthly, or quarterly?
- Can we see utilization the day a cohort is enrolled?
- What percentage of participants complete a structured reference process?
- What documentation do you provide proving the severance obligation was met?
- What is the participant-to-coach ratio at each tier?
- What happens to the participant's data and access at contract end?
- Can you provide time-to-placement benchmarks by function and level?

Every one is a question we answer well and they answer poorly. Companies download it, run their process with it, and the incumbent loses on the buyer's own scorecard rather than on our pitch.

**This is the highest-leverage marketing asset in the plan.** It scales, it's genuinely helpful, and it reframes the category on terms that favor us.

### 2.3 Renewal-window targeting

Outplacement contracts renew annually and are rarely competitively bid.

The WARN agent already identifies companies running reductions. Extend it into a switching-signal score:

| Signal | Source |
|---|---|
| WARN filing | Existing agent |
| Hiring contraction | `ncrawl` posting trajectory |
| Members listing them as current employer, searching | Internal, aggregate only |
| Known incumbent | Waitlist intel, candidate reports, public sources |
| Leadership change in HR | News monitoring |

Rank and work the top of that list. A company in the middle of a reduction with an incumbent they never compared is the most winnable deal in the category.

### 2.4 Price transparency as attack

They hide pricing. Publish yours.

Add a **cost calculator**: seats × tier, with an "estimated incumbent cost" range beside it. A CHRO seeing $2,450 next to a remembered $6,000 quote takes the call.

Publish list prices with "volume pricing available" to protect large-deal anchoring.

### 2.5 The pilot offer

> **Run us alongside your incumbent for one cohort.**
>
> Split your next reduction. Same people, same window. Compare utilization, compare what participants say, compare what you can see.

Low risk for the buyer, high confidence signal from us, and it produces the outcome data we need to make claims later. Structure it as a paid pilot at Core pricing — free pilots attract tire-kickers and devalue the product.

### 2.6 Coach recruitment

Incumbent coaches are typically contractors carrying large caseloads with weak tooling.

The pitch: better tools, better rates, clients who arrive pre-diagnosed, and your own outcome data. The Coach portal is a genuine recruiting asset — most of them have never seen anything like it.

**Legal boundary:** do not induce breach of an enforceable non-solicit or non-compete. Recruit openly, ask candidates to confirm they're free to engage, and don't target a specific competitor's roster as a list.

### 2.7 The category narrative

Own the argument that **outplacement is measured wrong.**

The industry sells access — a coach, a portal, a job board — and reports on utilization. Nobody reports on what the participant *produced*. Make that the argument, publicly and repeatedly.

Content that carries it:
- "What outplacement actually costs, and what you get"
- "The questions to ask an outplacement vendor"
- "Why your outplacement report says nothing"
- "What happens to your outplacement account when the contract ends"

Truthful, specific, and it reframes the category on our axes.

### 2.8 Comparison pages, written fairly

`/vs/lhh` · `/vs/randstad-risesmart` · `/vs/careerminds` · `/vs/intoo`

**Include where they win.** A page that concedes global footprint and coach scale, then wins on price, durability, reporting, and measurement, is the page a CHRO forwards internally. A one-sided table gets dismissed as marketing.

Structure: what each is best for · honest feature comparison · pricing comparison · what participants keep · what the employer sees · when to choose them instead.

### 2.9 Search

Bid on competitor brand terms and "alternatives" queries — legal in the US and standard practice.

**Ad copy must not use their trademark** in headline or display URL. Bid the keyword, write neutral copy: *"Outplacement that produces proof — 35% less, real-time reporting."*

Organic targets: "LHH alternatives," "outplacement cost per employee," "outplacement RFP template," "RiseSmart vs LHH," "outplacement for executives."

---

## D3. Boundaries

Aggression that crosses these turns into a lawsuit or a credibility loss, and both cost more than the deal.

| Do | Don't |
|---|---|
| State verifiable facts about competitors | Make claims you can't document |
| Publish honest comparisons | Disparage — false statements of fact about a competitor's product are actionable |
| Use their name for accurate comparison (nominative fair use) | Use their logo or mark in ads, or in a way implying affiliation |
| Cite public sources — pricing reports, reviews, filings | Cite anonymous claims or unverifiable anecdotes |
| Recruit coaches openly | Induce breach of an enforceable non-solicit |
| Encourage candidates to use both | Suggest anyone violate a program's terms |
| Say "35% less than typical enterprise outplacement pricing" | Say "40% faster placement" without data |

**One rule above all:** every competitive claim must be documentable. Keep a substantiation file with the source for every comparative statement on the site. When a competitor's counsel writes — and at some point they will — the file is the entire defense.

---

## D4. When they respond

They will, and their moves are predictable.

| Their move | Our answer |
|---|---|
| **Undercut on price** | They can discount but can't restructure. Compete on what the participant keeps and what the employer sees, not on price. Never match a discount below the 45% margin floor. |
| **FUD on security and SOC 2** | The only real one. Publish `/security` honestly, start the SOC 2 observation window now, and answer with a date rather than a deflection. |
| **"They're unproven"** | True, and answered with a paid pilot on one cohort. |
| **Global footprint** | Concede it. Redirect to US-only reductions, where most of the market is. |
| **Coach supply during a surge** | Maintain a retained bench and publish the response-time SLA. Under-promise capacity rather than miss it. |
| **Bundle it into a staffing relationship** | Attack the bundling itself: *you were sold this, not shown it.* The RFP template does this work. |

---

## D5. Sequencing

1. **RFP template and evaluation scorecard** — highest leverage, works before the product is fully built, reframes every deal
2. **Comparison pages** — captures the search demand the template creates
3. **Trojan horse offer** — costs nothing, generates advocates and intel inside target accounts
4. **Renewal-window targeting** from the WARN agent — the sales list writes itself
5. **Paid pilot offer** — converts the pipeline the first four create
6. **Coach recruitment** — as demand requires
7. **Category content** — continuous

---

## D6. Build notes

- Switching-signal scoring extends the existing WARN lead-generation pipeline. Do not duplicate it.
- Capture incumbent provider on the employer waitlist and from candidates using the Trojan horse offer. That field is the sales list.
- Substantiation file lives with marketing, updated on every competitive claim, reviewed quarterly.
- Comparison pages need a review date — competitor pricing and features change, and a stale claim is the one that draws a letter.

---

# PART E — Build sequence and open decisions

## E1. Sequence

| # | Build | Why here |
|---|---|---|
| 1 | **Identity architecture** — one record, role grants, session wall | Gets exponentially more expensive later, and every portal depends on it |
| 2 | **Coach portal** | The coaching product is already sold and has no surface |
| 3 | **Admin: commercial management** — plan catalog, coaching rate card, coaching and recruiter settings | Nothing else can be operated without it |
| 4 | **Employer portal** | Blocks the first outplacement contract |
| 5 | **Admin moderation queue** | Community cannot launch without it |
| 6 | **Recruiter portal** | Its feedback loop is the only path to validating scoring weights |
| 7 | **Hiring manager portal** | Follows recruiter |
| 8 | **Alumni and membership** | Design now, build at placement — that moment only comes once |

Marketing runs in parallel and does not wait for the portals. The RFP template and comparison pages work before the product is finished.

## E2. Open decisions

These affect pricing or expose real risk. Resolve before the relevant surface ships.

1. **"Own recruiter" in outplacement Premium** — dedicated NextChapter headcount, or a subsidized search-firm relationship? Headcount is cost; a relationship is margin. Changes Premium's margin by roughly ten points. **Decide before quoting.**
2. **Licensed data redistribution rights** — confirm in writing with every vendor before any Premium sale references Market Intelligence. PitchBook cannot be resold; do not let it reach a deck.
3. **Membership free for 12 months on Premium seats** — a give, or a line item?
4. **Volume discount floor** — 45% gross margin on Premium is the recommended stop. Confirm.
5. **Benefits Network inside Premium** — if an employer pays for something alumni sourced free, decide deliberately rather than at renewal.
6. **Coach employment model** — contractor rates assume 1099. Misclassification risk rises with exclusivity and schedule control. Worth counsel before scaling the bench.
7. **SOC 2 observation window** — start now. It is a calendar problem, not an engineering one, and it is the strongest attack a competitor has.

## E3. Cross-surface rules — enforce everywhere

1. **Confidential Search Mode is checked at every render and send path.** One missed check exposes a live job.
2. **The Market Reality Grade never leaves the candidate and their coach.** It is a search-difficulty estimate, not a quality score. A recruiter shown a "D" will filter on it.
3. **Detections never leave the candidate and their coach.**
4. **Blockers, motivations, and emotional state never leave the coach.** Enforce at the query layer.
5. **Employers see aggregates only**, minimum cell size 10, with the differencing mitigations in §1.3.
6. **Recruiters see only consented candidates**, per introduction, revocable.
7. **Every individual-record view on any partner surface is logged with a reason.**
8. **No "at-risk member" list exists anywhere.** Distress routes to a coach with a support offer, never an operations queue.
9. **No claim of placement rate, speed, or success percentage** until outcome data substantiates it.

## E4. Verification

1. No recruiter-facing query returns a Market Reality Grade, component grade, or detection.
2. No employer-facing query returns an individual identifier.
3. Blockers, motivations, and emotional state appear in no admin, recruiter, or employer query.
4. A Confidential Search Mode member appears on no employer surface, and requires per-instance consent for recruiters.
5. Minimum cell size 10 holds on every employer aggregate; 5 on every admin aggregate.
6. Employer aggregates round below 50 seats; cohorts under 20 report quarterly.
7. Every recruiter introduction writes a consent ledger row; revocation removes access immediately.
8. No surface renders members ranked by distress.
9. An identity holding two role grants cannot resolve its own candidate record from any org-side surface.
10. Role context resolves server-side before hydration — no flash of the wrong role.
11. Every partner-side surface renders navy chrome, Inter-only type, and the role context banner when multiple grants exist.
12. Seed data populates coach, recruiter, hiring, and employer surfaces with no empty states.
