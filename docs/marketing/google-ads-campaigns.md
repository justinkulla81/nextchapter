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

## Before turning it on

1. Link GA4 to the Google Ads account; import the conversions above; confirm one test conversion shows.
2. Confirm landing pages return 200 on mobile: `/still-searching`, `/lp/outplacement`, `/lp/workforce`, `/lp/higher-ed`.
3. Set an account-level daily budget cap and a payment method.
4. Check the Ads policy for each ad group; employment-related ads must not target by protected characteristics.
