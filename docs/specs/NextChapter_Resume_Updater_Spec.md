# NextChapter — Resume Updater Spec

Version 0.1 — the tool that turns the diagnosis into a fixed document.

---

## 1. Gating

**Applying the recommended fixes gates the Executive Dossier.**

The Dossier goes to recruiters with the resume attached. Sending one wrapped around a document that Workday can't parse undermines the entire promise — the same honest logic that gates recruiter introductions on corroboration.

**Gate on fixes applied, never on grade achieved.** A "reach B+" gate locks out exactly the candidates who need the platform most. Every candidate at every band can apply their own recommended fixes.

Do not gate references or assessments on it. Those are inputs with long latency and should start on day one regardless.

---

## 2. Principles

**Never invent a number.** If the system writes "improved efficiency by 30%," the candidate carries that into an interview and cannot defend it. That's a real harm, and it's the single most common failure of generic AI resume tools.

**The system does what's deterministic. The candidate supplies what only they know.** Formatting, spacing, dates, tense, and typos need no judgment. Scope, results, and context cannot be derived from the document.

**Never rewrite silently.** Every change is a visible diff, accepted or rejected individually. The candidate owns the document at all times.

**Preserve the original.** Always recoverable, always.

---

## 3. Three fix classes, three interaction modes

### 3.1 Mechanical — one click, instant

No judgment required. The system just does it, shows the diff, and the candidate approves in bulk.

- Letter-spaced or character-spaced headings
- Inconsistent date formats
- Tense inconsistency (present for current, past for prior)
- Typos and misspellings
- Non-standard section names → standard equivalents
- Postnominal credentials that aren't licensure
- "References available upon request"
- Content trapped in tables, text boxes, headers, or footers → flattened
- Multi-column experience sections → single column
- Non-embedded fonts → embedded standard
- Filename

> **8 mechanical issues fixed.** Review the changes below.
> *Your resume now parses cleanly in all 11 systems we test. It was failing 3.*

This is the five-second win before any hard work. Lead with it.

### 3.2 Proposed — pre-filled, candidate approves

The system has the answer from elsewhere and proposes it.

**Target line** — composed from the onboarding target, which they already gave:

> **Add this under your name:**
> *"Operations leader targeting operations manager roles at mid-sized companies in the Hartford area."*
>
> [Use this] · [Edit] · [Skip]

This is the single largest point gain in the rubric and it costs the candidate one tap, because the input was collected at onboarding.

**Gap and short-tenure lines** — composed from their §7 reviewer-question answers, if recorded.

### 3.3 Guided — the system asks, the candidate answers, the system composes

The real work, and the part that differentiates this from a rewriter.

Prioritized to the five highest-impact bullets — recent roles first, weighted by the rubric. Nobody should be asked to fix thirty bullets.

---

## 4. Guided extraction — worked example

> **Bullet 2 of 5.** Vantage Partners, Business Operations Lead.
>
> **You wrote:** "Responsible for day-to-day operational support across multiple departments."
>
> A recruiter reads this and learns nothing about size or outcome. Three quick questions:
>
> **How many departments?** `4`
> **Roughly how many people did that cover?** `60`
> **What measurably got better?** `monthly close went from 12 days to 8`
>
> **Here's your bullet:**
> *"Supported operations for 4 departments and 60+ staff, cutting monthly close from 12 days to 8."*
>
> [Use this] · [Edit] · [Try different questions]

The questions are generated per bullet from the detected weakness — a bullet missing a baseline gets asked for the "from" value; a bullet missing scale gets asked for headcount or budget.

### 4.1 When they don't know

Never push toward a guess.

> **Don't remember the exact number?**
>
> - **Estimate conservatively** — "approximately 4 departments" is fine and defensible
> - **Use a range** — "40–60 staff"
> - **Skip the number** — we'll strengthen the verb and the specificity instead
>
> *Anything on your resume should be something you can talk about comfortably in an interview. If you're not sure, leave it out.*

That last line is the guardrail. Say it plainly, every time.

### 4.2 Thin entries

For the disguised-gap pattern — a recent consulting or advisory entry with no substance:

> **Your consulting entry has two lines and no specifics.** Reviewers read that as a gap with a label on it.
>
> **Name two or three engagements.** What kind of company, what you did, what changed. Client names optional — "a 40-person manufacturer" works.

---

## 5. Sequence

| Step | Time | Why here |
|---|---|---|
| 1. Mechanical fixes | 30 sec | Instant win, visible ATS improvement |
| 2. Target line | 30 sec | Largest single gain, already answered at onboarding |
| 3. Five guided bullets | 12 min | The real work |
| 4. Reviewer-question lines | 3 min | Gaps, short tenures, thin entries |
| 5. Re-score and export | instant | The payoff |

Roughly 20 minutes end to end, matching what the activation screen promises.

---

## 6. Live feedback

Show the score moving as changes are accepted. This is the loop that teaches effort matters.

> **D → C+** with the changes you've accepted so far.
> Three more bullets would likely put you at B−.

Requirements: update on accept, never on hover; show the band, not decimal noise; never promise a specific final grade.

---

## 7. Output and re-verification

On save:

1. Re-score against the full rubric
2. **Re-run the ATS parser matrix** and show the before/after — this is the most concrete proof the work mattered
3. Export both .docx and .pdf, ATS-clean
4. Version history retained, original always recoverable

> **Before:** Workday recovered 6 of your 9 job titles. Taleo dropped your dates.
> **Now:** All 11 systems recover everything.

---

## 8. Honesty guardrails

- Never generate a number the candidate didn't supply
- Never suggest inflating a title, extending dates, or omitting a role to hide a gap
- Never compose a gap explanation the candidate didn't give — offer formats, not content
- If a candidate enters something that contradicts their own document, flag the reconciliation conflict rather than silently accepting it
- Every claim must be one they can defend out loud. Say so at the point of entry, not in a footer.

---

## 9. Later

**Per-application tailoring.** Adjust the target line and reorder emphasis against a specific posting, from the matched-jobs flow. Same rules — reordering and emphasis only, never new claims.

**Bullet library.** Once a candidate has supplied real numbers, those facts are reusable across tailored versions without re-asking.

**Re-diagnosis on re-upload.** A candidate who edits outside the tool and re-uploads gets a fresh diff against their prior version, not a cold start.
