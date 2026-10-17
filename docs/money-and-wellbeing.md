# Money and wellbeing: the place for everything that is not a job, a person or a course

Status: design and preview screens with sample data only. Nothing is wired.

## What exists today

- One page, https://launchyournextchapter.com/dashboard/benefits ("Benefits & Financial Bridge"): an action plan and topic cards. The menu hides it for people who are staying in a job and for people who have just landed one.
- https://launchyournextchapter.com/dashboard/support ("Support During Transition"): crisis line, a licensed professional, your coach.
- https://launchyournextchapter.com/dashboard/scam-watch.
- Laid-off first-week steps ("File for unemployment benefits", "Review your severance and benefits dates") that are plain text with no deadline or link.
- The career story branch (`claude/compassionate-edison-fkfdu5`, not merged) has a pause what-if with a "months of cushion" number, using the member's own savings, severance and monthly need.

Nothing tracks a runway, a deadline, a weekly unemployment certification, a tax date or a decision date. Today these live in Help, which reads as customer support, not as something to manage.

## The place

**Money and wellbeing**, with four entries:

1. **Your runway**: how long your money lasts, what would stretch it, and the next date that matters. Private to the member. The partner can be shown a calm summary only if the member shares it.
2. **Benefits and deadlines**: the paperwork with a date on it, in order, each with why it matters and one button.
3. **Wellbeing**: the check-in history (private), talk to someone, your coach, and the people in your corner.
4. **Scam watch**.

Help becomes a single link for questions and feedback.

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

For every journey, wellbeing is the same promise with a different tone: a check-in the member controls, a person to talk to, and the people in their corner.

## What it needs

- **Data (new, private):** savings, severance, monthly need, income now, health coverage end date. The career story branch already collects savings, severance and monthly need for its pause what-if, so one set of numbers should serve both.
- **Already available:** last day worked drives the weeks of unemployment left; the benefits action plan; the supporters feature.
- **To build:** deadline dates from the last day (the 60 days to choose coverage, severance review window); a weekly certification reminder; quarterly tax dates for self-employed members; student loan and Medicare rule cards.
- **Rules to respect:** this is general information, not financial or legal advice, and it says so on the page. Unemployment and tax rules vary by state and country, so the first version is US only and links to the member's state. Financial data is never shown to employers, recruiters, schools or coaches, and the partner sees it only if the member shares a summary.

## Decisions for the owner

1. Name: **Money and wellbeing**, or something warmer.
2. First version: US only, laid off, building something of my own, and thinking about a move first, then the rest?
3. Should the member's coach or program (outplacement, school) ever see the runway? Recommended: no, unless the member shares it.
