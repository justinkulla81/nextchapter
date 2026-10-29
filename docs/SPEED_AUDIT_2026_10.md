# Speed audit, October 2026

Measured 2026-10-29 against https://launchyournextchapter.com (production) and a local production build of the same code.
Everything here is lab data except the real-user table; where a number is a lab estimate it says so.

## What could and could not be measured

- **Google PageSpeed Insights and CrUX field data:** not available. The PSI API answered `429 Quota exceeded` for the shared anonymous project, and the CrUX API needs a key. Search Console's Core Web Vitals report is the place to read Google's own field numbers.
- **Lab:** Lighthouse 12.6.1, run locally in Chrome, mobile profile (Moto-G class screen, slow 4G: 1.6 Mbps, 150 ms RTT, 4x CPU slowdown). Two throttling modes:
  - *simulated* (Lighthouse's default, and what PSI uses): it estimates the throttled load from an unthrottled one. It is the pessimistic one.
  - *applied* (`--throttling-method=devtools`): the network and CPU limits are really enforced while the page loads. Closer to a real slow phone.
- **Real users:** PostHog's `$web_vitals` events, last 30 days. The sample is small and dominated by the owner's own desktop browsing (admin pages, homepage), so treat it as a sanity check, not a verdict.
- **TTFB:** `curl` from this machine, cold (first request) and warm (second).

Google's "good" limits at the 75th percentile: LCP 2.5 s, INP 200 ms, CLS 0.1. Lighthouse reports Total Blocking Time (TBT, good under 200 ms) in place of INP, which only real users can produce.

## Headline

1. **Server speed is not the problem.** TTFB is 0.1 to 0.8 s on every page type tested, 2.0 s for the first view of a cold city page. All page types are served from the cache (`x-vercel-cache: HIT`) or render from cached data in under half a second.
2. **Desktop is fine.** Seven page types: score 98 to 100, LCP 0.4 to 0.9 s, TBT 0 ms, CLS 0.
3. **Mobile is bytes, not code.** About 700 KB goes over the wire for every page, and on a slow phone connection that is the whole story. Under the pessimistic simulated profile almost every page's LCP is 2.6 to 3.0 s ("needs improvement"), and three page types are 4.7 to 5.5 s. Under really-applied throttling the same pages paint at about 2.0 s, which is the floor of that connection (HTML, CSS and fonts before first paint).
4. **The three poor simulated scores (home, employer, layoffs company) are mostly an artifact.** With throttling applied instead of simulated, home was 3.0 s, an employer page 2.8 s and a salary page 2.7 s, the same as the page types that score well in simulation.
5. **One real layout-shift problem:** the white-collar report page shifts 0.197 in a throttled mobile run (poor; the limit is 0.1). Real users on that page measured 0.069 at the 75th percentile (good), so it is a slow-connection issue only.
6. **INP is fine** where there is data (real users: 8 to 68 ms; one tools page at 590 ms from 4 samples).

## Mobile, production, simulated throttling (22 page types)

Score is Lighthouse's performance score. TTFB is Lighthouse's server-response figure. KB is total transfer.

| Page type | Score | FCP s | LCP s | TBT ms | CLS | KB |
|---|---|---|---|---|---|---|
| Home | 65 | 3.1 | 5.5 | 278 | 0 | 706 |
| Layoffs company (`/layoffs/company/amazon`) | 67 | 3.3 | 5.5 | 133 | 0 | 829 |
| Employer (`/employers/carvana`) | 73 | 3.1 | 4.7 | 243 | 0 | 690 |
| Employers B2B landing | 80 | 1.5 | 4.2 | 284 | 0 | 776 |
| Report, September edition | 76 | 2.3 | 3.9 | 387 | 0 | 890 |
| Workforce board state | 87 | 1.5 | 3.0 | 295 | 0 | 727 |
| College | 84 | 1.6 | 3.0 | 358 | 0 | 791 |
| Report index | 93 | 1.5 | 3.0 | 130 | 0 | 741 |
| Jobs search | 88 | 1.4 | 2.9 | 318 | 0 | 712 |
| Unemployment state | 87 | 1.2 | 2.8 | 377 | 0 | 709 |
| Place city | 93 | 1.3 | 2.8 | 152 | 0 | 800 |
| Job page | 90 | 1.2 | 2.7 | 281 | 0 | 882 |
| Severance explainer | 86 | 1.2 | 2.7 | 402 | 0 | 700 |
| Job title | 91 | 1.1 | 2.6 | 288 | 0 | 712 |
| Salary | 95 | 1.0 | 2.6 | 161 | 0 | 668 |
| AI premium explainer | 93 | 1.0 | 2.6 | 220 | 0 | 682 |
| Press | 89 | 1.2 | 2.6 | 354 | 0 | 863 |
| COBRA calculator | 89 | 0.9 | 2.6 | 354 | 0 | 688 |
| COBRA explainer | 97 | 1.3 | 2.1 | 142 | 0 | 705 |
| Layoffs hub | 94 | 1.4 | 2.3 | 222 | 0 | 729 |
| COBRA state page | 88 | 1.1 | 1.6 | 460 | 0 | 721 |
| Place county | 95 | 1.3 | 1.8 | 148 | 0 | 719 |

Against the limits: LCP is over 2.5 s on 18 of 22 in this simulation; TBT is over 200 ms on 16 of 22; CLS is 0 on all of them in the lab.

## Mobile, applied throttling (production and a local production build)

| Page type | Production LCP s | Local build, before | Local build, after |
|---|---|---|---|
| Home | 3.0 | 2.1 and 2.0 | 1.9 and 1.9 |
| Salary | 2.7 | 2.0 and 2.0 | 1.8 and 1.8 |
| Employer | 2.8 | 2.0 (one run failed to record) | 1.9 and 1.8 |
| Layoffs company | not run | 2.6 and 2.0 | 1.9 and 1.9 |
| Report, September edition | not run | 2.2 and 2.4 | 2.0 and 2.0 |

The local server has no real network path, so its numbers sit below production's by roughly 0.7 s; compare local to local.

## Desktop, production

| Page type | Score | FCP s | LCP s | TBT ms | CLS | KB |
|---|---|---|---|---|---|---|
| Home | 100 | 0.3 | 0.4 | 0 | 0.001 | 834 |
| Employer | 100 | 0.4 | 0.6 | 0 | 0 | 805 |
| Salary | 100 | 0.3 | 0.5 | 0 | 0 | 804 |
| Job page | 100 | 0.3 | 0.6 | 0 | 0 | 1025 |
| COBRA explainer | 100 | 0.4 | 0.6 | 0 | 0 | 846 |
| Report, September edition | 100 | 0.5 | 0.8 | 0 | 0 | 1006 |
| Layoffs company | 98 | 0.3 | 0.9 | 0 | 0 | 938 |

## Real users (PostHog `$web_vitals`, 30 days, 75th percentile)

| Page type | Samples (LCP) | LCP | INP | CLS |
|---|---|---|---|---|
| Job page | 236 | 0.9 s | 64 ms | 0 |
| Employer | 14 | 1.0 s | 8 ms | 0 |
| Layoffs | 13 | 1.3 s | 48 ms | 0 |
| Jobs search | 20 | 1.7 s | 52 ms | 0 |
| Home | 122 | 5.3 s | 68 ms | 0.003 |
| White-collar report | 58 | 6.8 s | 64 ms | 0.068 |

The slow home and report rows are almost all the owner's desktop Chrome (the home page's mobile Safari samples are 0.9 s at the 75th percentile, 7 samples). The sample does not tell us about Google's real mobile users. The report's 0.068 CLS is under the limit.

## TTFB, production, from curl

| Page | Cold | Warm | Cache header |
|---|---|---|---|
| Home | 0.46 s | n/a | HIT |
| Report | 0.13 s | n/a | HIT |
| Employer (carvana) | 0.11 s | n/a | HIT |
| Place city (austin) | 0.15 s | n/a | HIT |
| Salary (senior marketing manager) | 0.56 s | n/a | MISS (renders from cached data) |
| Layoffs company (amazon) | 0.26 s | n/a | STALE (served while refreshing) |
| Lightly visited: employer, job, job title, nonprofits state, unemployment state | 0.40 to 0.77 s | 0.28 to 0.34 s | MISS |
| Lightly visited place city (westford) | 2.03 s | 0.44 s | MISS |
| COBRA state (wyoming) | 0.22 s | 0.12 s | PRERENDER then HIT |

## Where the bytes go (home page, mobile, as measured)

About 706 KB transferred, 37 requests:

| What | KB | Notes |
|---|---|---|
| JavaScript | 488 | Google gtag.js 177 (high priority, preloaded in the head), Next chunks about 300, PostHog extensions 37 (surveys) |
| Fonts | 97 | Inter 47 (preloaded), Source Serif 4 50 (found late, very high priority) |
| Favicon `icon.png` | 69 | A 1024 by 1024 JPEG named .png, fetched on every page at high priority |
| CSS | 28 | two render-blocking files, small |
| HTML | 14 | compressed |

Lighthouse's unused-JavaScript audit finds 179 KB unused on the home page: 75 KB inside gtag.js, 47 KB and 29 KB inside two Next chunks, and 31 KB in PostHog's surveys script.

## Root causes, in order of effect

1. **Too many high-priority bytes before the first paint on a slow connection.** gtag.js (177 KB, a high-priority `<link rel=preload>` that Next adds for an `afterInteractive` script), the 69 KB favicon, two fonts and the CSS are about 370 KB at the front of the queue, on a link that moves 200 KB a second.
2. **Third-party code.** Google tag costs about 140 ms of main-thread blocking and 262 ms of work on the home page.
3. **PostHog's survey widget** (37 KB) loads at idle although nothing uses it; it adds parse time and competes for bandwidth.
4. **Font swap shifts on the report page.** The cover heading and the lines above it move when Inter and Source Serif arrive after first paint (lab CLS 0.197). Inter is preloaded; Source Serif deliberately is not (see `src/app/layout.tsx`).
5. **The report page ships its 330 KB body twice.** `/reports/white-collar-employment-report-september-2026` is 760 KB of HTML (158 KB compressed), 410 KB of it a copy of the body inside the framework's data script.
6. **Cold first view of a lightly visited page** can take 0.4 to 2.0 s to render; every later view is 0.1 to 0.45 s.
7. **Not causes:** render-blocking CSS (about 150 ms estimated), image weight (almost no images), layout shift on any page but the report, server response time.

## Fixes made in this change

| Fix | What changed | Measured effect |
|---|---|---|
| Smaller favicon | `src/app/icon.png` is now a 192 by 192 PNG, 18 KB, replacing the 1024 by 1024 JPEG (71 KB). It is also the Organization logo in structured data and the RSS logo, both fine at 192 (Google asks for at least 112 by 112) | about 52 KB less per page, fetched at high priority on every page |
| gtag.js after the load event | `strategy="lazyOnload"` for the 177 KB script. The inline init script that defines `gtag()` still runs early and queues everything on `window.dataLayer`, so no event is lost; gtag.js replays the queue when it arrives. It also removes the high-priority preload link | See table below. Verified in the browser: gtag.js is requested after the load event, `dataLayer` holds `js`, `config` and the explicit `page_view`, and the collect request goes out right after the script lands |
| PostHog surveys off | `disable_surveys: true` | the 37 KB `surveys.js` is no longer requested. Events still send: `/ingest/e/` fired for the page view in the browser check |

Before and after, local production builds, applied mobile throttling, two runs each (the local server has no real network path, so absolute numbers are lower than production; compare the pairs):

| Page | Transfer KB | LCP s | TBT ms |
|---|---|---|---|
| Home | 654 and 694, now 642 and 642 | 2.1 and 2.0, now 1.9 and 1.9 | 200 and 86, now 97 and 55 |
| Salary | 618 and 618, now 567 and 566 | 2.0 and 2.0, now 1.8 and 1.8 | 98 and 95, now 73 and 62 |
| Employer | 647, now 595 and 595 | 2.0, now 1.9 and 1.8 | 85, now 75 and 68 |
| Layoffs company | 795 and 796, now 737 and 737 | 2.6 and 2.0, now 1.9 and 1.9 | 66 and 55, now 74 and 110 |
| Report | 891 and 891, now 839 and 840 | 2.2 and 2.4, now 2.0 and 2.0 | 276 and 293, now 275 and 308 |

Honest reading: transfer drops by about 50 KB on every page and LCP by 0.1 to 0.2 s in this setup. The effect on a real slow phone should be larger than on this local rig because the removed bytes were all ahead of the first paint, but I did not measure production after the change; check Search Console's Core Web Vitals report two to four weeks after it ships. TBT moves within run-to-run noise (about 30 ms either way).

A serif stand-in font change (size-adjusted Times New Roman) was tried for the report page's layout shift. It produced no change (CLS 0.197 before and after), so it was removed. The after measurements above include it; it affects one CSS rule and nothing measurable here.

## Left alone on purpose

- **Google Analytics itself.** Dropping or replacing gtag.js is a measurement decision for the owner, not a speed tweak.
- **The report page's layout shift** and **its doubled payload.** Both need a structural change to that page (preload Source Serif on that route only, and serve the body once). Real users see CLS 0.069 on it, under the limit.
- **Rendering strategy of data-heavy pages** (`revalidate`, `dynamic`), titles, structured data, the homepage A/B proxy, onboarding, the database pool and tracking semantics.

## Top five remaining fixes by gain

1. **Report page payload and shift.** Serve the 330 KB body once (about 150 KB less compressed) and preload Source Serif on that route to remove the lab CLS 0.197. Affects the page journalists will open first.
2. **Fonts: 97 KB before first paint.** Subset or cut the variable weight axes to the weights actually used, and pick one of "preload both" or "swap with matched fallbacks" per page type. Expect 30 to 50 KB and fewer swap shifts.
3. **Unused JavaScript in the framework chunks (29 to 47 KB each on the home page).** Run the bundle analyzer, find what the two 73 KB chunks hold, and move below-the-fold widgets (journey picker, search form, pop-ups) to dynamic imports.
4. **Google tag cost.** Either keep gtag.js lazy (done) and accept it, or move to a lighter setup (server-side forwarding, or Partytown to run it off the main thread). Needs a decision on GA's role next to PostHog.
5. **Cold-view render time on lightly visited pages** (up to 2.0 s for a city page). Precompute the page data for the long tail, or extend the post-deploy warm-up (`scripts/seo/warm-pages.sh`) to a larger sample of each page type.

## How to repeat this

- Production, one page: `npx lighthouse@12.6.1 <url> --only-categories=performance --form-factor=mobile --screenEmulation.mobile --throttling-method=devtools --output=json --output-path=out.json`.
- Local before and after: `next build` and `next start` with `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST000000 NEXT_PUBLIC_POSTHOG_KEY=phc_localtestkey`, so test visits never reach the real Google Analytics or PostHog projects.
- Real-user numbers: PostHog, event `$web_vitals`, properties `$web_vitals_LCP_value`, `_INP_value`, `_CLS_value`, `_FCP_value`.
