import 'server-only'

// Zero-cost heuristic — no LLM call, just pattern-matching on the first
// line of extracted resume text. A resume's very first line is almost
// always the candidate's own name (a near-universal convention), so this
// works for the large majority of real resumes without the cost or
// latency of an LLM extraction call. Falls back to the explicit "ask the
// candidate" prompt (see CrucibleTestFlow's resume step) whenever this
// doesn't confidently find something name-shaped — never invents a name
// from an unreliable guess.
const NAME_LINE_PATTERN = /^[A-Z][a-zA-Z'-]+(\s+[A-Z][a-zA-Z'.-]+){1,3}$/
const NON_NAME_WORDS = /\b(resume|r[ée]sum[ée]|curriculum vitae|\bcv\b|profile|contact|summary)\b/i

export interface ExtractedName {
  firstName: string
  lastName: string | null
}

export function deriveNameFromResumeText(text: string): ExtractedName | null {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  if (!firstLine || firstLine.length > 60) return null
  if (/[@\d]/.test(firstLine)) return null
  if (NON_NAME_WORDS.test(firstLine)) return null
  if (!NAME_LINE_PATTERN.test(firstLine)) return null

  const words = firstLine.split(/\s+/)
  return {
    firstName: words[0],
    lastName: words.length > 1 ? words[words.length - 1] : null,
  }
}
