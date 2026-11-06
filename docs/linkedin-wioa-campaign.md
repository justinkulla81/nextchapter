# LinkedIn campaign: workforce boards (WIOA)

Paid LinkedIn campaign aimed at local workforce development boards and the people who run their
Dislocated Worker and Rapid Response programs. Segment `b2b-boards`, channel `linkedin-ads`.
Built from the existing tagging rules in `src/lib/marketing/campaign-tag.ts`.

LinkedIn Campaign Manager has no connector here, so this brief is what gets entered there by hand.
Nothing below has been created or spent.

## Objective and landing page

- Objective: **Website visits** (not lead-gen forms), so every click lands on a page that carries the one
  registration ask.
- Landing page: https://launchyournextchapter.com/workforce-boards (the hub; its claim band leads to
  `/government-workforce#claim`). Do not add a second ask to the page.
- Tracked link (paste as the ad's destination URL):

```
https://launchyournextchapter.com/workforce-boards?utm_source=linkedin&utm_medium=paid_social&utm_campaign=b2b-boards-linkedin-ads
```

The campaign shows up as `b2b-boards` / `linkedin-ads` in the segment engagement report. Keep the tag
exactly as above for every ad in the campaign; tell ads apart by their name in Campaign Manager.

## Audience

LinkedIn matched audience plus job-title targeting, United States only.

- Company list: the local workforce boards in the CareerOneStop directory the hub page is built from
  (`src/lib/workforce/directory.ts`). Upload board names as a company list. Do not upload people's emails.
- Job titles (include): Workforce Development Director, Executive Director (workforce board),
  Rapid Response Coordinator, Dislocated Worker Program Manager, One-Stop Operator,
  American Job Center Manager, Business Services Manager.
- Industries: Government Administration; Individual and Family Services; Nonprofit Organizations.
- Seniority: Manager and above.
- Exclude: current NextChapter workspace owners (upload as a company exclusion list).
- Turn off LinkedIn Audience Network.

## Budget and schedule

- Start small: $50 a day, 3 weeks, Monday to Friday.
- LinkedIn's cost per click for this audience is high; judge the test on clicks to claim and workspace
  claims, not impressions. Decide to scale or stop at day 21.
- Two ads at once, so the test has something to compare.

## Ads (single image, 1200 x 628)

All numbers are from the report's Exhibit 32 (DOL ETA, program year 2024) and are already used on the
pitch slides (`src/lib/pitch/report-facts.ts`).

**Ad A: the gap**

- Intro text: 187,108 dislocated workers entered the WIOA program in program year 2024. About 1 in 5
  received training. NextChapter helps the rest plan their next role alongside your board's services.
- Headline: Reach laid-off professionals between appointments
- Image text: 187,108 served. About 20% trained.
- Button: Learn more

**Ad B: the white-collar group**

- Intro text: Roughly 546,000 white-collar workers have been out of work 27 weeks or longer this year.
  Boards see them at the front desk. NextChapter gives your team a workspace built for them.
- Headline: Built to sit next to WIOA, not against it
- Image text: ~546,000 white-collar workers out 27+ weeks
- Button: Learn more

Both ads keep to what the pitch slides already say. Add no claims about price, outcomes or board
results. Confirm Individual Training Account and on-the-job training use with each board before
quoting anything about them.

## Tracking

- Add the LinkedIn Insight Tag only if the owner approves a privacy policy update; until then the
  UTM tag on the link is the measurement.
- Page events already fire on the hub (`seo_claim_clicked` with `page: 'workforce_hub'`,
  `audience: 'workforce'`). Query PostHog on `utm_campaign = b2b-boards-linkedin-ads`.

## Launch checklist

1. Create the campaign in Campaign Manager with the objective, audience, budget and schedule above.
2. Create both ads with the tracked link.
3. Open the link from LinkedIn's preview and confirm the hub loads and the UTM tag is in PostHog.
4. Check the segment engagement report after 48 hours.
