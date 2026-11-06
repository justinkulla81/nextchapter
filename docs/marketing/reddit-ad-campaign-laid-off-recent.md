# Reddit ad campaign: recently laid off (test)

Segment tag: `laid-off-recent` (see `src/lib/marketing/campaign-tag.ts`). Created in https://ads.reddit.com by hand; no API credentials in this repo.

## Setup
- Objective: **Traffic** (clicks), optimize for link clicks. Switch to Conversions once the Reddit pixel is installed and registrations are firing.
- Budget: **$50/day**, 14 days (about $700). Bid: automatic.
- Placement: Feed (and conversation placement off for the first test).
- Locations: United States. Devices: all. Schedule: all day.
- Pause rule: if after $200 spend CTR is below 0.2% or there are 0 registrations, pause and rewrite the copy.

## Targeting (communities, not interests)
r/layoffs, r/jobs, r/careerguidance, r/unemployment, r/recruitinghell, r/ExperiencedDevs, r/humanresources, r/personalfinance (exclude r/personalfinance if CPC is high).
Add interest: Careers / Job search. No age or gender targeting.

## Ads (3 variants, one per angle)
Landing: https://launchyournextchapter.com/layoffs (carries the single registration box). Do not send to a page that adds a second registration ask.

| Variant | Headline (<= 100 chars) | Body | CTA button |
|---|---|---|---|
| A: market reality | Laid off? See what the job market looks like for your role | Open roles, pay and hiring trends for your title and metro, from live data. | Learn more |
| B: benefits | Just laid off? Check unemployment benefits and programs for your state | State-by-state benefits and programs for laid-off workers, in one place. | Learn more |
| C: layoff tracker | Which companies are laying off right now? | A live tracker of layoff notices, and what each one means for your search. | Learn more |

Reddit rules: no clickbait, no all caps, no claims we cannot back. Keep the "live data" claim only if the page shows its source.

## Tagged URLs (one per ad, so the Visitors report and campaign funnel split them)
- A: https://launchyournextchapter.com/layoffs?utm_source=reddit&utm_medium=paid&utm_campaign=laid-off-recent-reddit&utm_content=market-reality
- B: https://launchyournextchapter.com/unemployment-benefits?utm_source=reddit&utm_medium=paid&utm_campaign=laid-off-recent-reddit&utm_content=benefits
- C: https://launchyournextchapter.com/layoffs?utm_source=reddit&utm_medium=paid&utm_campaign=laid-off-recent-reddit&utm_content=tracker

`utm_source=reddit` buckets as Reddit and `laid-off-recent-reddit` splits into segment `laid-off-recent`, channel `reddit`.

## Measure
Clicks, CPC, registrations per variant in the admin campaign funnel; PostHog by `utm_content`. Decide at day 7: keep the best variant, pause the others.

## Open items for the owner
- Create the Reddit Ads account and payment method.
- Optional: install the Reddit pixel (needs a code change; not done here).
