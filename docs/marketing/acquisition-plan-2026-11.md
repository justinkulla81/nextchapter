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
2. Change one variable at a time (offer, first line or audience), and call a winner only after about 300 sends per variant. At 100 sends and a true 5% rate, the 95% range is roughly 1–9%. Two channels cannot reach that: LinkedIn (about 30 messages a month, per the owner) and B2B email (a list of 25). Their results are qualitative: read every reply, and call a variant promising or not only after it has gone to at least 30 people (my judgment).
3. Fix the offer before the copy. Value = (dream outcome × likelihood) ÷ (time and effort).
4. Never automate sending on LinkedIn. The sources I found say LinkedIn's User Agreement bans bots and automated messaging (verify against the agreement itself).
5. Nothing that claims or promises beyond helping people plan and find roles. Same rule as `docs/linkedin-layoff-posts.md`, and the owner's working-style rule on commitments.
6. Use only public information about people. Never name affected individuals in public posts.
7. Send in the recipient's working hours and around the layoff itself (section 4a).

## 3. Channel scorecard

| # | Channel | Audience | Motion | Already built | Phase | Cost | Gate to continue |
|---|---|---|---|---|---|---|---|
| 1 | LinkedIn direct messages to people who announced they are looking | A | Manual, personal, value-first. About 30 a month, so it recruits interviews and tests offers; it is not the volume engine | Draft pipeline for the company page only (`src/lib/linkedin/`); direct messaging is new | 1 (weeks 1–4) | Owner time, about 30 messages a month | Qualitative: at least 3 replies and 3 interviews booked from the first 30 sends (my judgment) |
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
- Pick the first 25 B2B accounts and the first 30 laid-off targets.
- Lock the first offer for each audience (see 6).
- Run 10 interviews with laid-off people to confirm the offer and the activation event.

### Weeks 1–4 (Nov 9 – Dec 4): three channels plus two always-on
- **LinkedIn DMs (A):** about 30 a month (roughly 7 a week) by hand, to white-collar people with a public "looking" signal within the last 30 days of a layoff. At that volume the job is to book interviews and read replies, not to compare rates. Variants (deadlines offer, pay and market check, first-week plan) each go to at least 10 people before any call. If the 30 is an InMail allowance, check whether connection requests with a note or open-profile messages are separate (not verified).
- **B2C volume comes from other sources:** people who already gave an email (alert subscribers, leads, the nurture emails), social, search and Reddit. LinkedIn cannot supply it at this volume.
- **B2B cold email (B):** 5–10 a week, sent within 72 hours of a layoff being announced. Contact is the rapid response coordinator, HR head or outplacement vendor named in the story. Every email carries the opt-out.
- **Social:** keep automatic filing posts. Add one weekly deadline post.
- **Monthly researcher and press email:** first send after the November White Collar Employment Report publishes (the doc says within two business days of the BLS release, usually the first Friday). Content: three findings, one chart, the data CSV and the replication repo. The report keeps its owner-set scope: all white-collar jobs at every level.

### Week 4 checkpoint (Dec 7)
Compare every channel against its gate. Keep, change one variable, or stop. Decide whether paid tests start.

### Weeks 5–8 (Dec 7 – Jan 1): paid tests, only if gates pass
Section 5 holds the gates. Start with Google search ads (highest intent). Add Reddit next and Facebook last.

## 4a. Timing and working hours

Everything here is a hypothesis to test, not a benchmark. Hold one timing rule fixed through week 4 so it does not become a second variable; test timing after the checkpoint. Log the send time and the recipient's time zone on every message.

- **Recipient's local working hours.** Take the time zone from the person's profile location, or from where the layoff is. Send in the recipient's morning, roughly 8–10 am local.
- **B2B email: Tuesday to Thursday, about 8–11 am recipient local time.** Avoid Monday mornings and Friday afternoons. Workforce boards are public offices, so respect state holidays and business hours.
- **B2C LinkedIn: weekday mornings, with a second window around 5–7 pm local.** The company-page post slots already in the repo (8:15 am, 12:10 pm, 5:20 pm ET) are the baseline for the page, not for direct messages.
- **Around the layoff.** B2B: within 72 hours of the announcement, and likely before the affected employees' last day. Ask each partner when their sessions run. B2C: as early in the first 30 days as possible, because the deadlines (COBRA election, unemployment claim) run from the layoff.
- **Calendar.** US Thanksgiving week (Nov 23–27) and Dec 24 – Jan 1 are likely slow for B2B. Front-load B2B sends before Dec 18 and hold the rest until Jan 4.
- **Owner's own hours.** LinkedIn is manual, so batch it into two 20-minute windows that land in recipients' mornings. For email, use scheduled sends if the outreach system supports them (check `src/lib/outreach/quotas.ts`, which I have not read).

## 5. Paid-ad gates

At the current 0.14% visitor-to-account rate, paid traffic is wasteful. Illustration, assuming a click costs $1.50–$3 (my assumption, not a quote): $1.50 ÷ 0.0014 ≈ $1,070 and $3 ÷ 0.0014 ≈ $2,140 per account. At 2% it is about $75–$150, and at 5% about $30–$60.

Start paid spend only when all of these are true:
1. An audience-specific landing path converts at least 2% of unpaid visitors to accounts (my judgment, not a benchmark).
2. Revenue per activated member, or the value of a B2B pilot, is written down.
3. Test budget, approved by the owner (2026-11-04): $300 per channel for four weeks, one channel at a time. The most at risk at first is $300 (Google), and $900 only if all three tests run. Use a hard daily cap of about $11 per channel.

What $300 can and cannot tell you: at the assumed $1.50–$3 a click it buys roughly 100–200 clicks, which at even a 2% conversion is 2–4 accounts. A test that size cannot measure cost per account. Judge it on leading indicators instead: the share of clicks that start the free tool (about 10% is the aim, my judgment) and the cost per tool start.

Stop-loss (my proposal): pause at $150 if fewer than 5% of clicks start the free tool or the platform flags the ads. Stop at $300 regardless, and spend more only after a review and a changed offer or page.

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

### B2B pilot: free to start, time-boxed, with the paid conversation built in (recommendation, owner to confirm)

Why free is valuable to them (the value equation's time delay and effort):
- A layoff window is days long and procurement takes weeks. A government board buys through formal processes (the app carries an RFP template page). Free removes the delay.
- Nothing to approve beyond sharing a link: no budget line, no contract.
- Their affected employees get something working while the window is open.

Why not sell upfront yet: there is no B2B reference and no outcomes data. Graham's advice on consulting for a single user is to keep it unpaid, because paid work creates expectations to solve everything.

The counter-argument is real. Hustle Fund looks for proof that customers will pay, and revenue is the best metric. A free pilot proves usage, not price. So the pilot includes a willingness-to-pay test.

Terms (only what NextChapter will actually provide, per the working-style rule; owner to confirm every line):
1. **Scope:** one layoff event, 30 days from the day the link is shared, at no cost.
2. **They get:** a source-tagged link for the affected employees, the member tools, and consented aggregate outcome counts (CSV or webhook) at day 30. Counts only, never names or drafts (the existing outplacement rule).
3. **We ask:** one named contact, a 15-minute check-in at day 14, a price conversation at day 14, and written agreement on whether results can be cited.
4. **No promises:** no guarantee of outcomes, hire rates or response times. Reverse the risk with "free, no contract, stop any time", which is a term we can keep.
5. **Success criteria** agreed at kickoff (for example the share of invited employees who register and activate), set with the partner.
6. **Limit:** 3–5 pilots in total.

Learning rule: if after 3 pilots no partner will name a price or agree to a paid next event, treat it as a pricing or buyer problem, not a pitch problem.

My read by buyer, not verified: workforce boards serve residents free and buy slowly, so the likely long-term shape is a free partnership that earns referrals and outcome data. Employers and outplacement vendors are the likelier payers, so the day-14 price conversation matters most there. Pricing (per event, per seat or subscription) is not set. The competitor pricing in the repo is marked "NEEDS VERIFICATION" in `docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md`, so do not anchor on it.

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

- A channel that reaches 300 sends (or $300 spend) with a response rate under half its floor stops, unless the offer changes and gets a fresh 300. LinkedIn DMs and B2B email use judgment instead: review after the first 30 sends and the first 25 accounts, with the replies read in full.
- Any channel that draws a platform warning or policy flag pauses until reviewed.
- Opt-outs are honored immediately and suppressed across channels.
