// General narrative self-check — Master Build Script §8: "Add
// lib/scoring/self-check.ts: validate every generated numeric claim
// against source data before render; fail and log rather than shipping a
// wrong number." This is the general-purpose counterpart to
// resume-analysis/self-check.ts, which validates that ONE component's own
// composite math is internally consistent. This module validates the
// other direction: that free-form LLM-generated prose (report narrative,
// Victoria copy) doesn't assert a number, or a count, that disagrees with
// the structured facts it's supposed to be describing.
//
// This exists to catch the exact bug class named in §8's fixture examples
// — "28 years" where the resume says 27; "five alumni networks" where two
// schools exist; a job count geolocated to the wrong place — a number
// asserted in generated text that doesn't match its source-of-truth value.
// A report generator computes the real values first, generates prose, then
// calls assertGeneratedFacts before rendering; on failure it logs and
// should fall back to a templated (non-LLM) sentence rather than ship the
// wrong number. It cannot catch a wrong claim that happens to equal a real
// number by coincidence, or a qualitative misstatement with no number in
// it — narrower, source-grounded checks (like resume-analysis's own
// per-component self-check) remain the primary defense for the numbers
// they own.

export interface FactCheck {
  label: string // e.g. "years of experience", "alumni networks", "open roles near you"
  asserted: number // what the generated text claims
  source: number // the real, computed value
}

export interface SelfCheckResult {
  passed: boolean
  errors: string[]
}

export function assertGeneratedFacts(checks: FactCheck[]): SelfCheckResult {
  const errors = checks
    .filter((c) => c.asserted !== c.source)
    .map((c) => `${c.label}: generated text says ${c.asserted}, source data says ${c.source}.`)

  if (errors.length > 0) {
    console.error('Narrative self-check failed:', errors)
  }

  return { passed: errors.length === 0, errors }
}

// A softer check for when the generated text is the surface itself (not a
// separately-extracted asserted value) — confirms the source-of-truth
// number actually appears in the text somewhere, so a report that never
// states "27 years" at all (rather than misstating it as 28) still fails
// loudly instead of silently passing. Best-effort: it's a presence check,
// not an attribution check, so pair it with assertGeneratedFacts above
// wherever the asserted value can be extracted directly.
export function checkFactAppearsInText(text: string, check: Omit<FactCheck, 'asserted'>): boolean {
  return new RegExp(`\\b${check.source}\\b`).test(text)
}
