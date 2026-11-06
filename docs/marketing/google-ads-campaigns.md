# Google Ads campaign build sheet

Status: ready to build in the Google Ads account. Nothing here has been created in the account yet (no Google Ads
connector or API credentials are available to Claude). Budgets and bids are starting assumptions, not data.

## Tracking already in the code

- Conversions are GA4 events imported into Google Ads (Goals > Conversions > Import from Google Analytics). Events that
  count go through `adsEvent()` in `src/lib/analytics/ads-events.ts`.
- Mark these as conversions after import: `plan_started` (candidate), `contact_form_sent` with `source` starting `lp-`
  (B2B lead), `lead_booking_clicked` (secondary, observation only).
- Final URLs carry `utm_*` through `buildTaggedLink` in `src/lib/marketing/campaign-tag.ts`. Channel `google` gives
  `utm_source=google&utm_medium=cpc`; campaign tag is `<segment>-google`. `gclid` travels with B2B leads (LeadForm).
- Turn on auto-tagging in the account so `gclid` is appended.

## Lead test plan: three campaigns, one offer (owner direction 2026-11-06)

Goal: acquire B2B leads from Google. Offer in every ad: a free demo. Run the three side by side with the same budget
and compare cost per lead (`contact_form_sent`, source `lp-<offer>`) after 3 weeks or 30 clicks each, whichever is later.
Candidate campaign 1 below is paused for this test.

| Test | Page | Angle | Demo today |
| --- | --- | --- | --- |
| 1. Outplacement | `/lp/outplacement` | Sits alongside the provider you already use; does not replace it | Free pilot form, then a 30-minute call with Justin |
| 2. WIOA / workforce boards | `/lp/workforce` | One link for workers in a layoff | Self-serve demo on the region's data (`/demo/workforce`) |
| 3. Higher ed development | `/lp/higher-ed` | Never ask alumni who are out of work | Free workspace form, then a call with Justin |

Only the workforce page has a self-serve demo. Outplacement and higher ed deliver the demo as the call after the form.
Say "free demo" in those ads only if the page button and success text say it too (open item: reword those two pages).

Test 1 ad lines (alongside angle): "Works With Your Outplacement" / "Add To Your Provider" / "Free Outplacement Demo" /
"Keep Your Current Provider" and description "Add a Dossier each person keeps and a compliance record per seat. Free demo."
Keywords add: "outplacement services for layoffs", "supplemental outplacement", "outplacement alternatives".

## Campaign 1: Candidates out of work for months

- Type: Search, no Display or Search Partners expansion. Network: Google Search only. Location: United States.
- Final URL: `https://launchyournextchapter.com/still-searching?utm_source=google&utm_medium=cpc&utm_campaign=laid-off-long-google`
- Goal: `plan_started`. Start with Maximize conversions once 15+ conversions exist; before that, manual CPC.
- Starting budget: $30/day (assumption).

Ad group A, "no interviews": exact and phrase match
- "no interviews after applying", "applied to hundreds of jobs no interviews", "why am i not getting interviews",
  "why is my job search taking so long", "unemployed for 6 months what to do"

Ad group B, "resume check": phrase match
- "why is my resume not getting responses", "resume ats check free", "resume not getting interviews"

Responsive search ad (copy matches the page, no claims the product does not make):
- Headlines (30 chars max): "No Interviews After Months?" / "What Is Holding Your Search" / "Free 5-Minute Assessment" /
  "No Résumé Needed To Start" / "Fix What Is Fixable First" / "Free For Members, Always"
- Descriptions (90 chars max): "See how hard your search is, what you control and what to fix first. No résumé needed." /
  "Résumé tested against 11 systems, plus aid for training, health coverage and moving."

Negative keywords (campaign level): jobs, hiring, near me, salary, indeed, linkedin, template, sample, free resume
builder, unemployment claim, login, reddit.

## Campaign 2: B2B pilots

One campaign per audience, each sending to its own page. Location: United States. Starting budget $40/day each
(assumption). Goal: `contact_form_sent`.

| Campaign | Final URL (add `?utm_source=google&utm_medium=cpc&utm_campaign=<tag>`) | Tag | Keywords (phrase) |
| --- | --- | --- | --- |
| Outplacement | `/lp/outplacement` | `b2b-outplacement-google` | "outplacement services", "outplacement provider", "layoff support for employees", "reduction in force outplacement" |
| Workforce boards | `/lp/workforce` | `b2b-boards-google` | "rapid response layoff services", "dislocated worker services", "workforce board software", "WIOA job seeker tools" |
| Higher ed | `/lp/higher-ed` | `b2b-highered-google` | "alumni career services platform", "alumni engagement software", "alumni career network platform" |

Ad copy per campaign: use the page headline as headline 1 (it repeats the promise), the form button text as a
headline, and the page subhead as a description (cut to 90 chars). Pages: `src/lib/marketing/lead-landing.ts`.

Negatives: free, jobs, careers, salary, internship, pdf, template, jobs at, indeed, glassdoor.

## Sign-up ads for the three B2B campaigns (paste-ready)

Headlines max 30 characters, descriptions max 90. Every line repeats what the page says.

### WIOA / workforce boards: `/lp/workforce`, goal "Build my region's demo"
- Headlines: "Layoff Hits Your Region?" / "Send Workers One Link" / "Demo On Your Region's Data" /
  "Local Jobs On Top" / "Free For 50 Active Members" / "Build My Region's Demo"
- Descriptions:
  - "Each worker gets job search tools, career help and AI skills. You see counts, never who."
  - "Built on your region's real layoff notices and job data. Your demo opens in a minute."
- Ad group keywords (phrase): "rapid response layoff services", "dislocated worker services", "workforce board software",
  "WIOA job seeker tools", "layoff aversion tools"

### Higher education development / alumni: `/lp/higher-ed`, goal "Get my free workspace"
- Headlines: "Alumni Career Services Tool" / "Ask Alumni At The Right Time" / "Do-Not-Ask When Out Of Work" /
  "Free Alumni Workspace" / "Prospect Signals From Alumni" / "Get My Free Workspace"
- Descriptions:
  - "Alumni between jobs are marked do-not-ask until it clears. Free for up to 50 active members."
  - "Alumni who share a new role or employer tell your office first. Use your college email."
- Ad group keywords (phrase): "alumni career services platform", "alumni engagement software",
  "alumni career network platform", "alumni development software", "alumni relations software"

### Outplacement: `/lp/outplacement`, goal "Start my free pilot"
- Headlines: "Free Outplacement Pilot" / "10 Seats At No Charge" / "Planning A Reduction?" /
  "Compliance Record Per Seat" / "HR Sees Counts, Not People" / "Start My Free Pilot"
- Descriptions:
  - "Up to 10 seats at no charge. Each person leaving keeps a Dossier after the contract ends."
  - "HR reporting in counts and a compliance record for every seat, ready for legal."
- Ad group keywords (phrase): "outplacement services", "outplacement provider", "layoff support for employees",
  "reduction in force outplacement", "severance outplacement"

Sitelinks (all three): "How it works" `/how-it-works`, "Vendor scorecard" `/rfp-template` (outplacement only).

## Before turning it on

1. Link GA4 to the Google Ads account; import the conversions above; confirm one test conversion shows.
2. Confirm landing pages return 200 on mobile: `/still-searching`, `/lp/outplacement`, `/lp/workforce`, `/lp/higher-ed`.
3. Set an account-level daily budget cap and a payment method.
4. Check the Ads policy for each ad group; employment-related ads must not target by protected characteristics.

## Build 1 of 3: WIOA / workforce boards (click-by-click)

Campaign settings: goal Leads; type Search; name `W1 Workforce boards`; Search Network only (untick Display and
Search Partners); United States, "Presence" only; English; budget $40/day; bidding Maximize clicks with a $6 max CPC cap
until 15 conversions, then switch to Maximize conversions; ad schedule Mon-Fri 7am-7pm Eastern.
Final URL: `https://launchyournextchapter.com/lp/workforce` (tags go in the tracking template:
`{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign=b2b-boards-google`). Display path: `workforce` / `demo`.

Ad group "Rapid response": phrase "rapid response layoff services", "layoff aversion tools", "dislocated worker
services"; exact [rapid response layoff services].
Ad group "Boards": phrase "workforce board software", "WIOA job seeker tools", "workforce development platform".

Headlines (15, any order): Layoff Hits Your Region? / Send Workers One Link / Demo On Your Region's Data / Local Jobs On Top /
Free For 50 Active Members / Build My Region's Demo / Free Rapid Response Demo / Counts Of Who Stayed Local.
Descriptions: "Each worker gets job search tools, career help and AI skills. You see counts, never who." (88) /
"Built on your region's real layoff notices and job data. Your demo opens in a minute." (85) /
"One sign-up link for the workers in each layoff. Free for up to 50 active members." (82).
Sitelinks: How it works `/how-it-works`; Workforce boards `/workforce-boards`. Callouts: Free demo; Counts, never who;
Built on your region's data.
Negatives (campaign): jobs, job openings, hiring, near me, salary, resume, unemployment claim, login, internship, course, free download.
