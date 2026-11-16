# Workforce portal blueprint

Status: draft for the owner's approval, 2026-11-16. Nothing here is built unless it says so. It replaces the grown-by-feature Program
workspace with one structure built on jobs to be done. Decisions already made are marked **Decided**; open ones are in the last section.

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

## The seven verbs and the six areas

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
| Market | Current labor market data: jobs, skills, layoffs, pay against peers, migration, AI exposure. It feeds every other area |
| Reports | Everything above as reports (below) |
| Previews | The public pages, the participant view and the employer view, and how the organization controls them |

Rules for every screen: one primary action; the page background is white with clean cards, brand color on headings and actions (no gray
page); every figure says where it comes from; anything invented is labeled sample.

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

## Decided and open

Decided: design both modes; light person record with export; the seven verbs and six areas; the flows above; white page; Market section with
current data; the directory seeds from public page data.

Open:
1. Who sends partner invitations: the platform (from a verified address, with an opt-out) or the steward from their own email. Decide later.
2. Which case management system the region uses.
3. Which two flows matter most to the first customer (recommended: A and B).

## Phases

1. Look and structure: white background, areas, Home as "what needs you", previews.
2. Flows A and B end to end, ending in a real report from the ledger.
3. Market and Reports; then flows C to F.
