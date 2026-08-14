# NextChapter — Onboarding Flow, Questions & Report Narrative

Version 0.1 — the end-to-end candidate experience from upload to first Weekly Search Sprint, with production-intent copy.

---

## 1. Flow overview

| Step | Screen | Time |
|---|---|---|
| 0 | Upload resume | 10s |
| 1 | Confirm what we read | 20s |
| 2 | Where you can work | 15s |
| 3 | Where you are in the search | 15s |
| 4 | How you feel about reaching out | 10s |
| 5 | **Score reveal** | — |
| 6 | Report (7 sections) | — |
| 7 | Tier 2 asks, inline in the report | as chosen |
| 8 | First Weekly Search Sprint | — |

Four question screens. Roughly 60 seconds. Everything possible is pre-filled from the resume.

---

## 2. Step 0 — Upload

> **Start with your resume.**
> We'll read it the way a recruiter and an applicant tracking system each would, and show you both. Takes about a minute.

No account-creation friction before this. The resume is the thing they came with.

---

## 3. Step 1 — Confirm what we read

The trust event. Prove the document was read, and collect the single most important input at the same time.

> **Here's what we picked up. Fix anything we got wrong.**

| Field | Pre-filled from | Control |
|---|---|---|
| Most recent role | Resume | Editable text |
| Level | Inferred from scope and title | Dropdown |
| Industries | Resume | Chips, removable |
| Function | Inferred | Dropdown |
| **What you're targeting next** | Proposed from the career arc | Editable text |

> **Targeting next:** President or EVP, enterprise software
> *We guessed this from your last three roles. Change it if you're aiming somewhere else — this is the single biggest input to everything that follows.*

**Design note.** Getting the guess wrong is acceptable and sometimes better; correcting it is engagement. What's not acceptable is a blank field, which converts far worse and signals the resume wasn't read.

---

## 4. Step 2 — Where you can work

> **Where are you open to working?**

- Based in: **San Francisco Bay Area** *(from your resume — change if wrong)*
- Open to relocating? **Yes / No / For the right role**
- Open to remote? **Remote only / Hybrid / On-site is fine / Any**
- If commuting, how far? **Up to 30 / 45 / 60 / 90 minutes**

> Market volume depends heavily on this. We'll show you what each answer changes.

---

## 5. Step 3 — Where you are in the search

Three taps, no typing. The highest-information screen in the flow.

> **Where are you in this so far?** No wrong answers — this tells us where to focus.

**How long have you been looking?**
Just started · Under 3 months · 3–6 months · 6–12 months · Over a year

**Roughly how many applications have you sent?**
None yet · Under 20 · 20–100 · Over 100

**Any interviews?**
None yet · A few · Several · I'm in late stages somewhere

**Why this matters.** These three locate the actual failure point:

| Pattern | Diagnosis |
|---|---|
| 100+ applications, no interviews | The document or the ATS is filtering them out |
| Applications and interviews, no offers | An interview or positioning problem, not a resume problem |
| Long search, few applications | Activity, not quality |
| All zeros | Nothing is broken. This is a starting line. |

For a candidate who separated this week, all three are zero and the report skips past them entirely.

---

## 6. Step 4 — How you feel about reaching out

> **Last one. How do you feel about reaching out to people about your search?**
>
> Very comfortable · Somewhat comfortable · Not very comfortable · I'd rather not
>
> *Most people pick one of the last two. We ask now because it changes what we hand you, not because there's a right answer.*

Asked before any grade lands. That framing is deliberate — it makes this a conversation about them rather than an audit of behavior they already feel bad about.

---

## 7. Step 5 — Score reveal

Two numbers, always, with the decomposition immediately visible.

### 7.1 Strong resume, hard market

> **Your resume grades A. Your search looks moderately difficult.**
> Those aren't in conflict — they're measuring different things.
>
> **Your resume: A.** It's in the top few percent of what we see. Almost nothing to fix.
> **Your search: Moderate difficulty.** Roles at President scale are scarce and mostly filled before they're posted, and your network is currently at zero activity.
>
> Difficulty here is about the market and your channels, not about you.

### 7.2 Weak resume, liquid market

> **Your resume grades D. Your search looks difficult.**
>
> Most of what's driving that is in the document itself — which means it's fixable, and fast.
>
> You've sent over 100 applications and had no interviews. That pattern almost always means the resume is being filtered before a person reads it. There are plenty of roles at your level; the problem is that they aren't seeing you.

### 7.3 What the score is

Shown once, on first reveal, dismissible:

> **What this grade means.** It's an estimate of how much work this search will take — not a judgment of your career. It moves on three things: how your record reads, how many roles exist at your level and location, and how strong your warm channels are. Only the first is about your resume.

---

## 8. Step 6 — Report

Seven sections. Below, the same structure written at both ends of the range.

---

### 8A — Worked example: strong candidate

**Where you stand**

> Your resume grades **A**. Your search looks **moderately difficult** — 6 to 10 hours a week is a realistic commitment.
>
> Your record is not the constraint. Twenty-seven years across five enterprise software companies, promoted at every stop, with numbers behind nearly every claim. The difficulty is structural: President-scale P&Ls are rare, and most are filled through board and search-firm channels before a posting exists. You have two board seats and an alumni network you haven't used yet.

**What's working**

> **Your numbers are real and specific.** Moving a business from $3.9B to $5.4B while expanding margin 640 basis points is proof, not positioning. Most resumes we read describe responsibilities. Yours describes outcomes.
>
> **Twenty-seven years with no gaps and a promotion at every stop.** A reviewer reads that as stability plus earned trust, and it's the hardest thing on a resume to fake.
>
> **One industry, deeply.** Enterprise software throughout means you know the buying cycle, the comp plans, and the board expectations. That coherence does real work.
>
> **Two board seats.** You're already in rooms where roles at your level get discussed.

**What to fix on your resume**

> **Add a target line — the largest single gain available to you.** Your resume is a complete record of what you've done and never says what you want next. One line under your name: role, level, industry, company size.
>
> *Add:* "Enterprise software P&L leader targeting President or CRO roles at $1B+ software companies, PE-backed or public."
>
> **Fix the section headers.** They're letter-spaced, which looks good and breaks how parsers read text. Standard spacing, same visual weight.
>
> **The email on your resume doesn't match your name.** Worth a look — if it's intentional, ignore this.

**How a recruiter will read this**

> **Three board seats alongside a full-time role.** A reviewer may read this as a move toward a portfolio career. One line fixes it: say you're prioritizing a full-time operating role and how the seats fit around it.
>
> **Comp and level.** At your scale, employers below it worry you'll leave when something bigger appears. If you'd consider a smaller P&L, say why — in your words, once, early.
>
> **No visible AI fluency.** Revenue leadership is being rebuilt around it right now and there's no signal anywhere in your file.

**Getting past the filters**

> Most resumes are rejected before a person reads them. Yours is close to clean, with one real issue.
>
> Parses cleanly: **Greenhouse, Lever, Ashby, Workable**
> Loses your section structure: **Workday, Taleo**
>
> That's the letter-spaced headers. Fix them and you're clean across all of them. Keep both a .docx and a .pdf — some systems handle one much better.

**What else moves the needle**

> **References — the biggest lever you have.** Nothing outside your own document currently confirms a $5.4B P&L or a 4,000-person org. At your level, the absence of corroboration is louder than it would be for a mid-level candidate. Two to start: someone who can speak to scope, someone who can speak to follow-through.
>
> **Your board seats and alumni network.** You said reaching out isn't your favorite thing. Fair — most people say that. Start with the three people you'd be least uncomfortable calling. You're not asking for a job; you're asking what they're seeing.
>
> **Recruiter access.** Roles at your scale mostly move through search firms. Worth knowing: recruiters work for the employer, not for you. That's not cynicism, it's just the arrangement, and it changes how you engage.

**Your next week**

> 1. Write your target line and add it to your resume — 20 minutes
> 2. Fix the section header spacing — 5 minutes
> 3. Request two references
> 4. Message three board or alumni contacts (script ready)
> 5. Add one line addressing the board commitments

---

### 8B — Worked example: struggling candidate

Same structure, same register. No consolation framing, no manufactured praise.

**Where you stand**

> Your resume grades **D**. Your search looks **difficult** — 10 to 15 hours a week, and probably a longer horizon than you'd like.
>
> Here's the specific thing: you've sent over 100 applications and had no interviews. That pattern is almost never about your background. It means the document is getting filtered before anyone reads it, and the applications are going into a channel that isn't returning anything.
>
> There is no shortage of operations roles at your level. The problem is what happens to your resume before a person sees it.

**What's working**

> **You managed a team of six and cut order processing time.** That's a real result with a real team behind it. It's currently one line on page one of two, and it should be the first thing anyone reads.
>
> **You've stayed in market.** The consulting work since January means you're not explaining a cold gap.
>
> **You've been persistent.** A hundred applications is real effort. It's been pointed at the lowest-yield channel, but the effort isn't in question.

**What to fix on your resume**

> **Put numbers on your work.** Almost every bullet describes a duty rather than a result. This is the single biggest change available to you.
>
> *You wrote:* "Responsible for day-to-day operational support across multiple departments."
> *Try:* "Supported operations for 4 departments and 60+ staff, cutting monthly close from 12 days to 8."
>
> Use your real numbers. If you don't remember them, estimate conservatively and say "approximately."
>
> **Replace the objective with a target line.** "Seeking a challenging position with a growth-oriented organization" tells a reader nothing. Say what you want: "Operations manager roles at mid-sized companies in the Hartford area."
>
> **Your consulting entry needs substance.** Two vague lines reads as a placeholder. Name two or three engagements and what changed.
>
> **Fix the arithmetic.** Your summary says over 15 years; your dates show 12. A reviewer who notices stops trusting the rest.
>
> **Small things:** "managment" and "Recieved" are misspelled. Drop "MBA" after your name — convention reserves that for licensed credentials. Add the school to your MBA. Cut "References available upon request."

**How a recruiter will read this**

> **The recent sequence of moves.** Seven months, then nine, then fourteen. A reviewer will ask. If those were contract roles, layoffs, or companies that ran out of runway, say so in one line — unexplained is worse than any actual reason.
>
> **March to December 2025.** Ten months with nothing listed. One line, plainly stated.
>
> **The consulting work.** Reviewers read a thin consulting entry as a gap with a label. Specifics fix it.

**Getting past the filters**

> This is where your 100 applications went.
>
> Loses your job titles: **Workday**
> Drops your dates: **Taleo**
> Parses cleanly: **Greenhouse, Lever, Ashby**
>
> Fixing the headers and date formats is under an hour and changes what happens to every future application.

**What else moves the needle**

> **Stop applying for two weeks.** Applications are your lowest-yield channel and you've proven it — 100 sent, zero back. Fix the document first. The same effort will convert very differently.
>
> **Contract and interim work.** A six-month operations contract does two things at once: it pays, and it produces the quantified results your resume is missing. For where you are right now, this is probably the highest-value move on the list.
>
> **You said you'd rather not reach out.** That's the most common answer we get. Which of these is closest — you don't want to seem desperate, you're not sure what to say, or you don't think your network is strong enough? The fix is different for each, and we'll hand you the version that fits.
>
> **References.** Three former colleagues who can speak to your work. Given the recent short stints, this matters more for you than for most.

**Your next week**

> 1. Rewrite five bullets with real numbers (we'll show you which five)
> 2. Replace the objective with a target line
> 3. Fix the two typos and the date arithmetic
> 4. Add specifics to the consulting entry
> 5. Answer the one networking question above

---

## 9. Step 7 — Tier 2, inline

Surfaced within the report, at the point of relevance. Never a second form.

| Ask | Where it appears |
|---|---|
| Compensation floor | Beside market volume |
| Target industries and company size | Beside job matching |
| The real hesitation behind networking | Inside "What else moves the needle" |
| Public visibility willingness | At the Marketing Plan |
| Work authorization / sponsorship | At job matching, phrased as employers phrase it |
| Non-compete | At job matching, when specific employers appear |
| Can your most recent manager be a reference? | At reference setup |
| Direction — same path or different | Beside target |
| Weekly outreach target | At the Sprint |

**Not collected:** criminal history or background-check status. If a candidate raises it, the coach helps with disclosure strategy — candidate-initiated, never a structured field, never scored, never in the Dossier.

---

## 10. Step 8 — First Sprint

Tasks carry straight from "Your next week." Sized to the difficulty estimate — 3 to 5 tasks at low difficulty, 5 to 7 at high.

---

## 11. Copy rules applied throughout

- Praise is specific or absent. Never generic, never a cushion for bad news.
- Grade and prose render together. No "excellent" above a D.
- Hedged to what the system can observe: *resumes with this pattern usually…*, not *you will…*
- Every constraint named comes with a path that respects it.
- Every weakness comes with a fix and what it's worth.
- No consolation framing. No "unfortunately," no "I know this is hard."
- Prestige never appears in any phrasing.
- Every generated number is checked against the source document before render.

---

## 12. Data boundaries

- Blockers, motivations, emotional state, and networking hesitation stay private to the coach. Never structured into the Dossier.
- Work authorization and non-compete inform matching only.
- Manager-reference availability informs coaching and reference strategy only.
- Distress signals route to Support During Transition on the existing boundary: offered, candidate-initiated, no automated detection.
- Profile completeness is shown in its own visual language, never blended into the grade.
