# NextChapter — Resume Scoring & First Glance Spec

Version 0.1 — design specification for the resume evaluation layer.

---

## 1. Design principles

**Separate what's fixed from what's fixable.** A candidate cannot change where they worked. They can change how it reads. The product's value is almost entirely in the second category, so that's what gets the prominent, actionable grade.

**Never average a fixable thing and an unfixable thing into one letter.** This is what produced a "D" on a resume the same report called excellent. Two grades, reported separately, each explainable in one sentence.

**Explanation neutralizes.** Gaps, short tenures, and scope changes are detected, but a candidate who explains one scores the same as a candidate who never had one. Detection generates an action, not a permanent deduction.

**Prestige only skews up.** Recognized employers and institutions add points. Unrecognized ones add zero. Nothing is ever deducted for where someone worked or studied, and prestige is never narrated to the candidate in any form.

**Prose is generated from scores, never alongside them.** Every narrative sentence must trace to a dimension result. If a dimension is low, the prose for that dimension says why, in the same register as the score.

**The resume grade is never gated on profile completeness.** Missing references and targets are reported as a separate completeness state, not as a low resume score.

---

## 2. Architecture

Three outputs, reported separately, never averaged together.

### 2.1 Resume Grade
The careful read. What a recruiter concludes after actually reading the document for two to three minutes. Weighted composite of the dimension catalog in §4.

### 2.2 First Glance Recruiter Pass
Simulates the six-to-thirty-second screen. Different inputs and different weights from the Resume Grade — deliberately so. A resume can be excellent on careful read and fail First Glance by burying the lede, and that divergence is one of the most useful things this system can tell a candidate.

Reported as **Pass / Borderline / Likely Skip**, plus the single highest-leverage fix.

### 2.3 Profile Completeness
Not a grade. A state: which of the complementing inputs exist (references, stated target, gap explanations, networking activity, skills currency). Displayed as progress, framed as "here's what would make the resume grade mean more," never as a deficiency.

### 2.4 Reporting rule

The headline must be readable as one sentence:

> Your resume grades **B+**. A recruiter's first pass: **Borderline** — your strongest number is on page two. Your profile is **2 of 6 complete**.

---

## 3. Scoring mechanics

### 3.1 Scale
Each dimension scores 0–100. Weighted sum produces a 0–100 composite, banded to a letter.

| Band | Range | Label |
|---|---|---|
| A | 90–100 | Exceptional |
| A− | 85–89 | Strong |
| B+ | 80–84 | Good |
| B | 74–79 | Solid |
| B− | 68–73 | Adequate |
| C+ | 62–67 | Mixed |
| C | 55–61 | Needs work |
| D | 40–54 | Significant gaps |
| F | 0–39 | Not competitive as written |

### 3.2 Additive-only prestige
Prestige contributes a bonus of **0 to +6** on the Resume Grade and **0 to +10** on First Glance. It is never negative and never displayed. Cap it so it cannot move a candidate more than one band on its own.

### 3.3 Penalty-only dimensions
Reconciliation & Integrity (§4.11) scores **−12 to 0**. Clean documents get zero, not a bonus. Defects subtract and generate a required fix.

### 3.4 Weights — Resume Grade

Weights shift by seniority band (§5). Executive band shown as the reference:

| Dimension | Weight |
|---|---|
| Evidence Quality | 20 |
| Narrative & Positioning | 15 |
| ATS Legibility & File Hygiene | 15 |
| Scope & Level | 12 |
| Trajectory | 10 |
| Mechanics & Presentation | 10 |
| Tenure Pattern | 8 |
| Relevance & Recency | 5 |
| Skill & Vocabulary Currency | 3 |
| Contactability | 2 |
| **Subtotal** | **100** |
| Prestige bonus | 0 to +6 |
| Reconciliation penalty | −12 to 0 |

### 3.5 Weights — First Glance

Deliberately different. This measures what's visible without reading.

| Signal | Weight |
|---|---|
| Top-of-document clarity (name, current title, positioning line, target) | 25 |
| Most recent role legible — title, company, dates, scope, all in one glance | 20 |
| Trajectory apparent without reconstruction | 15 |
| Visual scanability (whitespace, hierarchy, bullet density, page-one payload) | 15 |
| Unexplained gap or short-tenure cluster visible on page one | 15 (penalty-driven) |
| Employer recognition | 10 |

---

## 4. Dimension catalog

Each dimension specifies what it measures, how to detect it, and the candidate-facing language register.

### 4.1 Evidence Quality — 20
**Measures:** whether claims are substantiated and falsifiable.

Score on three sub-signals:
- **Outcome vs activity.** Revenue moved, retention lifted, margin expanded, cost reduced → high. Meetings held, decks produced, "supported," "assisted with" → low.
- **Baselines present.** "Grew revenue 40%" scores below "grew revenue from $3.9B to $5.4B." From/to pairs are the strongest form.
- **Density.** Proportion of bullets carrying at least one verifiable number, weighted toward recent roles.

**Function-adjusted** — see §6. An engineer with no revenue numbers is not deficient.

**Candidate-facing:** specific and complimentary when strong. When weak, quote one of their own bullets and show the rewritten version.

### 4.2 Narrative & Positioning — 15
**Measures:** does the document argue for a next role, or only record past ones.

Sub-signals: presence of a summary; whether the summary is forward-looking or retrospective; whether a target is stated or clearly inferable; whether the sequence of roles reads as a coherent thesis; whether the positioning connects the record to the target.

This is the highest-leverage fixable dimension and usually the one carrying the most upside. Weight accordingly.

### 4.3 ATS Legibility & File Hygiene — 15
**Measures:** will an automated parser extract this correctly.

Hard failures (score ≤ 25):
- Image-only PDF with no text layer
- Content inside tables, text boxes, or headers/footers
- Multi-column layout in the experience section

Soft failures (graduated):
- Letter-spaced or character-spaced headings (breaks tokenization)
- Non-standard or non-embedded fonts
- Graphics, icons, or skill bars carrying meaning
- Date formats inconsistent across entries
- Section headers using non-standard names ("My Journey" instead of "Experience")
- Filename uninformative or containing "final_v3"

**Candidate-facing:** purely mechanical, zero judgment. This is the most valuable and least insulting dimension in the system.

### 4.4 Scope & Level — 12
**Measures:** magnitude of responsibility, from stated numbers rather than titles.

Extract: P&L or budget owned, headcount, quota, geography, reporting line, span of function. Score against seniority-band norms.

**Critical:** score scope from numbers, not from title strings. Title lookup tables break — titles are not standardized across companies, and a VP at a 40-person startup is not a VP at IBM. Where a stated title and stated scope disagree, trust the numbers and flag the mismatch under §7 (title inflation).

### 4.5 Trajectory — 10
**Measures:** does responsibility increase over time.

Compare consecutive roles on scope magnitude, not title rank. Reward monotonic increase, promotion within a company, and increasing span. Treat a lateral move as neutral, not negative.

**Known defect to avoid:** the current system reports EVP & GM ($3.2B) → President ($5.4B) as a step down. That is a title-rank comparison overriding a scope comparison. Scope wins.

An apparent decrease is a §7 detection, not a deduction.

### 4.6 Tenure Pattern — 8
**Measures:** stability, industry-relative.

Compute median tenure, most recent completed tenure, current tenure, count of stints under 18 months, and whether short stints cluster early (normal, low signal) or in the last 5 years (higher signal).

**Industry-relative.** Two years is unremarkable in tech and alarming in law. Never score against a global constant.

Explained short tenures — contract, acquisition, layoff, company failure, all captured via Profile follow-up — neutralize entirely.

### 4.7 Relevance & Recency — 5
**Measures:** how much of the record is in the target function and how recent it is.

Apply a decay curve. Experience within 3 years counts full; 3–8 years partial; beyond 10 years minimal unless it's foundational credentialing. Requires a stated target to compute meaningfully; without one, score the coherence of the record instead and note the limitation.

### 4.8 Mechanics & Presentation — 10
**Measures:** care taken with the document.

- Typos and grammatical errors (weight recent and top-of-document errors higher)
- Tense consistency (present for current role, past for prior)
- Punctuation and capitalization consistency across bullets
- Bullet length distribution — flag walls of text and one-word fragments
- Page count appropriate to seniority band (§5)
- Verb quality — led/owned/built/shipped vs. "responsible for," "helped with," "involved in"
- Orphaned or empty sections
- Postnominal credentials after the name — acceptable for MD, PhD, JD, CPA, PE, CFA, RN and comparable licensure; flag MBA and non-licensure certifications as a minor convention miss
- US-convention violations: photo, date of birth, marital status, nationality. Flag gently and explain — this is common and entirely correctable for internationally-trained candidates, and framing matters.

### 4.9 Skill & Vocabulary Currency — 3
**Measures:** is the tooling and vocabulary current for the function.

Maintain per-function currency lists with recency windows. Detect both presence of current terminology and presence of stale terminology that dates the candidate. Generalize the AI-fluency check here rather than hardcoding it — every function has a currency frontier, and it moves.

### 4.10 Contactability — 2
**Measures:** can a recruiter reach them, and does the contact block look consistent.

Email present, phone present, LinkedIn present, location present. Flag name/email mismatch — but **tune the false-positive threshold carefully**: shared household inboxes, maiden and married names, anglicized first names, and nicknames all produce legitimate mismatches. Flag as a question, never as an error.

### 4.11 Reconciliation & Integrity — penalty only, −12 to 0
**Measures:** does the document agree with itself.

- Do role dates sum to the stated years of experience
- Do dates overlap in ways implying concurrent full-time roles
- Do stated tenures match the date ranges
- Are there credential claims without a granting institution
- Do scope numbers contradict each other across sections
- Does the summary's claimed experience match the timeline

**This applies to our own output too.** The current report states 28 years where the resume states 27. If our arithmetic is wrong, candidates will catch it and stop trusting everything else. Add a self-check on every generated figure before render.

### 4.12 Extracurricular & Outside Leadership — bonus, 0 to +3
Board seats, industry association leadership, meaningful volunteer leadership, published work, speaking, teaching.

Additive only. Requires detectable specificity — a named organization and a named role. Generic "volunteer" entries score zero rather than negative.

**Resolve the double-count:** board seats currently register as both a strength (credibility, distribution) and a weakness (portfolio-career flight risk). Pick one primary treatment. Recommendation: score as a strength here, and handle the flight-risk read as a §7 reviewer question with a suggested framing line. Never let one input push the composite in both directions.

### 4.13 Prestige — bonus, 0 to +6 (Resume) / 0 to +10 (First Glance)

**Employer recognition.** Tiered list of globally recognized employers, plus a scale-and-establishment proxy for companies not on the list (headcount, revenue, public/PE-backed status, years in operation). A recognized name scores the bonus; an unrecognized one scores zero.

**Institution recognition.** Same structure for universities and graduate programs.

**Rules, non-negotiable:**
- Never negative
- Never displayed as a line item, a subscore, or a narrative sentence
- Never referenced in candidate-facing prose in any form, including implicit phrasing like "at a well-known company"
- Logged separately in the score record so disparate impact can be audited later
- Never used to gate access, eligibility, or matching — only to lift a score already earned elsewhere
- Decays with recency: a 25-year-old degree contributes less than a recent one

**Rationale for the asymmetry:** first-glance recognition is a real market effect, and modeling it makes the First Glance simulation honest. But a bonus to some is mathematically a relative penalty to others, so the cap, the audit log, and the narrative silence are what keep it defensible. Revisit the magnitude once real distributions exist.

---

## 5. Seniority band modifiers

Bands set by stated level and scope first, years second.

| Band | Marker | Page norm | Weight shifts |
|---|---|---|---|
| Early | 0–5 yrs, IC | 1 page | Education ↑, Extracurricular ↑, Scope ↓, Trajectory ↓ |
| Mid | 6–12 yrs, senior IC / manager | 1–2 pages | Evidence ↑, Currency ↑ |
| Senior | 13–20 yrs, director / senior manager | 2 pages | Scope ↑, Trajectory ↑, Education ↓ |
| Executive | 20+ yrs, VP and above | 2–3 pages | Scope ↑↑, Narrative ↑↑, Education ↓↓, Extracurricular ↑ |

A two-page resume is correct for an executive and wrong for a 26-year-old. Without band-relative rubrics, one end of the distribution is systematically mis-graded.

---

## 6. Function family modifiers

Evidence norms differ by function. Penalizing an engineer for lacking revenue numbers is a bug.

| Family | Expected evidence | Do not expect |
|---|---|---|
| Revenue (sales, CS, BD) | Quota, attainment %, book size, growth rate, retention | Technical artifacts |
| Marketing | Pipeline contribution, CAC, conversion, reach | Direct revenue ownership below senior levels |
| Engineering / Technical | Systems, scale, latency, uptime, shipped products, team size | Revenue, quota |
| Product | Adoption, retention, launch outcomes, roadmap ownership | Quota |
| Finance / Accounting | Budget size, close cycle, audit outcomes, savings | Quota |
| Operations / Supply Chain | Throughput, cost per unit, SLA, headcount | Revenue |
| People / HR | Headcount supported, time-to-fill, retention, program reach | Revenue |
| Legal / Compliance | Matter volume, risk outcomes, regulatory results | Revenue metrics |
| Clinical / Healthcare | Patient volume, outcomes, credentials, licensure | Revenue |
| General Management | P&L, headcount, multi-function span | — |

Detect family from titles and content, not from a self-declared field. Where ambiguous, score against the more permissive norm.

---

## 7. "What a reviewer will ask about"

Not a red-flags section. Same detections, opposite register — framed as interview preparation.

Each detection produces: what was detected, why a reviewer asks, a suggested one-line response, and a **Profile follow-up task** where the candidate records their explanation. Recording an explanation neutralizes the item's effect on First Glance and removes it from the detection list.

| Detection | Trigger | Profile follow-up |
|---|---|---|
| Unexplained recent gap | ≥4 months, ending within 5 years | "Add a one-line reason for the Mar 2024 – Jan 2025 gap" |
| Unexplained current gap | Not currently employed, no end-date explanation | "Add your current status and what you're targeting" |
| Short tenure at most recent role | Current or last role under 18 months | "Explain the short tenure at [Company]" |
| Recent short-tenure cluster | ≥2 stints under 18 months in last 5 years | "Explain the recent sequence of moves" |
| Apparent scope decrease | Scope numbers decline between consecutive roles | "Add context for the move from [A] to [B]" |
| Thin recent entry | Most recent role has materially fewer bullets, no numbers, no named clients — the classic under-described consulting or advisory entry that reads as a gap in disguise | "Add 2–3 specific engagements with outcomes" |
| Extended tenure without title change | >6 years in one title | "Note scope growth within the role, or why you stayed" |
| Title inflation | Stated title outranks stated scope by a wide margin | "Add scope numbers that support the title" |
| Overlapping full-time roles | Date ranges overlap | "Clarify which was full-time" |
| Credential without institution | Degree or certification with no granting body | "Add the granting institution" |
| Portfolio-career read | ≥3 concurrent board or advisory roles | "State that you're seeking a full-time operating role" |
| Comp-fit / flight-risk read | Executive band targeting below prior scope | "Add a line on why this level and this next chapter" |

**Tone rule:** every entry is written as "a reviewer will likely ask X — here's how to answer it," never as "this is a problem with your background."

---

## 8. Narrative generation rules

1. Every narrative sentence must be traceable to a dimension result. No free-floating prose.
2. If a dimension scores low, its narrative says why, in the same register as the score. No "genuinely excellent" sitting above a D.
3. The composite must be explainable in one sentence naming the two or three drivers.
4. Strengths cite the candidate's own specifics — a number, a role, a phrase from their document.
5. Weaknesses always pair with the fix and the expected magnitude of improvement.
6. Prestige never appears, in any phrasing.
7. Never tell a candidate their employer or school was insufficient. If prestige contributed nothing, the narrative is simply silent on it.
8. Grade and prose are rendered from the same object in one pass, so they cannot drift.

---

## 9. Deliberate non-goals

- **No university prestige penalty.** Weak predictive validity at senior levels, meaningful disparate-impact exposure, unfixable by the candidate.
- **No prestige-gap inference** between school tier and employer tier. Thin signal, fragile inference, condescending to surface.
- **No employer ranking shown to candidates.** Consistent with V1 legal guardrails.
- **No predictive scoring** of hire likelihood or outcome.
- **No automated rejection** or filtering of candidates based on any score here.
- **No gap penalty independent of framing.** Detection generates an action; only unexplained gaps affect First Glance, and only because a recruiter genuinely sees them.

---

## 10. Calibration plan

1. **Fix the known defects first** — the EVP/President scope comparison, the 27-vs-28 year arithmetic, the fabricated "five alumni networks," and the location mismatch on the openings count.
2. **Build the fixture corpus.** Vary one dimension at a time against a fixed base resume: gap present/absent, hopping present/absent, logos recognized/unrecognized, titles progressive/flat, evidence quantified/unquantified, ATS clean/degraded. Existing fixtures cover logo and trajectory variance.
3. **Verify single-variable isolation.** With all non-resume inputs held constant, a one-variable change should move exactly the dimensions it targets and nothing else.
4. **Calibrate against human judgment.** Have experienced recruiters grade 30–50 real resumes blind. Fit the weights to their consensus rather than to intuition.
5. **Audit the prestige bonus** once real distributions exist. Check score distributions with the bonus zeroed out; if removing it materially reorders candidates, the cap is too high.
6. **Test narrative-grade alignment** explicitly. Generate reports across the full band range and confirm no report's prose contradicts its own letter.

---

## 11. Open questions

- Does Target Fit measure candidate-vs-target alignment, or target realism given market conditions? Those are different products and the name doesn't disambiguate. Market demand should shape the plan, not the grade.
- Should First Glance be shown to candidates directly, or only its top fix? Showing "Likely Skip" is honest but harsh.
- What is the minimum profile completeness at which the Resume Grade should be recomputed with reference corroboration folded in — or should the two always stay separate?
- How is function family determined for genuine cross-function candidates?
- Should the resume grade be recomputed automatically when a candidate records a §7 explanation, and shown as a before/after delta? This would make the follow-up loop visibly rewarding.
