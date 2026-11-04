# Acquisition plan: laid-off white-collar workers and the providers who serve them

Written 2026-11-04. Draft for the owner's review. Nothing here is built or sent yet.

## 1. Goal, audiences and metrics

**Audience A (B2C):** white-collar workers in the first 30 days after a layoff.
**Audience B (B2B):** outplacement firms, workforce boards (rapid response) and employers that have just had a layoff.

Two metrics, one funnel:

| Metric | Definition | Denominator |
|---|---|---|
| Response rate | Replies to outbound messages. Count total replies and positive replies (a question, a yes, a click-and-act) separately. Opt-outs and hostile replies are counted on their own. | People messaged |
| Activation rate | Existing definition in `src/lib/admin/campaign-funnel.ts`: onboarded, a résumé in, and a job saved or opened within 7 days of registering. Counted only for people registered 7+ days ago. | Two views: of people reached, and of accounts created |

- Open question for the owner: that activation definition is job-search based. For the first-30-days cohort the real "aha" may be the deadline guide or pay check. The interviews decide whether to change it.
- Rule from the owner: when activation (of people reached) reaches 5%, shift focus to engagement.
- Baseline (PostHog, week of Nov 1): about 650 visitors, 3 accounts, 7 leads. Visitor-to-account is about 0.14%. Outbound response rate has no baseline because outbound was not tracked.

## 2. Operating rules

1. Sequence channels. Hormozi's Core Four (as summarized by secondary sources) says to master one channel before adding another. This plan starts three and defers the rest behind gates.
2. Change one variable per week (offer, first line or audience), and call a winner only after about 300 sends per variant. At 100 sends and a true 5% rate, the 95% range is roughly 1–9%. B2B lists are too small for this, so B2B results are qualitative.
3. Fix the offer before the copy. Value = (dream outcome × likelihood) ÷ (time and effort).
4. Never automate sending on LinkedIn. The sources I found say LinkedIn's User Agreement bans bots and automated messaging (verify against the agreement itself).
5. Nothing that claims or promises beyond helping people plan and find roles. Same rule as `docs/linkedin-layoff-posts.md`, and the owner's working-style rule on commitments.
6. Use only public information about people. Never name affected individuals in public posts.

## 3. Channel scorecard

| # | Channel | Audience | Motion | Already built | Phase | Cost | Gate to continue |
|---|---|---|---|---|---|---|---|
| 1 | LinkedIn direct messages to people who announced they are looking | A | Manual, personal, value-first | Draft pipeline for the company page only (`src/lib/linkedin/`); direct messaging is new | 1 (weeks 1–4) | Owner time, 60–90 min a day | Total reply rate ≥3% after 300 sends |
| 2 | Cold email, triggered by a layoff | B | 5–10 hand-written emails a week to 25 named accounts | `src/lib/outreach/` (touches, quotas, opt-out, reply classes), CRM contacts from `src/lib/warn/layoff-contacts-run.ts` | 1 | Owner time | Positive reply ≥5% and 1 pilot conversation by week 4 |
| 3 | X and Bluesky organic | A | Automatic WARN-filing posts, plus one weekly deadline post | `src/lib/social/channels.ts` (Bluesky, Mastodon, Threads, Facebook, X). X costs about $0.20 a post with a link and is capped | 1 (keep running) | Already running | Clicks to accounts, by tagged source |
| 4 | Monthly email to researchers, think tanks and journalists | Earned media | One email after each report edition | Report pack, replication repo, press page, `research_partners` mailing list | 1 | About 1 hour a month | Replies, citations, inbound requests |
| 5 | Reddit | A | Organic first, small paid test after | `src/lib/reddit/` (threads, todo). I have not read it | 2 (weeks 5–8) | Test budget, owner decision | Gate in section 5 |
| 6 | Google search ads | A | Search intent (for example COBRA deadline after layoff) | `campaign-funnel.ts` tracks tagged traffic | 2 | Test budget | Gate in section 5 |
| 7 | Facebook and Instagram ads | A | Test only | None | 3 | Test budget | Gate in section 5, plus a policy check |
| 8 | LinkedIn ads, Google ads for B2B | B | Deferred | None | Not now | n/a | Reconsider only if the account list outgrows hand outreach |

## 4. Phased plan

### Week 0 (Nov 4–8): get measurable
- Tag every channel with UTM parameters (source, medium, campaign naming per `src/lib/marketing/campaign-tag.ts`; read its format first).
- Add the three events in section 7 and log every manual message with date, audience, variant and source URL.
- Build the Monday dashboard: per channel, sent, replied, positive, visits, accounts, activated (the existing campaign funnel plus the new events).
- Pick the first 25 B2B accounts and the first 100 laid-off targets.
- Lock the first offer for each audience (see 6).
- Run 10 interviews with laid-off people to confirm the offer and the activation event.

### Weeks 1–4 (Nov 9 – Dec 4): three channels plus two always-on
- **LinkedIn DMs (A):** about 20 messages a day by hand, to white-collar people with a public "looking" signal within the last 30 days of a layoff. Variant A is the deadlines offer, variant B the pay and market check, variant C the first-week plan. One variable changes each week.
- **B2B cold email (B):** 5–10 a week, sent within 72 hours of a layoff being announced. Contact is the rapid response coordinator, HR head or outplacement vendor named in the story. Every email carries the opt-out.
- **Social:** keep automatic filing posts. Add one weekly deadline post.
- **Monthly researcher and press email:** first send after the November White Collar Employment Report publishes (the doc says within two business days of the BLS release, usually the first Friday). Content: three findings, one chart, the data CSV and the replication repo. The report keeps its owner-set scope: all white-collar jobs at every level.

### Week 4 checkpoint (Dec 7)
Compare every channel against its gate. Keep, change one variable, or stop. Decide whether paid tests start.

### Weeks 5–8 (Dec 7 – Jan 1): paid tests, only if gates pass
Section 5 holds the gates. Start with Google search ads (highest intent). Add Reddit next and Facebook last.

## 5. Paid-ad gates

At the current 0.14% visitor-to-account rate, paid traffic is wasteful. Illustration, assuming a click costs $1.50–$3 (my assumption, not a quote): $1.50 ÷ 0.0014 ≈ $1,070 and $3 ÷ 0.0014 ≈ $2,140 per account. At 2% it is about $75–$150, and at 5% about $30–$60.

Start paid spend only when all of these are true:
1. An audience-specific landing path converts at least 2% of unpaid visitors to accounts (my judgment, not a benchmark).
2. Revenue per activated member, or the value of a B2B pilot, is written down.
3. The owner has set a test budget. Suggested: $300 per channel for four weeks, with a stop-loss.

Platform checks before launching:
- **Meta:** the Personal Attributes policy bars ads that assert or imply the viewer's circumstances, so no copy like "Were you laid off?" Employment or financial special categories may restrict targeting. These come from secondary sources, so read Meta's Transparency Center first. I could not confirm whether employer-based targeting is allowed in the relevant category.
- **Google:** do not resemble a government unemployment site. Verify the current policy.
- **LinkedIn ads for B2B:** a universe of 25–100 accounts is better reached by direct email and messages.

## 6. Offers to test (written down so each is tested, not assumed)

| Audience | Offer | Why |
|---|---|---|
| A | A deadline and money check for your state (COBRA, unemployment, severance), delivered before asking for an account | The first 30 days are about not losing money and benefits; job search comes later (my reading of the site's content) |
| A | Variants: pay and market check; first-week plan | Tests which problem pulls hardest |
| B | A source-tagged link for a company's affected employees, with consented outcome counts sent back | From `docs/WORKFORCE_VENDOR_LANDSCAPE.md` |

Open decision for the owner: the exact pilot terms for B. Hormozi-style guarantees and bonuses conflict with the working-style rule against promises the company is not required to make, so terms must be what NextChapter will actually provide.

## 7. Instrumentation to add

- `layoff_outreach_sent`: audience, channel, variant, companyId or notice id, source.
- `layoff_outreach_replied`: same properties plus `kind` (positive, neutral, negative, optout).
- `member_activated`: from the existing definition, with the first-touch campaign.
- UTM scheme: `utm_source=<linkedin_dm|email|bluesky|x|reddit|google|facebook>`, `utm_medium=<outreach|organic|paid>`, `utm_campaign=<b2c_laid_off|b2b_provider>_<variant>`.

## 8. Weekly rhythm

- Daily, 60–90 minutes: outreach block and logging.
- Monday: review the dashboard, make one keep, change or stop decision per channel, set the one variable for the coming week.
- First Monday of each month: send the researcher and press email once the report edition is live.

## 9. Conflicts in the advice, and how this plan resolves them

| Tension | Resolution here |
|---|---|
| Hormozi: master one channel at a time vs. the owner's seven channels | Three starting channels plus two cheap always-on ones; the rest behind gates |
| YC: avoid distractions like press chasing | The monthly email is a by-product of a report you already produce, capped at about an hour a month |
| YC: partnerships usually disappoint | B2B is 25 hand-picked accounts, not a partner program |
| YC: grow after fit vs. Graham: track weekly growth | Weekly growth is tracked on activated members, not visitors |
| Hormozi: volume first vs. small B2B list | Volume for A; personalization for B |
| Paid ads vs. unit economics | Paid is gated on conversion and a known value per activated member |

## 10. Stop rules

- A channel that reaches 300 sends (or $300 spend) with a response rate under half its floor stops, unless the offer changes and gets a fresh 300.
- Any channel that draws a platform warning or policy flag pauses until reviewed.
- Opt-outs are honored immediately and suppressed across channels.
