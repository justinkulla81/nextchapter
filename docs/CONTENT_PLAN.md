# NextChapter content plan

Drafted 2026-11-05. Goal: one content system that runs from data we already produce, with a daily routine for the owner of about 20 minutes.

## 1. What already exists (found in the repo, not verified live in production)

| Piece | Where | State |
|---|---|---|
| Social stream, 8 channels (Bluesky, Mastodon, Telegram, Discord, Slack, Threads, Facebook, X) | `src/lib/social/` (`channels.ts`, `stream.ts`) | Built. Which channels are live depends on env keys; check |
| Daily layoff roundup, Monday weekly roundup, new-report and monthly-rankings posts | `src/lib/social/roundups.ts`, `posts.ts` | Built, totals only, no employer names |
| Per-filing layoff posts (WARN) with rules and a daily X cap | `src/lib/social/filings.ts` | Built |
| BLS jobs report and JOLTS posts | `src/lib/social/bls-release.ts` | Built |
| Fact posts: AI pay, skills, rankings, help, weekly press | `src/lib/social/facts.ts` | Built |
| LinkedIn story drafts, held for a click | `src/lib/linkedin/story-drafts.ts` | Built, human approves |
| Daily post drafts for the admin | `/api/cron/content-drafts` -> https://launchyournextchapter.com/support/admin/content-drafts | Built, template text |
| Layoff RSS feeds (daily, weekly, 100+, by state) | https://launchyournextchapter.com/feeds | Built |
| News feed | https://launchyournextchapter.com/news/feed.xml | Built |
| Social cards and OG images | `src/lib/social/cards.ts`, `src/app/layoffs/opengraph-image.tsx` | Built |
| Reports | https://launchyournextchapter.com/reports | White Collar Employment Report, index, early warning |
| Weekly/Tuesday digests (member email) | `bundle-tuesday-digests`, `weekly-read` crons | Built for members |

**Gaps:** no public newsletter I could find (the digests go to members); no short video; no Reddit/LinkedIn-native long posts beyond held drafts; no "new retraining program" or "new benefits" feed; no tips series; no single calendar that tells you what is due today.

## 2. Pillars

Each pillar has one job and one landing page. Every post links to one page, and that page carries the single registration ask (the `NextStepBox`), so posts never need their own ask.

| # | Pillar | Cadence | Audience job | Landing page |
|---|---|---|---|---|
| 1 | Daily layoffs | Daily | "Who is cutting, where, how many" | https://launchyournextchapter.com/layoffs/this-week |
| 2 | End-of-week layoff rundown | Fri (publish) | Weekly authority piece; press and newsletter anchor | https://launchyournextchapter.com/layoffs/week |
| 3 | Monthly employment report | First Fri (BLS) + our read same day | "What the BLS numbers mean for white-collar workers" | https://launchyournextchapter.com/reports |
| 4 | Jobs report (local and national) | Monthly, plus metro editions | Hiring by metro/county, all white-collar levels incl. entry-level, labeled secondary all-jobs frame | https://launchyournextchapter.com/reports |
| 5 | Hot jobs | 2x per week | "Who is hiring now, in what role and pay" | https://launchyournextchapter.com/jobs |
| 6 | Tips and tricks | 3x per week | Practical, saveable, shareable | https://launchyournextchapter.com/resources |
| 7 | New retraining | Weekly | New AI/skills programs, funded options | https://launchyournextchapter.com/ai-retraining |
| 8 | New benefits | Weekly | Unemployment, COBRA/ACA, state programs, changes | https://launchyournextchapter.com/after-a-layoff |
| 9 | Rankings and data drops | Monthly (2nd) | Link-bait lists (employers, skills, AI pay) | https://launchyournextchapter.com/rankings |

Rules that apply to all pillars: every number comes from our data or a cited source (the number checker in `validate.ts` stays on); layoff posts name employers only through the approved queue; no promises about hiring, pay or treatment of applicants; jobs reports cover all white-collar levels (Census groups 1 and 2), never a mid-level-only view.

## 3. Content, assets, virality, channel, per pillar

**1. Daily layoffs.** Source: WARN sync, layoff-news cron, `layoffs@` inbox. Content: one totals post at 13:00 UTC (built), plus approved single-company posts, 1 to 3 a day. Asset: auto card (employer, jobs cut, state, date) from `cards.ts`. Virality: be first and be specific (headcount, location, "what to do if you work there"), tag the outlet or agency that reported it; people share the layoff that hits their city or employer. Channels: Bluesky, X (largest only), Threads, Mastodon, Telegram; LinkedIn via held draft.

**2. End-of-week layoff rundown.** Source: the week's notices. Content: top 5 cuts by headcount, biggest state, biggest sector, week-over-week change, one "what this means" line, three links (state pages, help page, the RSS). Asset: one vertical card (carousel for LinkedIn/Instagram, 5 slides) plus a single chart image. Virality: the carousel is the saveable object; the RSS lets journalists and bloggers pull it without asking. Channels: LinkedIn carousel (Fri 8:00 local), Bluesky/Threads thread, Facebook, email to subscribers, press list. Page: https://launchyournextchapter.com/layoffs/week.

**3. Monthly employment report.** Source: BLS (payrolls, unemployment rate, JOLTS), already posted by `bls-release.ts`. Content: same-day thread, "what changed for professional and business services, information, finance", plus 1 chart. Asset: 2 charts (payrolls change, openings vs. layoffs). Virality: speed on release morning; plain-language headline number first. Channels: X, Bluesky, LinkedIn, Threads; journalist email.

**4. Jobs report.** Source: job feeds + `docs/specs/NextChapter_Jobs_Report_Spec.md`. Content: national edition monthly; metro/county editions rolled out one metro a week so every week has a local story. Asset: top-10 table card, map. Virality: local pages travel through local pages (city subreddits, local news, chambers, workforce boards). Channels: LinkedIn, Facebook groups, Reddit (city subs, only where rules allow), local press email, workforce-board partners.

**5. Hot jobs.** Source: job feed + hiring index. Content: Tue and Thu, "10 roles hiring in [metro/role family] this week" with pay and level. Asset: list card. Virality: pay ranges and "entry-level included" make it saveable. Channels: Facebook, LinkedIn, Bluesky, Threads.

**6. Tips and tricks.** Source: career guides (`find_career_guide`), glossary, resume scoring data. Content: Mon/Wed/Sat, one tip each in a fixed series ("Resume fix of the week", "Interview answer", "Network message you can copy", "Severance and unemployment: what to check"). Asset: text card or 20-second screen recording. Virality: copy-paste value; resume-score statistics from our own data as the hook. Channels: LinkedIn, Threads, Facebook, short video.

**7. New retraining.** Source: `funding-opportunities`, `course-scan`, AI courses pages. Content: one new or changed program per week (who pays, who qualifies, deadline). Asset: simple card. Channels: LinkedIn, Facebook, workforce-board and college partners (they re-share).

**8. New benefits.** Source: state UI data (`state-ui`), COBRA/ACA pages, `laid_off_benefits_and_programs`. Content: one change or deadline per week, by state. Asset: state card. Virality: state-specific posts get shared by state agencies and local press. Channels: Facebook, LinkedIn, Bluesky, state tags.

**9. Rankings and data drops.** Source: rankings crons (2nd of month). Content: one list post, one chart, one press email. Channels: all, plus journalist list.

## 4. Channel roles

| Channel | Role | Volume |
|---|---|---|
| LinkedIn (company page) | Authority, carousels, reports | 1/day, weekdays |
| Bluesky, Threads, Mastodon | Real-time layoffs and data | Stream, all pillars |
| X | Largest layoffs and BLS morning only (billed per post) | Capped |
| Facebook | Hot jobs, benefits, retraining; groups | 1 to 2/day |
| Telegram, Discord, Slack | Stream mirror | Stream |
| Email (public list) | Friday rundown | Weekly |
| Press list | Monthly report and rankings | Monthly |
| Short video (TikTok, Reels, Shorts) | Tips, weekly rundown read-out | 3/week, new |
| Reddit | Local jobs reports and layoff data where allowed | Weekly, human only |

## 5. Weekly schedule

| Day | Morning | Midday | Afternoon |
|---|---|---|---|
| Mon | Weekly layoff totals (auto) | Tip: resume fix | Hot jobs thread prep |
| Tue | Member digest (existing) | Hot jobs (2 posts) | Retraining item |
| Wed | Tip: interview answer | Benefits item | Local jobs report (metro of the week) |
| Thu | Hot jobs (2nd) | Tip or video | Press/outreach for Friday rundown |
| Fri | End-of-week layoff rundown (carousel, email, thread) | BLS release day: first Friday of the month, report + thread | Weekend queue loaded |
| Sat | Tip (saveable) | | |
| Sun | Off; only the auto layoff stream | | |

Daily: layoff roundup at 13:00 UTC (built). Monthly: BLS release (first Friday), rankings (2nd), national jobs report (mid-month), metro editions weekly.

## 6. Automation roadmap

Order is by value and effort. Items 1 to 3 reuse existing machinery.

1. **Content calendar view in admin** (extend https://launchyournextchapter.com/support/admin/content-drafts): one list of what is due today per pillar, each with a draft, an asset and an Approve button. This is the "daily motion" surface.
2. **Friday rundown generator:** weekly totals plus top 5 plus carousel slides (`cards.ts`) plus email body, drafted Friday 06:00, held for one click.
3. **Hot jobs, tips, retraining, benefits as new fact types** in `facts.ts`, so they flow through the existing writer, number checker and channel stream. Tips need a written bank of about 60 items first (the one thing only a person can seed).
4. **Public Friday email** (Resend, using the existing digest infrastructure), opt-in only.
5. **Short video:** script from the tip bank, screen-recording or voice template; human reviews before posting.
6. **LinkedIn:** widen held drafts to carousels and the Friday rundown.
7. **Measurement:** PostHog events for each post type (`social_post_sent`, `content_draft_approved`, `rundown_email_sent`) with `{ pillar, channel, factKey, utm_campaign }`, and a weekly pillar-by-channel clicks and signups view.

## 7. Your daily motion (target 20 minutes)

- **Morning (10 min):** open the admin content-drafts page, approve or edit the day's drafts (layoff companies, hot jobs, the tip), check the `layoffs@` inbox items.
- **Midday (5 min):** one reply/engagement pass on LinkedIn and Bluesky (journalists, state agencies, workforce boards).
- **Friday (+20 min):** approve the rundown carousel and email, send the press note.
- **First Friday / 2nd of month (+30 min):** review the BLS thread and the rankings release.

## 8. Metrics to review weekly

Clicks and registrations per pillar and channel (PostHog), top 5 posts, layoff-page traffic, email list growth, press pickups, RSS subscribers. Cut any pillar-channel pair with no clicks after 4 weeks.

## 9. Decisions needed from the owner

1. Which channels are live today (keys set), and whether TikTok/Reels/Shorts should be added.
2. Whether the Friday rundown goes to a public email list (new opt-in list) or only to members.
3. Who seeds the 60-item tips bank (or approve a Claude-drafted first batch for your review).
