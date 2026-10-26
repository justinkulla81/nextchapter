import { PERSONAS } from '@/lib/constants/personas'

// Guess where a job-alert subscriber is in their search so the first screen after confirming can offer the
// right next step. Rules only, no AI. An earlier answer to the journey picker (same email) beats any guess.
// The guess is always shown as a suggestion with the other choices beside it, never as a fact about the person.

const KNOWN = new Set(PERSONAS.map((p) => p.slug))

const RULES: Array<{ slug: string; words: RegExp }> = [
  { slug: 'new-grad', words: /\b(intern|internship|new grad|graduate|entry[- ]level|junior|associate)\b/i },
  { slug: 'happy-with-fractional-work', words: /\b(fractional|interim|freelance|consultant|contract)\b/i },
  { slug: 'building-something', words: /\b(founder|co-?founder|startup founder)\b/i },
  { slug: 'next-act', words: /\b(part[- ]time|encore|semi[- ]retired)\b/i },
]

export const DEFAULT_JOURNEY = 'thinking-about-a-move'

/** The persona slug to suggest first. `earlier` is a slug the same email already chose in the journey picker. */
export function inferJourney(search: { q: string; loc?: string }, earlier?: string | null): { slug: string; basis: 'earlier_answer' | 'search_words' | 'default' } {
  if (earlier && KNOWN.has(earlier)) return { slug: earlier, basis: 'earlier_answer' }
  for (const r of RULES) if (r.words.test(search.q)) return { slug: r.slug, basis: 'search_words' }
  return { slug: DEFAULT_JOURNEY, basis: 'default' }
}

/** The suggestion first, then the situations most subscribers pick, four in all. */
export function journeyChoices(suggested: string): string[] {
  const common = ['laid-off', 'thinking-about-a-move', 'career-change', 'searching-too-long', 'resigned']
  return [suggested, ...common.filter((s) => s !== suggested)].filter((s) => KNOWN.has(s)).slice(0, 4)
}
