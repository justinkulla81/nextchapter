/**
 * The division of a company a layoff is in, when the filing or the headline names one: "Microsoft cuts jobs in its Xbox
 * division" gives "Xbox", a WARN employer written "Boeing - Defense Division" gives "Defense".
 *
 * Deliberately narrow, like the headline reader: only a capitalised name directly before the word "division" or "business
 * unit", or "Division of <Name>". Anything looser would turn "the unit", "a division" or a place into a division. Null when the
 * text names none.
 */
const NAME_TOKEN = String.raw`[A-Z0-9][\w&.'’/-]*`
const BEFORE_WORDS = new RegExp(String.raw`((?:${NAME_TOKEN} ){0,3}${NAME_TOKEN}) (?:division|Division|business unit|Business Unit)\b`)
const DIVISION_OF = new RegExp(String.raw`\bDivision of ((?:${NAME_TOKEN} ){0,3}${NAME_TOKEN})`)

const LEADING_NOISE = /^(?:the|this|that|its|our|their|a|an|another|one|each|every|new|largest|biggest|consumer's)\s+/i
/** Words that make the match a description or a government body rather than a division of a company. */
const NOT_A_DIVISION = /^(?:company|business|corporate|sales|operating|operations|parent|affected|entire|whole|same|other|local|regional|state|federal|labor|workforce|employment|unemployment|human|health)$/i

function clean(raw: string): string | null {
  let name = raw.trim()
  // "Meta's Reality Labs": the company's possessive is not part of the division's name.
  name = name.replace(/^(?:[A-Z0-9][\w&.-]*['’]s )+/, '')
  while (LEADING_NOISE.test(name)) name = name.replace(LEADING_NOISE, '')
  name = name.replace(/[\s,.:;-]+$/, '').trim()
  if (name.length < 2 || name.length > 40 || NOT_A_DIVISION.test(name)) return null
  return name
}

export function readDivision(text: string | null | undefined): string | null {
  if (!text) return null
  const t = text.replace(/\s+/g, ' ')
  const before = t.match(BEFORE_WORDS)
  if (before) {
    const d = clean(before[1])
    if (d) return d
  }
  const of = t.match(DIVISION_OF)
  return of ? clean(of[1]) : null
}

/** The first division any of the texts names (the headlines of a layoff's coverage, in order). */
export function firstDivision(texts: (string | null | undefined)[]): string | null {
  for (const t of texts) {
    const d = readDivision(t)
    if (d) return d
  }
  return null
}
