// Finding company names that probably refer to the same business.
//
// Two kinds, handled differently on purpose:
//  - Spelling variants ("JP Morgan Chase" / "JPMorgan Chase", "Bausch & Lomb" /
//    "Bausch + Lomb") are the same letters once spacing and punctuation are
//    ignored. New companies resolve onto the existing one automatically.
//  - Abbreviations ("AWS" / "Amazon Web Services") are only ever suggested: an
//    acronym can belong to several companies, so a person confirms the match.

/** Names shorter than this ("BA" vs "B&A") are as likely to be two companies as one. */
export const MIN_SQUASHED_LENGTH = 6

/** A normalized company key with spacing, punctuation and "&" removed. */
export function squashKey(normalizedKey: string): string {
  return normalizedKey.replace(/[^a-z0-9]/g, '')
}

const FILLER_WORDS = new Set(['of', 'the', 'and', 'for', 'a', 'an', '&'])

/** First letters of the meaningful words: "Amazon Web Services" -> "aws". */
export function initialsOf(normalizedKey: string): string {
  return normalizedKey
    .split(' ')
    .filter((w) => w && !FILLER_WORDS.has(w))
    .map((w) => w[0])
    .join('')
}

export interface NamedCompany {
  id: string
  name: string
  canonicalNameNormalized: string
}

export interface AbbreviationSuggestion {
  abbreviation: NamedCompany
  fullName: NamedCompany
}

/**
 * Pairs where one company's whole name is the initials of another's
 * ("AWS" and "Amazon Web Services"). Acronyms need at least three letters and
 * the long name at least three words, which keeps "BA" and "Meta" out.
 */
export function findAbbreviationSuggestions(companies: NamedCompany[]): AbbreviationSuggestion[] {
  const byInitials = new Map<string, NamedCompany[]>()
  for (const c of companies) {
    if (c.canonicalNameNormalized.split(' ').filter((w) => !FILLER_WORDS.has(w)).length < 3) continue
    const initials = initialsOf(c.canonicalNameNormalized)
    if (initials.length < 3) continue
    byInitials.set(initials, [...(byInitials.get(initials) ?? []), c])
  }
  const out: AbbreviationSuggestion[] = []
  for (const c of companies) {
    const key = squashKey(c.canonicalNameNormalized)
    // A single letters-only token, written as a word of its own ("aws", not "a w s").
    if (c.canonicalNameNormalized.includes(' ') || !/^[a-z]{3,5}$/.test(key)) continue
    for (const full of byInitials.get(key) ?? []) {
      if (full.id !== c.id) out.push({ abbreviation: c, fullName: full })
    }
  }
  return out
}
