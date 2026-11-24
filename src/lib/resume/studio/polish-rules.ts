/**
 * Fixes that need no model: spacing and punctuation slips that are wrong in every case. They are suggestions like any
 * other, shown before and after, and they never touch a word, a figure or a name.
 */
export interface RuleFix {
  replacement: string
  reasons: string[]
}

// Addresses, links and file names hold dots and commas that are not sentence punctuation.
const looksLikeAddress = (s: string) => /@|:\/\/|www\./i.test(s)

export function ruleFix(text: string): RuleFix | null {
  if (looksLikeAddress(text)) return null
  let out = text
  const reasons: string[] = []
  const step = (re: RegExp, to: string | ((m: string, ...g: string[]) => string), reason: string) => {
    const next = out.replace(re, to as never)
    if (next !== out) {
      out = next
      if (!reasons.includes(reason)) reasons.push(reason)
    }
  }
  // A comma runs into a word: "New York,NY". Figures such as 1,000 are not affected.
  step(/,(?=\p{L})/gu, ', ', 'Add a space after the comma.')
  // A full stop runs into the next sentence: "support.Modernized". Needs two letters directly before the dot, so U.S. and e.g. are left alone.
  step(/(\p{L}{2})\.(?=\p{Lu}\p{Ll})/gu, '$1. ', 'Add a space after the full stop.')
  step(/ {2,}/g, ' ', 'Use one space between words.')
  step(/\s+([,.;:!?])/g, '$1', 'Remove the space before the punctuation.')
  step(/\(\s+/g, '(', 'Remove the space after the bracket.')
  step(/\s+\)/g, ')', 'Remove the space before the bracket.')
  // The same word twice in a row: "the the". Figures are left alone.
  step(/\b(\p{L}{2,})(\s+)\1\b/giu, '$1', 'A word is repeated.')
  out = out.trim()
  if (out !== text.trim()) {
    // Leading or trailing blanks alone are not worth a suggestion.
    return { replacement: out, reasons }
  }
  return null
}
