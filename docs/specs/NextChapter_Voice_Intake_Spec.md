# NextChapter — Voice, Intake & Market Adjustment Spec

Version 0.1 — companion to the Resume Scoring and Report Structure specs. Covers how the product talks, what it asks, and how the score moves with the market.

---

## 1. Intake: what we ask, when

### 1.1 The decision

**Three questions, pre-filled and confirmed, gated before the first score.** Everything else is progressive.

The Adrienne report is the argument. It graded a 27-year executive with no stated target, then capped Target Fit *because* the target was blank — producing a number that was both wrong and insulting. Scoring on absent inputs is worse than asking for them.

### 1.2 The three

| Question | Pre-fill source | Why it must be upfront |
|---|---|---|
| **What are you targeting?** Role, level, industry, company size | Inferred from the career arc; candidate confirms or edits | Target Fit, relevance decay, and job matching are all uncomputable without it |
| **Where, and how mobile are you?** Location, relocation, remote | Location parsed from resume; mobility asked | Market volume is meaningless without a geography |
| **What's your timeline?** Urgent / months / exploring | Asked | Sets the intensity of the whole plan |

Compensation floor, industry exclusions, visa status, seniority flexibility, and non-negotiables come progressively, asked at the moment they'd change an answer.

### 1.3 Confirm, don't compose

Never show a blank field where a guess is possible. "Looks like you're targeting President or EVP roles in enterprise software, Bay Area — right?" converts far better than an empty box, and it demonstrates the resume was actually read, which is itself a trust event.

Getting the guess wrong is fine and sometimes better — correcting it is engagement.

### 1.4 Cost and mitigation

Every question costs completion. Mitigations: pre-fill everything possible, cap at three, show a progress indicator, and state what each question unlocks. Target 60 seconds.

If drop-off is material, the fallback is to show a **provisional resume grade only** — not the difficulty score — with the three questions as the unlock. The resume grade is computable without them; the difficulty estimate is not.

---

## 2. Attribution: constraints, not verdicts

### 2.1 Why this matters

The same score reads completely differently depending on whether the candidate's constraints are visible in the explanation.

> Without: *Your search difficulty is High.*
> With: *You've told us Hartford only, no relocation, and VP level or above. That combination is the single biggest driver here — there are roughly 40 such roles in your metro in a year.*

The second is more accurate, more actionable, and shifts the frame from *the machine judged me* to *these are my tradeoffs*. Agency returns to the candidate.

### 2.2 The rule that keeps it from becoming blame

**Every constraint named must be paired with what relaxing it would buy — and never with an implication that the constraint is wrong.**

Constraints are usually real. Caregiving, a spouse's job, health, custody, an aging parent, a mortgage. The system does not know which are negotiable and must not assume any are.

> **Do:** "Opening to hybrid within 90 minutes would roughly triple the roles in range. If that's not possible, the path is warm introductions — which is slower but works at your level."
> **Don't:** "Your unwillingness to relocate is limiting your options."

Always offer the path that respects the constraint, not only the path that removes it.

---

## 3. Market adjustment

### 3.1 Separate what moves from what doesn't

| Score | Moves when | Recompute |
|---|---|---|
| **Resume grade** | The candidate changes the document | On upload only |
| **Difficulty estimate** | The market, their constraints, or their network changes | Weekly, smoothed |

Keeping these separate is what makes market movement communicable. If a single blended number drops, the candidate assumes they did something wrong.

### 3.2 Driving it from real data

`ncrawl` already produces posting volume by function, level, and geography over time. That's the input: current volume against a trailing baseline for the same target profile. A thinning market genuinely does make a search harder, and reflecting it is honest.

### 3.3 Communicating movement

Always name the cause, always separate it from the candidate:

> Your difficulty moved from Moderate to High this month. **Your file didn't change** — postings for VP Operations roles in your metro are down about 20% from the spring. Your resume grade is unchanged at B+.

Rules: recompute weekly at most, smooth across several weeks, and show market conditions as a range rather than a point estimate. A score that twitches reads as a stock ticker and destroys confidence.

### 3.4 The honest asymmetry

A tightening market lowers the score through no fault of the candidate. Say that plainly, and shift the plan rather than the blame — thinner visible markets raise the value of warm channels, which is a real strategic response rather than a consolation.

---

## 4. Voice

### 4.1 Epistemic position

The system is a pattern-matcher reading one document. It has not met the candidate, cannot see their references, and does not know their market personally. Copy should reflect that without becoming mush.

| Not this | This |
|---|---|
| "You will struggle to get interviews." | "Resumes with this pattern usually draw questions before they draw interviews." |
| "Your leadership is unproven." | "I can't see outside corroboration of the org scope you describe. That's a gap in the file, not in your record." |
| "This is a weak resume." | "As written, this document is doing less for you than your record could." |
| "You need to network more." | "At your level most roles are filled through relationships. Right now that channel is at zero for you." |

Attribute to recruiter behavior and observable patterns, not to the system's own authority. Invite correction: *if I've read this wrong, tell me* — which is both honest and a data source.

If a named coach persona is used, calibrate its voice to this same standard. A human-sounding name raises perceived authority, which raises the cost of overclaiming.

### 4.2 Praise

Be complimentary where it's earned, specific always, and never as a cushion.

- **Specific beats general.** "Moving a business from $3.9B to $5.4B while expanding margin 640 basis points" beats "an impressive career." The first proves the document was read.
- **Never praise what isn't there.** Manufactured warmth is detected instantly and costs everything.
- **Never pair praise and criticism in one breath to soften the blow.** "Your record is genuinely excellent" sitting above a **D** is the exact failure to avoid. Attach each to the thing it describes: *your record is strong; your file is incomplete.*
- **Low-band candidates still get a real strength.** Find the floor and name it. Whitcomb managed a team of six and cut processing time — that's real, and it's where his rebuild starts.

### 4.3 Register

Direct, warm, unsentimental. No consolation framing — no "unfortunately," no "sadly," no "I know this is hard." State the situation and the path. Candidates who were fired this morning do not need sympathy from software; they need a plan that respects their intelligence.

---

## 5. Making the case for networking

### 5.1 Why the current framing fails

"Networking is at F" is a grade on something the candidate already dislikes and probably feels bad about. It produces guilt, not action.

### 5.2 Reframe

Drop the word where possible. Most people hear *networking* and picture schmoozing strangers. The actual ask is **telling people who already know you that you're looking**, which is a much smaller emotional barrier.

### 5.3 Make the case with the comparison, not the exhortation

> Most roles at your level never get posted. They're filled through someone who already knows the work. Applications aren't useless — they're just the lower-yield half of the search, and right now they're the only half you're running.

### 5.4 Point at their own assets, by name

Generic instructions produce nothing. Specific ones produce a first message:

> You have two board seats and a Kellogg alumni network. Your board colleagues sit in the rooms where roles at your level get discussed before they're posted. Start with the three people you'd be least uncomfortable calling.

### 5.5 Make the first ask trivially small

One message, script provided, to a person the system names. The goal of week one is a single sent message, not a pipeline.

---

## 6. Being honest about recruiters

Most candidates misunderstand the relationship, and correcting it builds more trust than any feature claim.

> Recruiters work for the employer, not for you. That's not cynicism — it's just the arrangement, and knowing it changes how you engage. A recruiter is a channel to a specific role, not an advocate for your career.

Then state plainly what NextChapter's recruiter access actually provides, and don't overstate it. Access to unposted roles is valuable and rare; claiming advocacy that doesn't exist would break the same trust this section is meant to build.

---

## 7. Copy checklist

Before any generated report ships:

- Does every sentence trace to a scored dimension?
- Does any praise sit above a contradicting grade?
- Is every claim hedged to what the system can actually observe?
- Is every named constraint paired with a path that respects it?
- Is every weakness paired with a fix and its expected gain?
- Does any number in the prose disagree with the source document?
- Would a candidate who was fired this morning read this and know what to do tomorrow?
