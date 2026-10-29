# Lead nurture: the follow-up emails for people who gave an email

Built 2026-10-29. Code: `src/lib/leads/nurture/`. Cron: `/api/cron/lead-nurture` (daily at 14:15 UTC: 10:15 AM ET until 1 November, 9:15 AM after). **Off until `NURTURE_EMAILS=1`.**

## What it is

Three short emails over two weeks to people who gave us an email on the public site and have not become members. Each has one job and one button, then we stop. It is the value-first companion to the lifecycle emails (`src/lib/leads/lifecycle/`, switch `LEAD_LIFECYCLE_EMAILS`), which ask for a profile.

| Step | Day after the capture's own email | Job |
|---|---|---|
| `next_step` | 3 | The single most useful next step, linked to the exact page or tool |
| `data_point` | 7 | One number from our own public data that bears on their situation |
| `assessment` | 14 | Start the Market Reality Assessment; the link opens on their situation (`/start/<persona>`), so the answer they gave carries over |

Day 0 is the email each capture already sends (first-week plan, deadline or alert confirmation, pay check result, guide).

## Who is in it (and who is not)

| Capture | Day 0 | Track |
|---|---|---|
| Journey picker (`HomepageLead` kind `journey`) | plan email sent (`planSentAt`) | by situation: laid off, searching (resigned, searching too long), considering, changing |
| Deadline reminders (COBRA, unemployment, severance, layoff deadlines) | confirmation clicked (`confirmedAt`) | laid off (state-aware) |
| Layoff alerts | confirmation clicked | watching layoffs (risk-check leads: considering) |
| Pay check | result email sent (`planSentAt`) | pay |
| Guide download (`GuideLead`) | row written when the guide email is sent | laid off or considering, by the guide's situations |

**Left to the lifecycle emails (never in this sequence):** saved or applied jobs, confirmed job alerts, the newsletter, waitlist signups. `lifecycleAddresses()` in `lifecycle/run.ts` is the single list of who they cover; an address on it is skipped here, so nobody gets both. Résumé-check leads are not included in this version.

One sequence per address: the capture that says the most about where they are (journey, then deadline, layoff alert, pay check, guide), then the earliest.

## Rules

- A step goes out only in its window (day 3 to 7, 7 to 11, 14 to 18). A step missed past its window is skipped, never sent late. So turning the switch on never mails a back catalogue.
- At least 2 days after any other email from us (lifecycle or this sequence).
- A step is sent at most once per address (the CRM activity key `nurture:<step>:<email>` is unique).
- Stops, checked every run: registered (a finished profile with the address, or a CRM person linked to a candidate); unsubscribed from any website capture or the newsletter; off the website leads list; bounced, complained or marked do-not-email (`MailingSuppression`); our own team addresses; an unconfirmed deadline or layoff signup; a journey or pay check whose own email never went out.
- Daily cap `NURTURE_DAILY_CAP` (default 20), counted from the CRM log, separate from the shared Resend volume. At most 50 per run. Due but over the cap: picked up on a later run while still inside their window.
- Every email: unsubscribe link and `List-Unsubscribe` header (the same `/updates/unsubscribe/<token>` as the lifecycle emails), postal address, the "NextChapter · Candidate" audience line, an open pixel and a tracked button. While rolling out, the admin address is bcc'd on live sends, as for the lifecycle emails.
- No AI. The words are templates (`content.ts`) and three kinds of figure, each from a page we publish: the long-search figures (`LTU_JAN_AUG`, tested against the report text), the state benefit figures (`STATE_UI`, sourced and dated), and the AI-skill pay gap (read live from the market snapshot; with no snapshot the day-7 email falls back to the long-search figure).

## Switches and cap

| Variable | Default | Effect |
|---|---|---|
| `NURTURE_EMAILS` | unset (off) | `1` sends. Off: the cron is a dry run and writes nothing |
| `NURTURE_DAILY_CAP` | 20 | Most sends per UTC day |

It does **not** turn on any other switch. The first email of each capture still depends on its own switch (`DEADLINE_REMINDER_EMAILS`, `LAYOFF_ALERT_EMAILS`, `PAY_CHECK_EMAIL`). Without them, no deadline, layoff or pay-check lead reaches day 0 and the sequence has nobody to send to. Journey and guide leads need no switch.

## Dry run

With the switch off, `GET /api/cron/lead-nurture` returns counts and subjects only, no addresses, and writes nothing (it does not even file the CRM record): `considered`, `ownedByLifecycle`, `registered`, `stopped`, `notDue`, `due`, `byStep`, `byTrack`, `overCap`, `dailyCap`, `sentToday`, `sampleSubjects` and `aiFactsAsOf` (the date of the AI figures the day-7 emails would quote).

## Measuring

Admin funnel page, block 5: per step, sent, opened and clicked (the CRM outreach tracking), and how many recipients have since registered. The registration note on a person's CRM record (`noteLeadConversion`) lists their `nurture:` emails with the lifecycle ones. PostHog: `nurture_email_sent` with `track`, `step` and `kind`.

## Storage

No schema change and no SQL. Progress is the CRM activity log (`CrmActivity` type EMAIL, `sourceRef` `nurture:<step>:<email>`), the same ledger the lifecycle emails use.

## Turning it on

1. Read the copy below and say so.
2. `NURTURE_DAILY_CAP=3`, then `NURTURE_EMAILS=1`, so the first live run is tiny and every send is bcc'd to the admin.
3. Watch the funnel page block and the admin inbox for a few days; raise the cap when it looks right.

## The copy (generated from `content.ts`; the long-search, state benefit and AI figures are examples)

#### laid_off

**Day 3 (next_step)**: subject: Two deadlines after a layoff, side by side

> Two clocks are running on your health coverage
>
> Hi,
>
> Health coverage has deadlines. You generally have 60 days to elect COBRA, and a 60-day window to join a marketplace plan after losing job coverage. Which one costs less depends on your income and where you live.
>
> Our Texas page puts COBRA and a marketplace plan side by side, with the cost math and who should pick which.
>
> [Compare COBRA and ACA] -> /resources/cobra-aca/texas
>
> _This is the first of three short notes over two weeks, then we stop._

**Day 7 (data_point)**: subject: How long searches are running now

> You are not the only one
>
> Hi,
>
> Among unemployed white-collar workers, 28.1% had been out of work 27 weeks or more in January to August 2026, up from 22.8% a year earlier (+5.3 points, ±2.4 at the 90% level).
>
> Texas pays up to 26 weeks of regular unemployment benefits, at most $619 a week (U.S. Department of Labor, July 2026), so a long search can outlast them.
>
> We publish the method and the data.
>
> [See Texas benefits] -> /unemployment-benefits/texas
>
> _One more after this, then we stop._

**Day 14 (assessment)**: subject: Where do you stand? Your Market Reality Assessment

> See how the market reads you
>
> Hi,
>
> Two weeks in, the most useful next step is to see where you stand: how a hiring manager scores you on 15 things, which gaps are worth closing first, and what you are worth. It takes about five minutes and it is free.
>
> The page below opens on your situation, so you do not answer that question again.
>
> [Open your plan] -> /start/laid-off
>
> _This is the last note. After it we leave you alone._

#### searching

**Day 3 (next_step)**: subject: Cover the bills while you keep looking

> Bridge income
>
> Hi,
>
> A search often takes longer than people plan for. Our bridge income guide covers ways to bring in income while you search, without derailing it.
>
> [Read the bridge income guide] -> /resources/bridge-income
>
> _This is the first of three short notes over two weeks, then we stop._

**Day 7 (data_point)**: subject: How long searches are running now

> You are not the only one
>
> Hi,
>
> Among unemployed white-collar workers, 28.1% had been out of work 27 weeks or more in January to August 2026, up from 22.8% a year earlier (+5.3 points, ±2.4 at the 90% level).
>
> We publish the method and the data.
>
> [See the numbers] -> /reports/white-collar-index
>
> _One more after this, then we stop._

**Day 14 (assessment)**: subject: Where do you stand? Your Market Reality Assessment

> See how the market reads you
>
> Hi,
>
> Two weeks in, the most useful next step is to see where you stand: how a hiring manager scores you on 15 things, which gaps are worth closing first, and what you are worth. It takes about five minutes and it is free.
>
> The page below opens on your situation, so you do not answer that question again.
>
> [Open your plan] -> /start/resigned
>
> _This is the last note. After it we leave you alone._

#### considering

**Day 3 (next_step)**: subject: Is your pay in line with the market?

> Check your pay against live listings
>
> Hi,
>
> Before you move, or ask for more, it helps to know what the market is paying. Our pay check compares your salary with the ranges employers advertise on live listings for your kind of role.
>
> [Check my pay] -> /tools/pay-check
>
> _This is the first of three short notes over two weeks, then we stop._

**Day 7 (data_point)**: subject: What employers advertise for AI skills

> The AI pay gap in live listings
>
> Hi,
>
> In the U.S. listings we read, postings that ask for a specific AI skill advertise pay 16.9% higher than similar postings that do not, matched on function, level and industry. It rests on 12,214 paid postings that ask and 16,496 that do not, as of October 26.
>
> That is advertised pay, not what anyone is paid, and it does not show that a skill causes a raise.
>
> We publish the method and a table you can download.
>
> [See the table and method] -> /resources/ai-skills-pay-premium
>
> _One more after this, then we stop._

**Day 14 (assessment)**: subject: Where do you stand? Your Market Reality Assessment

> See how the market reads you
>
> Hi,
>
> Two weeks in, the most useful next step is to see where you stand: how a hiring manager scores you on 15 things, which gaps are worth closing first, and what you are worth. It takes about five minutes and it is free.
>
> The page below opens on your situation, so you do not answer that question again.
>
> [Open your plan] -> /start/thinking-about-a-move
>
> _This is the last note. After it we leave you alone._

#### changing

**Day 3 (next_step)**: subject: See what the next field pays and asks for

> Look at the field before you leap
>
> Hi,
>
> A move into a new field starts with what it pays and what it asks for. Each job title page shows the openings, the pay employers state, and where the roles are.
>
> [Browse job titles] -> /jobs/title
>
> _This is the first of three short notes over two weeks, then we stop._

**Day 7 (data_point)**: subject: What employers advertise for AI skills

> The AI pay gap in live listings
>
> Hi,
>
> In the U.S. listings we read, postings that ask for a specific AI skill advertise pay 16.9% higher than similar postings that do not, matched on function, level and industry. It rests on 12,214 paid postings that ask and 16,496 that do not, as of October 26.
>
> That is advertised pay, not what anyone is paid, and it does not show that a skill causes a raise.
>
> We publish the method and a table you can download.
>
> [See the table and method] -> /resources/ai-skills-pay-premium
>
> _One more after this, then we stop._

**Day 14 (assessment)**: subject: Where do you stand? Your Market Reality Assessment

> See how the market reads you
>
> Hi,
>
> Two weeks in, the most useful next step is to see where you stand: how a hiring manager scores you on 15 things, which gaps are worth closing first, and what you are worth. It takes about five minutes and it is free.
>
> The page below opens on your situation, so you do not answer that question again.
>
> [Open your plan] -> /start/career-change
>
> _This is the last note. After it we leave you alone._

#### layoff_watch

**Day 3 (next_step)**: subject: What a layoff notice gives you

> Know your rights before the notice
>
> Hi,
>
> You asked to hear about layoff notices. If one is ever yours, the federal WARN Act generally requires 60 days of notice from covered employers. Our guide explains who is covered, the exceptions, and what a state law can add.
>
> [Read the WARN Act guide] -> /resources/warn-act
>
> _This is the first of three short notes over two weeks, then we stop._

**Day 7 (data_point)**: subject: How long searches are running now

> You are not the only one
>
> Hi,
>
> Among unemployed white-collar workers, 28.1% had been out of work 27 weeks or more in January to August 2026, up from 22.8% a year earlier (+5.3 points, ±2.4 at the 90% level).
>
> We publish the method and the data.
>
> [See the numbers] -> /reports/white-collar-index
>
> _One more after this, then we stop._

**Day 14 (assessment)**: subject: Before you need it: your Market Reality Assessment

> See how the market reads you
>
> Hi,
>
> Two weeks in, the most useful next step is to see where you stand: how a hiring manager scores you on 15 things, which gaps are worth closing first, and what you are worth. It takes about five minutes and it is free.
>
> The page below opens on your situation, so you do not answer that question again.
>
> [Open your plan] -> /start/thinking-about-a-move
>
> _This is the last note. After it we leave you alone._

#### pay

**Day 3 (next_step)**: subject: Your pay check, with the full range

> See the whole range
>
> Hi,
>
> Your pay check compared you with one number. The page for your kind of job shows the full range employers advertise, by state, and the openings behind it.
>
> [See the pay page] -> /salaries/project-manager
>
> _This is the first of three short notes over two weeks, then we stop._

**Day 7 (data_point)**: subject: What employers advertise for AI skills

> The AI pay gap in live listings
>
> Hi,
>
> In the U.S. listings we read, postings that ask for a specific AI skill advertise pay 16.9% higher than similar postings that do not, matched on function, level and industry. It rests on 12,214 paid postings that ask and 16,496 that do not, as of October 26.
>
> That is advertised pay, not what anyone is paid, and it does not show that a skill causes a raise.
>
> We publish the method and a table you can download.
>
> [See the table and method] -> /resources/ai-skills-pay-premium
>
> _One more after this, then we stop._

**Day 14 (assessment)**: subject: Where do you stand? Your Market Reality Assessment

> See how the market reads you
>
> Hi,
>
> Two weeks in, the most useful next step is to see where you stand: how a hiring manager scores you on 15 things, which gaps are worth closing first, and what you are worth. It takes about five minutes and it is free.
>
> The page below opens on your situation, so you do not answer that question again.
>
> [Open your plan] -> /start/managing-my-career
>
> _This is the last note. After it we leave you alone._
