// Display rules for Victoria's weekly advice: numbers as numerals, and the
// key numbers bold. Pure (no React), so it's testable; WeeklyFocusCard
// renders the segments.

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
}

/**
 * "Zero applications" → "0 applications", "Ten people" → "10 people".
 * "one" only where it's a count ("at least one", "just one", "one more"),
 * since "one" is also a pronoun ("the one that works").
 */
export function numeralize(text: string): string {
  let out = text.replace(/\b(zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty)\b/gi,
    (w) => String(NUMBER_WORDS[w.toLowerCase()]))
  out = out.replace(/\b(at least|only|just|exactly|book|send|pick|add) one\b/gi, (_m, lead: string) => `${lead} 1`)
  out = out.replace(/\bone more\b/gi, '1 more')
  return out
}

export type TextSegment = { text: string; bold: boolean }

/** Splits text so every number (with a unit like %, /week, x) can be bold. */
export function boldNumbers(text: string): TextSegment[] {
  const parts = text.split(/(\b\d+(?:[.,]\d+)?(?:%|\/week|\/wk|x)?)/g)
  return parts.filter((p) => p !== '').map((p) => ({ text: p, bold: /^\d/.test(p) }))
}

export const formatFocusText = (text: string): TextSegment[] => boldNumbers(numeralize(text))
