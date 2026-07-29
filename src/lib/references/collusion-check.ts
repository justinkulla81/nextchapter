// Anti-gaming check for reference testimony. The whole reference system
// assumes each referee is an INDEPENDENT voice — that's the only reason
// reference-backed categories (ownership, skills execution) are trusted
// more than self-report. That assumption breaks if a candidate writes
// several references themselves, or coaches referees from a script.
//
// The tell is textual: independently-written prose about the same person
// converges on themes, not on phrasing. Near-identical wording across two
// submissions is strong evidence they came from one source.
//
// Deliberately generous, matching how the rest of the scoring system
// treats ambiguous signal: short answers are exempt (everyone writes
// "great to work with"), the threshold is set well above what genuine
// overlap produces, and a flagged cluster is DISCOUNTED rather than
// discarded — three near-identical references should count as roughly one
// real voice, not zero. Never accuses anyone; it only reweights.

/** Word-trigram Jaccard above this reads as shared authorship, not shared opinion. */
const SIMILARITY_THRESHOLD = 0.4

/** Below this many words, similarity is meaningless — short praise is generic by nature. */
const MIN_WORDS_FOR_COMPARISON = 12

/** Weight applied to every duplicate after the first in a colluding cluster. */
const DUPLICATE_WEIGHT = 0.25

export interface ReferenceTextLike {
  id: string
  strengthSummary: string | null
  growthAreaSummary: string | null
  contextNotes: string | null
  completedAt: Date | null
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function trigrams(words: string[]): Set<string> {
  const grams = new Set<string>()
  for (let i = 0; i + 2 < words.length; i++) {
    grams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
  }
  return grams
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const g of a) if (b.has(g)) shared++
  return shared / (a.size + b.size - shared)
}

function combinedText(ref: ReferenceTextLike): string {
  return [ref.strengthSummary, ref.growthAreaSummary, ref.contextNotes].filter(Boolean).join(' ')
}

export function referenceSimilarity(a: ReferenceTextLike, b: ReferenceTextLike): number {
  const wordsA = normalizeWords(combinedText(a))
  const wordsB = normalizeWords(combinedText(b))
  if (wordsA.length < MIN_WORDS_FOR_COMPARISON || wordsB.length < MIN_WORDS_FOR_COMPARISON) return 0
  return jaccard(trigrams(wordsA), trigrams(wordsB))
}

/**
 * Returns a weight in [0,1] per reference id. References whose text is
 * near-identical to an earlier one collapse toward a single voice: the
 * earliest-completed keeps full weight, each subsequent near-duplicate is
 * heavily discounted. Everything else stays at 1.
 */
export function computeReferenceWeights(references: ReferenceTextLike[]): Map<string, number> {
  const weights = new Map<string, number>(references.map((r) => [r.id, 1]))

  // Earliest first, so the original keeps full weight and later copies are
  // the ones discounted — a candidate can't demote a genuine early
  // reference by submitting a copy of it afterward.
  const ordered = [...references].sort(
    (a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0)
  )

  for (let i = 0; i < ordered.length; i++) {
    if ((weights.get(ordered[i].id) ?? 1) < 1) continue // already discounted
    for (let j = i + 1; j < ordered.length; j++) {
      if ((weights.get(ordered[j].id) ?? 1) < 1) continue
      if (referenceSimilarity(ordered[i], ordered[j]) >= SIMILARITY_THRESHOLD) {
        weights.set(ordered[j].id, DUPLICATE_WEIGHT)
      }
    }
  }

  return weights
}

/** True when at least one reference was discounted — for admin/coach visibility only. */
export function hasSuspectedCollusion(weights: Map<string, number>): boolean {
  for (const w of weights.values()) if (w < 1) return true
  return false
}
