# Employee journeys and their News

Four public pages for white-collar employees, each fed by a News theme. Content and wording: `src/lib/journeys/employee-journeys.ts`.

| Page | News tag | Onboarding situation it hands over |
|---|---|---|
| `/journeys/your-rights-at-work` | `worker_rights` | `worried_let_go` |
| `/journeys/white-collar-benefits` | `benefits` | `growing_in_job` |
| `/journeys/pay-and-cost-of-living` | `pay_and_costs` | `looking_for_promotion` |
| `/journeys/side-hustles` | `side_income` | `building_something` |

Each page makes one registration ask (the "Is this you?" `NextStepBox`), lists up to 12 stories carrying its tag, and the pay page shows live BLS pay against prices (`src/lib/market/bls-pay.ts`).

## Where a story shows up

A story published to News (`newsKind` and `newsPublishedAt` set) appears everywhere at once, and its journey tag does the cross-referencing:

- the News page (`/news`) and the journey page for each journey tag it carries;
- the News card, where a journey tag is a link to that journey page (`src/components/news/NewsFeed.tsx`);
- the weekly email's "At work this week" block, for stories that went live in the last seven days (`src/lib/newsletter/journey-week.ts`);
- the RSS feed (`/news/feed.xml`), as a `<category>` per tag; a journey's category carries its page in the `domain` attribute (`src/lib/news/feed-categories.ts`).

## Keeping it fresh

1. The daily discovery search adds links to the Market Pulse inbox (`src/lib/news/discovery-topics.ts`; five topics cover these themes). Nothing is published automatically.
2. Once a week a batch is published from the inbox: pick up to six stories that clearly fit a journey, from established outlets, not political, not duplicates; write the headline and blurb in our own words from the stored summary; set the tags; set `newsPublishedAt`. The scheduled task "Weekly journey news batch" does this and needs the Supabase connector attached on the claude.ai routines page.
3. Stories found on the web are added as new `ResearchLibraryItem` rows (`ingestionSource` `manual`) after reading the article.

Pages refresh on a five-minute timer, so a published story shows within about five minutes. Production deploys are batched (`scripts/vercel-ignore-build.sh`): code changes ship in the 01:00 and 13:00 UTC windows, or at once with `[deploy-now]` in the commit message.
