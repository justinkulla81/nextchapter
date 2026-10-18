# Finances and benefits: the place for money, paperwork and deadlines

Status: design and preview screens with sample data only. Nothing is wired.

## What exists today

- One page, https://launchyournextchapter.com/dashboard/benefits ("Benefits & Financial Bridge"): an action plan and topic cards. The menu hides it for people who are staying in a job and for people who have just landed one.
- https://launchyournextchapter.com/dashboard/support ("Support During Transition"): crisis line, a licensed professional, your coach.
- https://launchyournextchapter.com/dashboard/scam-watch.
- Laid-off first-week steps ("File for unemployment benefits", "Review your severance and benefits dates") that are plain text with no deadline or link.
- The career story branch (`claude/compassionate-edison-fkfdu5`, not merged) has a pause what-if with a "months of cushion" number, using the member's own savings, severance and monthly need.

Nothing tracks a runway, a deadline, a weekly unemployment certification, a tax date or a decision date. Today these live in Help, which reads as customer support, not as something to manage.

## Money is opt-in

Money is personal, and people get uncomfortable when it is raised without being asked. So we ask first, early (right after "Which sounds most like you?"), and the question itself is a courtesy: it says money is yours to share and we only use it if you want us to.

**"Would you like help with money while you search?"** Two equal buttons.

- **Yes.** Turns on Finances and benefits. What you get: how many months your money lasts (your runway); the deadlines you could miss, like health coverage, unemployment and severance; jobs filtered to a minimum pay you set; and a calm way to talk it through with your partner. For each journey the examples change.
- **No.** Nothing about money. No runway. We do not ask about past salary, savings or a minimum pay. The Finances and benefits place is hidden. Market pay data on jobs (the posted range) still shows, because it is not about you.

Either answer can be changed any time in Account and privacy. A "no" is never nagged. Asking is also a signal of respect, and it should read that way.

What "no" switches off: the Finances and benefits place; the last-salary question; the minimum-pay, flexible-pay and equity questions (the pay bundle in Jobs); the savings and monthly-need numbers; and the money steps in the first week (unemployment, severance), which are replaced by the next step.

## The place

**Finances and benefits**, with two entries, only when money help is on:

1. **Your runway**: how long your money lasts, what would stretch it, and the next date that matters.
2. **Benefits and deadlines**: the paperwork with a date on it, in order, each with why it matters and one button.

Talk to someone and Scam watch return to **Help**, with Questions and feedback. The career story, and its "What if you took a pause?" tool, live under Learn, Your path. Its "months of cushion" number and the runway use the same savings and monthly-need figures, asked once.

## Ideas for each journey

| Journey | What this place shows them |
|---|---|
| Laid off | Runway with severance and unemployment; deadlines for health coverage choice, severance review, claim and weekly certification, retirement account; what to tell family. |
| Thinking about a move | "Is it safe to leave?": the runway if you left today; the health coverage gap; vesting and bonus dates you would give up; notice period and any non-compete to read first. |
| Growing | Pay against the market, benefits you are not using, retirement match, a recession-proof cushion of three to six months, and an employer learning budget to claim. |
| Promotion | Total pay and benefits at the next level against today's, equity refresh, and when to raise it. |
| Changing careers | What the change costs: a pay dip, training cost, and funded training; runway for a step down; bridge income. |
| Student or new graduate | Loan repayment start and plans, first-paycheck budget, coverage under a parent's plan, moving costs, and offer comparison. |
| Returning after a break | Health coverage, childcare or care cost against pay, return-to-work programs, part-time pay against benefits. |
| Next act (55+) | Retirement timing, how earnings affect Social Security, Medicare enrollment windows, coverage before 65, income need against advisory pay. |
| Building something of my own | Personal and business runway side by side, quarterly estimated taxes, overdue invoices, self-employed health coverage, and a go or no-go date to decide on. |
| Fractional or independent | Quarterly taxes, outstanding invoices, renewals against cash, retirement and health for the self-employed, smoothing income across slow months. |
| Time off or on leave | Leave pay and benefits timeline, coverage during leave, a budget to the return date, and a restart reminder six weeks before. |

Every journey gets this place when money help is on. Stepping back from full-time work (the retirement paths in the career story branch) feeds the next-act and growing rows.

## What it needs

- **Data (new, private):** savings, severance, monthly need, income now, health coverage end date. The career story branch already collects savings, severance and monthly need for its pause what-if, so one set of numbers should serve both.
- **Already available:** last day worked drives the weeks of unemployment left; the benefits action plan; the supporters feature.
- **To build:** deadline dates from the last day (the 60 days to choose coverage, severance review window); a weekly certification reminder; quarterly tax dates for self-employed members; student loan and Medicare rule cards.
- **Rules to respect:** this is general information, not financial or legal advice, and it says so on the page. Unemployment and tax rules vary by state and country, so the first version is US only and links to the member's state. Financial data is never shown to employers, recruiters, schools or coaches, and the partner sees it only if the member shares a summary.

## Decisions made (owner, 2026-10-17)

- The place is called Finances and benefits, and it covers all 11 journeys.
- Money is opt-in, as above.
- A coach, school or program never sees a member's runway. Only the member's partner can, if the member chooses to share a summary.

## Open

1. First version: US only, starting with laid off, building something of my own and thinking about a move, then the rest?
