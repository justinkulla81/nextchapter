# NextChapter — Report Structure & ATS Compatibility Spec

Version 0.1 — companion to the Resume Scoring Spec. Covers what the candidate sees, in what order, in what language.

---

## 1. Design principles

**Plain recruiter language. No invented vocabulary.** Section headings should read like something a recruiter would actually say. If a name has to be explained before it means anything, it's the wrong name. Use the terminology already locked in the product — Search Action Task, Search Action Plan, Weekly Search Sprint, Market Reality Grade, Search Score, Dossier, Your Network, Support Network — and add nothing new. "Hireability Score" and "Hireability Assessment" are retired.

**The score is a difficulty estimate, not a verdict on the person.** It answers "how much work will this search take," not "how good are you." Every piece of copy has to hold that line.

**Fix the resume first, regardless of score.** A candidate at any band gets the same first instruction, because the resume is fast, cheap, fully in their control, and gates everything downstream.

**Not everyone reaches an A, and the system says so.** Different bands get different realistic paths, not the same ladder with a longer climb.

**Narrative and score are rendered together or not at all.** No praise above a low grade, no criticism above a high one.

---

## 2. What the score means

### 2.1 The reframe

The Market Reality Grade is a **difficulty estimate**: how much effort, over how long, this search is likely to require.

That reframe fixes the Adrienne failure. "D — Needs work" reads as a judgment on 27 years of work. "This search will take sustained effort, and here's exactly where it goes" reads as a plan. Same number, entirely different product.

### 2.2 Difficulty has three inputs, and they must stay separate

| Input | Candidate control | Notes |
|---|---|---|
| **How the record reads** | High — days to weeks | The resume grade. Fully fixable. |
| **How many roles exist** | None | Level, function, geography. Scarcity rises with seniority. |
| **How strong the warm network is** | High — weeks to months | The dominant channel above director level. |

Never collapse these into one number without decomposition. An executive with an excellent resume can face a *harder* search than a mid-level candidate with a mediocre one, because roles at her scale are rare and rarely posted. If the report tells her the search is easy, it is wrong and she will know it.

**Display rule:** show the composite, then immediately show which of the three is driving it.

> Your search looks **moderately difficult**. Your resume is strong — that part is working. The difficulty is that roles at your level are scarce and mostly filled through relationships, and your network activity is currently at zero.

### 2.3 Effort estimate

Translate the score into a concrete commitment rather than a letter:

| Difficulty | Typical picture | Weekly commitment |
|---|---|---|
| Low | Strong record, liquid market, active network | 3–5 hrs |
| Moderate | One of the three inputs weak | 6–10 hrs |
| High | Two inputs weak, or a scarce market | 10–15 hrs |
| Very high | All three weak, or a function change | 15+ hrs, longer horizon |

Never state a probability of landing a role, and never promise a timeline.

---

## 3. Report structure

Seven sections, in this order. Headings are candidate-facing copy, not internal names.

### 3.1 "Where you stand"

The score, the difficulty read, and the three-input decomposition. Two to three sentences, no hedging.

Opens with what's working when anything is working. For a strong record with a weak file, the first sentence is about the record.

### 3.2 "What's working"

Three to five items, each citing something specific from their own document — a number, a role, a phrase. Generic praise is worse than no praise; it signals nothing was actually read.

For low-band candidates this section is short but never empty. Whitcomb has a real team of six and a real process improvement. Find the floor and name it.

### 3.3 "What to fix on your resume"

Ordered by point impact, not by section order in the document. Each item gets: what's wrong, why it costs them, the specific fix, and what it's worth.

> **Add a target line.** Your resume records what you've done but never says what you want next. Reviewers won't guess. One line under your name — role, level, industry, company size. This is the single largest gain available to you.

Show the rewrite, not just the instruction. If a bullet is weak, print their version and the fixed version side by side.

### 3.4 "How a recruiter will read this"

The reviewer-questions layer. Framed as interview preparation, never as flaws.

Each item: what a reviewer notices, why they ask, and a suggested one-line answer. Every item links to a Search Action Task where the candidate records their answer — and recording it removes the item.

> **The nine-month stint at Vantage Partners.** A reviewer will ask what happened. If it was a contract role, a layoff, or a company that ran out of runway, say so plainly in one line. Unexplained is worse than any actual reason.

### 3.5 "Getting past the filters"

The ATS section — see §4. This sits *before* the beyond-the-resume section, because it's the gate everything else passes through.

Leads with the honest fact: most resumes are rejected before a person reads them. Then shows the per-platform compatibility matrix and the specific fixes.

This section is purely mechanical. No judgment, no grade on the person. It is the easiest trust-builder in the whole report.

### 3.6 "What else moves the needle"

The levers beyond the document, ordered by impact for this candidate's band and situation:

- **References** → the Dossier. Third-party corroboration is the only thing that converts self-reported claims into verified ones.
- **Your Network** → warm introductions, the dominant channel above director level.
- **Skills** → targeted, current, function-specific. Named gaps only, never generic upskilling.
- **Interim, fractional, and contract work** → stays in market, generates current proof points, closes the gap that would otherwise need explaining.
- **Recruiter network and exclusive roles** → access to what isn't posted.
- **Coaching** → for candidates whose difficulty is concentrated in interviewing or positioning.

Ordering is computed, not fixed. A candidate with a strong network and no references gets a different order than the reverse.

### 3.7 "Your next week"

Three to five Search Action Tasks, sized to the effort estimate, feeding the Weekly Search Sprint. Concrete and completable. Not "improve your networking."

---

## 4. ATS compatibility

### 4.1 The framing

Lead with the truth: a large share of resumes are filtered before any person sees them. This is not a comment on the candidate's worth, and saying so explicitly is what makes the rest of the report land.

### 4.2 Test against parsing engines, not ATS brands

Most ATS platforms don't write their own parser — they license one. Testing against the **engines** covers far more of the market than chasing brands:

- Textkernel (formerly Sovren)
- Daxtra
- HireAbility
- Affinda
- RChilli

Plus the platforms that parse in-house and behave distinctly:

- **Workday** — strict, re-keys into structured fields, breaks badly on multi-column and tables
- **Oracle Taleo** — legacy, keyword-literal, weakest format tolerance
- **IBM BrassRing/Kenexa** — legacy, harsh
- **iCIMS** — decent, header/footer sensitive
- **SAP SuccessFactors** — form-heavy
- **Greenhouse, Lever, Ashby, Workable** — modern, most forgiving

The `ncrawl` adapter set already covers these platforms. The same platform knowledge that drives ingest should drive the compatibility matrix — this is existing infrastructure, not new work.

### 4.3 Report a matrix, not a score

A single ATS number hides the thing the candidate needs. Different parsers fail differently on the same file.

> Parses cleanly: **Greenhouse, Lever, Ashby, Workable**
> Loses your job titles: **Workday**
> Drops your dates: **Taleo**

Then the fix, and what it unlocks.

### 4.4 What to check

**Hard failures** — near-total parse loss:
- Image-only PDF with no text layer
- Experience content inside tables or text boxes
- Multi-column layout in the experience section
- Contact details in a header or footer
- Text rendered as vector outlines or embedded graphics

**Format-specific:**
- Letter-spaced or character-spaced headings — breaks tokenization. *(Present on all current test fixtures.)*
- Non-standard section names — "My Journey" instead of "Experience"
- Inconsistent date formats across entries
- Non-embedded or decorative fonts
- Special characters and ligatures that transcode badly
- Skill bars, icons, or graphics carrying meaning
- Uninformative filename

**File type:** many parsers handle .docx more reliably than .pdf, and a few still require it. The candidate should hold both, and the report should say which to use where.

### 4.5 Validation method

Round-trip every fixture: submit, extract, compare against ground truth. Score field-level recovery — name, email, phone, each employer, each title, each date range, each bullet.

**Reported as recovery rate**, which is concrete and non-judgmental: "Workday recovers 6 of your 9 job titles."

---

## 5. Not everyone reaches an A

### 5.1 The principle

Some candidates cannot reach an A on their record, and the system must not pretend otherwise or imply failure. A late-career candidate with a genuinely fragmented history, a career changer with no direct experience, someone returning after a long absence — the honest answer is that their search will be harder and their path different.

Pretending otherwise produces a plan that doesn't work, and candidates notice.

### 5.2 Different bands get different paths, not the same ladder

| Band | Realistic primary path |
|---|---|
| A / A− | Warm channels, search firms, selectivity. Speed matters more than volume. |
| B | Fix presentation, add references, apply with intent. The standard path works. |
| C | Presentation fixes plus positioning. Consider adjacent functions and less competitive markets. Interim work to generate current proof. |
| D | Interim, contract, and fractional first — this generates the evidence the resume lacks. Reframe around a narrower, more attainable target. Skills with a named gap. |
| F | Rebuild before searching. Often a function or level reset. Coaching is the highest-value lever, not applications. |

A D candidate told to "network harder toward the same target" will fail. A D candidate told "take a six-month contract role, it fills your gap and gives you three quantified bullets" has a path that actually works.

### 5.3 Language rules

- Score movement is celebrated over score level. "You moved from D to C+ in three weeks" beats any absolute grade.
- Never promise an outcome, a timeline, or a probability.
- Never imply the candidate's career, employer, or education was insufficient.
- Never use "unfortunately," "sadly," or consolation framing. State the situation and the path.
- Difficulty is about the market and the file, never about the person.

---

## 6. Narrative alignment

1. Grade and prose render from one object in one pass. They cannot drift.
2. Every sentence traces to a dimension result.
3. Praise and criticism must be able to coexist — but each must be attached to the thing it describes. "Your record is strong; your file is incomplete" is coherent. "Genuinely excellent" above a D is not.
4. The headline is one sentence naming the two or three actual drivers.
5. Weaknesses always pair with the fix and its expected gain.
6. Prestige never appears in any phrasing.
7. Every generated number is self-checked before render. The prior report said 28 years where the resume said 27, cited five alumni networks where two schools exist, and used a location that didn't match the candidate. Any of these, caught by a candidate, costs more trust than the whole report earns.

---

## 7. Things we don't say

- Anything that ranks employers or schools to the candidate
- Any predicted probability of being hired
- Any implication that a gap, a short tenure, or a career break is a character issue
- Any consolation framing
- Any category name that has to be explained before it means something
