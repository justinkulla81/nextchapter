# Workforce portal blueprint

Status: draft for the owner's approval, 2026-11-16. Nothing here is built unless it says so. It replaces the grown-by-feature Program
workspace (now named **Talent Hub**) with one structure built on jobs to be done. Decisions already made are marked **Decided**; open ones are in the last section.

## Name (**Decided**: not "Program")

A workforce organization may run programs; those are its own, and the workspace lists them as Programs under Training. The workspace itself is
called **Talent Hub** (the rail item and page heading). "Program" is not used for the portal or for what the organization offers as a whole. For
a person, the organization shows up as a **group** they belong to.

## What the portal is for

A workforce organization turns money and partners into outcomes for people. Today the pieces live apart: the state case management
system holds the people it enrolls, a CRM holds partners, spreadsheets hold grants, PDFs hold labor market data. Nobody can follow one thread,
from "layoff announced" to "who got help, through which partner and which grant, with what result."

The portal is that thread: a tool for the organization to **manage itself, its partners, its funding and its candidates**, and to see the
result in reports.

## Who uses it (**Decided**: design for both)

One core, two modes. The mode changes the Home screen, the vocabulary and the default reports, not the data.

| | Workforce board mode | Economic development or chamber mode (One Louisville) |
|---|---|---|
| Home leads with | Layoffs to answer, referrals to and from the state system, co-enrollment | Attraction, employer relations, household counts, funding proof |
| Compliance | Aware of WIOA outcome indicators; no wage-record claims (only the state can match wages) | Grant reporting (for example the Talent Recruitment Grant: households, cost per household, proof, match) |
| Reports | Board report, funder packs | Funder packs, public snapshot, employer view |

## Case management stance (**Decided**: light person record, export to the formal system)

A case management system is the public system's legal record of each person it enrolls: eligibility proof, an employment plan, services and
dates, funds spent, case notes, exit and follow-up, and quarterly federal reporting checked against state wage records. It holds sensitive
data (Social Security numbers) and exists for federal compliance.

We are **not** that system. We are the engagement and coordination layer with a light person record, with the person's consent: a plan,
services received, a next best action, outcomes. Someone who enrolls in the formal system is referred and exported, not duplicated. This is
where the gap is: professionals rarely enter the public system, so nothing tracks them today.

Open: which system the region uses (Geographic Solutions, a Salesforce build, other). Not confirmed.

## The seven verbs and the areas

**Verbs** (what the organization does; Home shows one tile for each, with status and what needs you):
Attract · Retrain · Support (layoff response) · Train · Fund · Understand (labor market) · Coordinate

**Areas** (where the records live):

| Area | Holds |
|---|---|
| Home | What needs you this week: layoffs to act on, deadlines, commitments due, headline outcomes |
| People | One record per person across tracks (laid off, moving here, pivoting, growing, new graduate), with consent |
| Employers | Member companies, layoffs and response, hiring, pledges, upskilling, job specs |
| Partners | Colleges, training providers, the board and job centers, community groups: directory, claim status, commitments, referrals |
| Funding | Opportunities, applications, awards, match, compliance |
| Jobs | The jobs in the region: see them all, add a job, add listings from elsewhere, feature the ones that go first to the program's people |
| Market | Current labor market data: jobs, skills, layoffs, pay against peers, migration, AI exposure. It feeds every other area |
| Reports | Everything above as reports (below) |
| Public presence | Every public page the organization controls (inventory, status, edit, publish), plus the participant and employer previews |

Rules for every screen: one primary action; the page background is **white** with clean cards and **the organization's own color as the accent**
(headings, active states, actions; text color picked for contrast; no gray page); every figure says where it comes from; anything invented is labeled sample.

## Flows (use cases, each ending in a report)

**A. Layoff response.** Trigger: a WARN filing or a member company's notice. Steps: notice received, employer contacted, benefits session,
career seats opened, hiring pool matched (consent first), training offered. Records: the layoff, the people who join (self-registered through a
link), services, outcomes. Report: who was reached, who landed, where, at what pay, kept in region.

**B. Funding cycle.** Trigger: an opportunity fits. Steps: find, decide fit, assemble partners, apply (the nonprofit or local board applies; a
company joins as a partner), award, track match and outcomes, report. Records: opportunity, partners and commitments, match ledger, proof.
Report: the funder's pack, from the same ledger.

**C. Skills to training.** Trigger: a skills gap in current postings. Steps: demand signal, gap against partner programs, a cohort with a partner
college, enrollment, placement. Report: gap closed, completion, placement.

**D. Attract and relocate.** Trigger: a campaign or a visit to a public page. Steps: interest (consent-based), the offer (jobs, benefits, cost of
living, schools), concierge (partner job search, housing, welcome network), proof of a move, retention. Report: households, cost per
household, proof on file.

**E. Employer partnership.** Steps: recruit, pledge, upskill, hiring commitments, scoreboard. Report: commitments made and kept.

**F. Grow the ecosystem.** Steps: directory (seeded from public page data we already have), invite, partner claims its page with a work email
at its domain, steward confirms, partner completes its profile, commits, participates. The partner owns its content; the steward decides what
appears under its program and can de-list. Report: ecosystem health (claim rate, completeness, referrals, commitments due).

## Reporting: one outcomes ledger

Every event for a person (enrolled, completed, placed, moved) is one ledger row with its source, the partner and the funding behind it, and
the person's consent. Every report is a view of the ledger: funder packs, the board report, a public snapshot, an employer view. Counts under
five are hidden. This ties each outcome to the partner and the money behind it, which the usual tools do not.

## Make Louisville the most attractive place

Two audiences, scored against peer metros in Market, each gap becoming an action:
- **Professionals:** jobs and pay, cost of living, housing, schools and safety, universities, community, benefits we offer (Attract).
- **Employers:** talent supply, skills pipeline, cost, speed to hire, incentives, layoffs as a hiring pool (Employers).

## Public pages and the portal (Previews) (**Decided**: show how they connect and who controls them)

| Public page | Feeds | The organization controls |
|---|---|---|
| Claimed organization page | Partners, People | Content, branding, which services show, publish and unpublish, verified owner, analytics |
| A layoff page and the organization's sign-up link | Support (flow A) | The seat pool, the message, who can see counts |
| Relocation interest form (not built) | Attract, People | Consent text, follow-up, where leads go |
| Employer pledge page | Employers | What is public |

## The participant's side

The program is a group in the person's own account: discussion, a shared resources and benefits library, events, ask-an-expert. Staff can
moderate. People choose their own visibility. The program sees counts, never a person's search; employers never see individuals unless the
person says yes. We never write to a member's Google account.

## Home page

The Home page opens with a **splash picture of the place** (downtown or an economic image) that **the organization uploads**, with its logo; until it does,
a generic placeholder image shows (**Decided**) and the organization's high-level stats, then what needs
the team this week.
- **Picture and logo:** the organization uploads them. Until then, a generic placeholder. We do not take pictures from the web.
- **Stats:** from Market (jobs open, unemployment rate and labor force, the figures the organization chooses to headline), each with its source and date.
- **Best-of rankings and awards:** from our own rankings where the place ranks (for example best places for white-collar professionals), and awards the
  organization adds itself with a source link. Nothing is invented.

## Jobs

The organization sees all jobs in its region, and can **add a job** (a form), **add listings from elsewhere** (paste links, upload a spreadsheet, or connect
an employer's job feed), and review a queue before anything is published. Each listing shows where it came from and links to the employer's own career
site. The organization can feature jobs so the program's people see them first. Employers can submit their own jobs through the Employer view.

## Red zone: long-term unemployment

People in the program who have been out of work **26 weeks or more** (BLS counts 27 and over as long-term; we use 26 as the owner chose) are a segment in
People, with a watch list at 18 to 25 weeks. Each row shows the track, weeks out, services used and the next action (outreach, coaching, retraining,
supportive services). Only people in the program, and detail only where the person shares it; counts under five are hidden. The Home page shows the
count, and Reports tracks how many leave the red zone for work.

## Skills intelligence (the killer use case)

Three views of one skills picture for the region:
1. **Demand:** the skills in local job postings, by occupation and employer.
2. **Supply:** the skills in local people's résumés, from consented résumé analysis (the program's participants, plus members in the region who allow
   anonymous totals; the area brief already reports totals this way). Aggregates only; groups under five are hidden.
3. **Gap:** demand minus supply, by skill and occupation, and for each person their own gaps against local jobs.

Who uses it: the organization (where to put money and cohorts), colleges and training providers (what to teach), employers (how deep the local pool is),
and each person (what to learn next). It needs one skills vocabulary applied the same way to postings and résumés; the current keyword list is a
starting point, not the final method.

## Anonymous candidate profiles (**Decided**: go with anonymous totals, and show candidates as A, B, C)

For employers, colleges and the organization itself, a list of de-identified candidates ("Candidate A", "Candidate B"...), each showing industry,
seniority band, function, time out of work, skills and a short summary, plus totals and summaries across them. Anyone can say "this is the talent
here" without seeing who anyone is.
Guardrails, because a list of rare combinations can identify a person even without a name:
- Coarse bands only: industry, function and seniority bands, weeks out in ranges. No name, employer, school, exact title, dates or free text.
- A combination that fewer than five people share is generalized (a wider band) or left out.
- A person appears only if they allowed anonymous profiles; an employer or college that wants to reach someone sends an introduction request, and the
  person decides (the existing share-profile choice).
- Totals use the same minimum group size. The method is logged so counsel can review it.

## Sharing data with colleges and employers

What can be shared: skills demand and supply, jobs, training and education programs, and the gaps between them. How, in order of build:
1. **Partner views.** A claimed partner sees a scoped, read-only view: colleges see skills demand and gaps against their programs; employers see talent
   supply and their own pipeline. Aggregate by default.
2. **Shareable snapshots.** A link or embed for a report, with a stated audience, purpose, scope and expiry, and a log of who opened it.
3. **Program and job feeds.** A published catalog of training and education programs, and a jobs feed, that partners and the public can read
   (including as structured data so search engines understand it).
4. **API and exports** later; the portal already issues organization API keys for census data, which is the pattern to extend.
Rule: individuals are never shared. Row-level detail goes only to the person's own consented recipients.

## Public presence

One screen lists **every public page the organization controls**: its claimed page, layoff pages for employers in its region, the relocation page,
employer and partner pages, events, and the program and job feeds. Each shows its status (published, draft, unclaimed), who can edit it, what it feeds in
the portal, its visits, and an edit and unpublish control.

## Decided and open

Decided: the workspace is called Talent Hub; data sharing starts with partner views, then snapshots; anonymous totals and Candidate A, B, C profiles;
the organization uploads its splash picture and logo (a generic placeholder until then); design both modes; light person record with export; the seven verbs and the areas; the flows above; white page with the organization's accent;
Market section with current data; the directory seeds from public page data; a Home with a splash picture, stats and rankings; Jobs the organization
can add to; a red zone at 26 weeks; skills demand, supply and gaps; data sharing with partners.

Open:
1. Who sends partner invitations: the platform (from a verified address, with an opt-out) or the steward from their own email. Decide later.
2. Which case management system the region uses.
3. Which two flows matter most to the first customer (recommended: A and B).
4. Counsel's review of the anonymous totals and candidate profiles (including members who are not in the organization's own group), before they ship.

## Phases

1. Look and structure: white background, areas, Home as "what needs you", previews.
2. Flows A and B end to end, ending in a real report from the ledger.
3. Market and Reports; then flows C to F.
