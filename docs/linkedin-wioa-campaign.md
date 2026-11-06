# LinkedIn campaign: workforce boards (WIOA)

Paid LinkedIn campaign aimed at local workforce development boards and the people who run their
Dislocated Worker and Rapid Response programs. Segment `b2b-boards`, channel `linkedin-ads`
(`src/lib/marketing/campaign-tag.ts`).

LinkedIn Campaign Manager has no connector in the cloud environment, so the campaign is entered there
by hand from this brief. Nothing has been created or spent. Ad-management connectors that exist in the
claude.ai directory (Adspirer, Supermetrics, Toffu, Windsor.ai) are not connected; if one is connected,
this brief is the spec to build from.

## The offer

One offer, the one the landing pages already carry (`B2bAssetBox`, asset `workforce-demo`,
`src/lib/marketing/b2b-assets.ts`):

> **See your region's workspace in 60 seconds.** Pick your state or area and get a working demo built on
> real local job and training data. No call needed. We ask for your work email so the demo is yours.

The ad promises that and nothing else. It is free, needs no call, and is delivered on the page. No
claims about price, outcomes or board results.

### What their people get (say one thing, not four)

The ad offers a free workspace where the board's white-collar clients get job search tools, and the board's
own services are listed beside them. That is all the workforce page claims
(`src/lib/marketing/portal-pages/workforce.ts`): the board's page, its services, up to 50 active members, and
basic counts, with core job search tools free for the job seeker. Do not list AI coaching, career
exploration or retraining in the ad: coaching and courses are on the paid Program plan, retraining is what
the board already does with WIOA money, and a four-item list reads as a different product from the
"next to WIOA" line. No federal indicators, wage-record match or PIRL export are claimed anywhere.

## Geo: one ad per state, landing on that state's page

Boards are local, so the ad and the landing page are both local. Each state has a page with its own
boards, American Job Centers, unemployment and layoff figures, and the same demo offer:
`https://launchyournextchapter.com/workforce-boards/<state>` (the slug is the full state name, for example `/workforce-boards/washington`).

- LinkedIn location: the state (add metros later if a state's audience is too big).
- Landing page: that state's page. The ad's local number is copied from that page on launch day, so
  the ad and the page say the same thing. Re-copy it if the page changes.
- Tracked link, per state (the state is in the path, so the report shows which state clicked):

```
https://launchyournextchapter.com/workforce-boards/<state>?utm_source=linkedin&utm_medium=paid_social&utm_campaign=b2b-boards-linkedin-ads
```

### Pilot states

Ranked by 2026 WARN notices on file (Supabase, read on 2026-11-06, filings since Jan 1, not the
page's deduplicated public figure, so use these only to pick states):

| State | Boards | 2026 notices | Workers named |
|---|---|---|---|
| CA | 46 | 558 | 94,069 |
| WA | 13 | 144 | 41,630 |
| TX | 28 | 120 | 29,855 |
| IL | 23 | 106 | 21,031 |
| NY | 34 | 198 | 15,759 |
| NJ | 18 | 128 | 15,290 |

Pilot these six (162 boards), plus Kentucky and Massachusetts below. Rhode Island ranks ninth by workers but on 7 notices, so one filing is
driving it; skip it for now.

Add two states that train heavily. Our benefits catalog (`src/lib/benefits/catalog.json`, built 2026-10-23)
holds 33 state training and tuition programs for Kentucky and 37 for Massachusetts, fourth and third
behind Texas (45) and California (39). That counts what we have catalogued, not what a state spends, so
it says "lots of programs a board can point people to", not "big retrainer".

| State | Boards | 2026 notices | Workers named | Catalog training programs |
|---|---|---|---|---|
| KY | 11 | 38 | 3,084 | 33 |
| MA | 17 | 32 | 5,460 | 37 |

### Tracked links to paste (one per ad)

```
https://launchyournextchapter.com/workforce-boards/california?utm_source=linkedin&utm_medium=paid_social&utm_campaign=b2b-boards-linkedin-ads
https://launchyournextchapter.com/workforce-boards/washington?utm_source=linkedin&utm_medium=paid_social&utm_campaign=b2b-boards-linkedin-ads
https://launchyournextchapter.com/workforce-boards/texas?utm_source=linkedin&utm_medium=paid_social&utm_campaign=b2b-boards-linkedin-ads
https://launchyournextchapter.com/workforce-boards/illinois?utm_source=linkedin&utm_medium=paid_social&utm_campaign=b2b-boards-linkedin-ads
https://launchyournextchapter.com/workforce-boards/new-york?utm_source=linkedin&utm_medium=paid_social&utm_campaign=b2b-boards-linkedin-ads
https://launchyournextchapter.com/workforce-boards/new-jersey?utm_source=linkedin&utm_medium=paid_social&utm_campaign=b2b-boards-linkedin-ads
https://launchyournextchapter.com/workforce-boards/kentucky?utm_source=linkedin&utm_medium=paid_social&utm_campaign=b2b-boards-linkedin-ads
https://launchyournextchapter.com/workforce-boards/massachusetts?utm_source=linkedin&utm_medium=paid_social&utm_campaign=b2b-boards-linkedin-ads
https://launchyournextchapter.com/workforce-boards?utm_source=linkedin&utm_medium=paid_social&utm_campaign=b2b-boards-linkedin-ads
```

The last link is the national hub, for any state that is folded into another campaign or has no figure.

Check the audience size in Campaign Manager before launching. LinkedIn needs at least 300 members, and
board staff in one state can fall under that. If a state is under, fold it into a neighboring state's
campaign and keep its state page as the landing page.

## A/B or not

Not at this size. A board-staff audience is small (the size per state is unknown until Campaign Manager shows it), and at about $10 a
day split across states, an A/B split leaves each arm with too few clicks to tell anything apart.

- Run **one ad per state**, same template. The comparison that matters is state against state.
- Change one thing at a time, in sequence: run the template for 3 weeks, then swap only the headline
  for the next 3 weeks and compare claims per click.
- Revisit a true A/B only if the pilot clears about 100 clicks per state per variant.

## Budget and schedule

- LinkedIn sets targeting and budget per campaign, so run one campaign per state, each at $10 a day (LinkedIn's minimum), Monday to Friday, 3 weeks. Eight states is $80 a day, about $1,200 over 15 weekdays. To spend less, launch only the first four or five states. These are suggested starting numbers.
- Objective: **Website visits**. Judge on clicks to the state page, demo builds and workspace claims,
  not impressions. Decide to scale or stop at day 21.

## Audience

- Company list: the boards in the CareerOneStop directory (`WorkforceBoard`, `src/lib/workforce/directory.ts`),
  by name. Do not upload people's emails.
- Job titles: Workforce Development Director, Executive Director (workforce board), Rapid Response
  Coordinator, Dislocated Worker Program Manager, One-Stop Operator, American Job Center Manager,
  Business Services Manager.
- Industries: Government Administration; Individual and Family Services; Nonprofit Organizations.
- Seniority: Manager and above. United States only. Turn off the LinkedIn Audience Network.
- Exclude: current NextChapter workspace owners (company exclusion list).

## Ad template (single image, 1200 x 628), 2026 figures only

Every figure is dated 2026. The 2024 WIOA participant counts (187,108 served, about 20% trained) are
left out: they are program year 2024, the latest DOL has published, and the 2025 year is not out yet.

**Per-state ad** (fill `<State>`, `<N>` and `<W>` from `/workforce-boards/<state>`, "Layoff notices,
last 12 months" and "naming ... workers")

- Intro text: `<State>` has had `<N>` layoff notices in the last 12 months, naming `<W>` workers.
  See what your region's workspace would look like, built on real local job and training data.
  No call needed.
- Headline: See your `<State>` region's workspace in 60 seconds
- Image text: `<N>` layoff notices. `<W>` workers. `<State>`.
- Button: Learn more
- Link: the tracked state link above.

**National line, for the hub page and any state without a page figure**

- Intro text: The fiscal 2026 Dislocated Worker appropriation is essentially unchanged at $1.396B, while
  about 546,000 white-collar workers have been out of work 27 weeks or longer this year. Give the ones
  you serve job search tools of their own, with your services listed beside them. The workspace is free
  for up to 50 active members. See your region's demo in 60 seconds.
- Headline: Built to sit next to WIOA, not against it
- Image text: $1.396B, essentially flat. ~546,000 white-collar workers out 27+ weeks.
- Link: https://launchyournextchapter.com/workforce-boards with the tracked parameters.

Sources for the national line: Federal Register WIOA allotments notice (Apr 2026); NextChapter analysis of
CPS, January to August 2026 average (a size comparison only). Both are in `src/lib/pitch/report-facts.ts`.

## Tracking

- The UTM tag is the measurement. Do not add the LinkedIn Insight Tag unless the owner approves a
  privacy-policy update.
- Page events already fire: `seo_claim_clicked` (`page: 'workforce_state'` or `'workforce_hub'`),
  `b2b_asset_opened`. Query PostHog on `utm_campaign = b2b-boards-linkedin-ads`, grouped by landing path
  for the state.

## Launch checklist

1. For each pilot state, copy `<N>` and `<W>` from its state page into the template.
2. Create one campaign per state (targeting and budget live on the campaign in LinkedIn), each inside the campaign group, with the audience above.
3. Check each state's audience is 300 or more; fold any that are not.
4. Open each tracked link from LinkedIn's preview, confirm the state page loads and the UTM tag shows in PostHog.
5. After 48 hours, check the segment engagement report.
