// Years-of-experience requirement parsed from a job posting's text — pure, no
// server-only deps, tested in src/test/years-required.test.ts.
//
// Handles: "5+ years", "5 or more years", "minimum of 7 years", "at least
// eight years", "10-15 years", "10 to 15 years", "five (5) years", "7+ yrs",
// "between 8 and 12 years", "a decade of experience". Only a number tied to
// experience counts — "founded 25 years ago", "a 2-year contract", "18 years
// of age", "over the past 10 years we have grown" don't.
//
// Strength: "preferred" when the sentence says so (preferred / ideally / a plus
// / nice to have / desired) or the number sits under a "Preferred
// qualifications" heading; "or equivalent" is recorded separately. Callers
// treat either as a softer requirement.
//
// When a posting states several numbers ("10+ years of experience, including
// 5 years in leadership") the overall requirement is the largest required
// minimum — the sub-requirements are narrower slices of the same career. Only
// when nothing is required does a preferred number stand in.
//
// How a member's years compare with this requirement is decided in one place,
// years-fit.ts. The board scorers use its cheap quickYearsRange (one regex)
// instead of this parser, which is too slow to run over every posting.

export interface YearsRequirement {
  min: number
  /** Top of a stated range ("10-15 years" → 15); null for "10+" / "at least 10". */
  max: number | null
  strength: 'required' | 'preferred'
  /** "…or equivalent experience" — a softer bar. */
  orEquivalent: boolean
  /** The matched words, for display ("10-15 years"). */
  phrase: string
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, 'twenty-five': 25, 'twenty five': 25, thirty: 30,
}

const MAX_PLAUSIBLE = 40

// Words that tie a number of years to work experience, looked for just after
// the "years" token (e.g. "years of progressive leadership experience").
const EXPERIENCE_AFTER =
  /^\W{0,3}(?:of\s+)?(?:[\w&/,'’-]+\s+){0,7}?(?:experience|exp\b|background|track record|work(?:ing)?\b|tenure|in (?:a|an|the)\b|in\s+\w+|leading|managing|building|progressive|post-?(?:graduate|mba|degree)|professional|industry|hands-on|relevant|related|leadership|as (?:a|an)\b|serving|selling|practicing|practice)/i

// Words before the number that make it an experience requirement on their own
// ("minimum of", "at least", "requires").
const REQUIREMENT_BEFORE = /(minimum(?:\s+of)?|min\.?|at least|requires?|required|must have|need|needs|bring(?:s|ing)?|have|has|possess(?:es)?|with|over|more than|plus)\s*$/i

// Non-experience uses of a number of years.
const NOT_EXPERIENCE_AFTER =
  /^\W{0,2}(?:old\b|of age\b|ago\b|in business\b|in operation\b|running\b|of (?:service to|serving) (?:our|the) (?:community|clients|customers)|warranty|contract|term\b|appointment|assignment|vesting|cliff|commitment|history\b|of growth|of (?:continuous|consecutive) growth|anniversary|in duration|duration)/i
const NOT_EXPERIENCE_BEFORE =
  /(founded|established|for over|for more than|over the (?:past|last|next)|in the (?:past|last|next)|within(?: the (?:last|past))?|every|each|up to|first|next|past|last|company with|organization with|firm with|our|ages?|aged|nte|not to exceed|term|period|eligibility period \(?|spent|has been|have been|less than|fewer than|no more than|under)\s*\(?$/i

const PREFERRED_WORDS = /\b(preferred|preferably|ideally|ideal candidates?|nice to have|a plus|is a plus|bonus|desired|desirable|would be (?:great|helpful)|advantageous|strongly preferred)\b/i
const PREFERRED_HEADING = /(preferred|desired|nice[- ]to[- ]have|bonus)\s+(qualifications|skills|requirements|experience|attributes)|\bnice to haves?\b|\bpluses\b|\bbonus points\b/gi
const REQUIRED_HEADING = /(required|minimum|basic|essential|key)\s+(qualifications|skills|requirements|experience)|\brequirements\s*:|\bqualifications\s*:|\bwhat you(?:'|’)ll (?:need|bring)\b|\bmust[- ]haves?\b|\bwho you are\b/gi
// "or equivalent experience", "…or equivalent." — not "at or equivalent to the GS-09 grade".
const OR_EQUIVALENT = /\bor (?:an? |the )?equivalent (?:combination|experience|education|work|training|degree|background)\b|\bor (?:the )?equivalent\s*(?:[.,;)]|$)/i
const REQUIRED_WORD = /\b(required|requires|must have|must possess|minimum)\b/gi
const PREFERRED_WORDS_G = new RegExp(PREFERRED_WORDS.source, 'gi')

// Which keyword governs the number: the nearest one after it in the sentence
// ("5 years of experience preferred", "…is required"); failing that, one
// before it in the same clause ("Ideally 5 years…", "Ideal candidates have
// 3-5 years") — so "A degree is preferred and 5 years of experience is
// required" reads as required.
function sentenceSaysPreferred(sentence: string, at: number, atEnd: number): boolean {
  if (!PREFERRED_WORDS.test(sentence)) return false
  const hits: { at: number; end: number; preferred: boolean }[] = []
  for (const [re, preferred] of [[PREFERRED_WORDS_G, true], [REQUIRED_WORD, false]] as const) {
    re.lastIndex = 0
    for (let m = re.exec(sentence); m; m = re.exec(sentence)) hits.push({ at: m.index, end: m.index + m[0].length, preferred })
  }
  const after = hits.filter((h) => h.at >= atEnd).sort((a, b) => a.at - b.at)[0]
  if (after) return after.preferred
  const before = hits.filter((h) => h.end <= at).sort((a, b) => b.end - a.end)[0]
  if (!before) return false
  return before.preferred && !/\band\b|;|\bbut\b/i.test(sentence.slice(before.end, at))
}

function toNumber(raw: string): number | null {
  const s = raw.toLowerCase().trim()
  if (/^\d{1,2}(?:\.5)?$/.test(s)) return Math.floor(parseFloat(s))
  return WORD_NUMBERS[s] ?? null
}

const NUM = String.raw`(\d{1,2}(?:\.5)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty[- ]five|twenty|thirty)`
// "five (5)" → keep the word, drop the parenthesised digits.
const PAREN_DIGITS = /\b([a-z]+(?:[- ][a-z]+)?)\s*\(\s*(\d{1,2})\s*\)/gi
const YEARS = String.raw`(?:years?|yrs?\.?)`

// Order matters: ranges before plus before plain, so "10-15 years" isn't read as "15 years".
const PATTERNS: { re: RegExp; kind: 'range' | 'plus' | 'plain' | 'decade' }[] = [
  { re: new RegExp(String.raw`\bbetween\s+${NUM}\s+(?:and|to)\s+${NUM}\s*\+?\s*${YEARS}`, 'gi'), kind: 'range' },
  { re: new RegExp(String.raw`\b${NUM}\s*(?:-|–|—|to)\s*${NUM}\s*\+?\s*${YEARS}`, 'gi'), kind: 'range' },
  { re: new RegExp(String.raw`\b${NUM}\s*(?:\+|\s+or\s+more|\s+plus|\s+or\s+greater)\s*${YEARS}`, 'gi'), kind: 'plus' },
  { re: new RegExp(String.raw`\b${NUM}\s*${YEARS}\s*(?:\+|or\s+more|plus|minimum|min\.?)`, 'gi'), kind: 'plus' },
  { re: new RegExp(String.raw`\b${NUM}\s*-?\s*${YEARS}`, 'gi'), kind: 'plain' },
  { re: /\b(?:a|one|over a|more than a|at least a)\s+decade\b/gi, kind: 'decade' },
  { re: /\b(?:two|2)\s+decades\b/gi, kind: 'decade' },
]

interface Candidate extends YearsRequirement {
  start: number
}

// The text of the sentence/bullet containing [start, end).
function sentenceAround(text: string, start: number, end: number): { sentence: string; offset: number } {
  const before = text.slice(0, start)
  const sentStart = Math.max(before.lastIndexOf('. '), before.lastIndexOf('\n'), before.lastIndexOf('•'), before.lastIndexOf(';')) + 1
  const afterRel = text.slice(end).search(/(\.\s|\n|•|;)/)
  const sentEnd = afterRel === -1 ? text.length : end + afterRel
  return { sentence: text.slice(sentStart, sentEnd), offset: sentStart }
}

// Position of the last match (its end when `end` is set) — -1 when none.
function lastIndexOfRegex(text: string, re: RegExp, end = false): number {
  let last = -1
  re.lastIndex = 0
  for (let m = re.exec(text); m; m = re.exec(text)) last = end ? m.index + m[0].length : m.index
  return last
}

function underPreferredHeading(text: string, start: number): boolean {
  const before = text.slice(0, start)
  // End of the preferred heading vs start of the required one, so the generic
  // "qualifications:" inside "Preferred qualifications:" doesn't cancel it.
  return lastIndexOfRegex(before, PREFERRED_HEADING, true) > lastIndexOfRegex(before, REQUIRED_HEADING)
}

export function parseYearsRequired(raw: string | null | undefined): YearsRequirement | null {
  if (!raw) return null
  const text = raw.replace(PAREN_DIGITS, (_m, word: string, digits: string) =>
    toNumber(word) === parseInt(digits, 10) ? word : `${word} ${digits}`,
  )
  const taken: [number, number][] = []
  const found: Candidate[] = []

  for (const { re, kind } of PATTERNS) {
    re.lastIndex = 0
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const start = m.index
      const end = start + m[0].length
      if (taken.some(([s, e]) => start < e && end > s)) continue

      let min: number | null
      let max: number | null = null
      if (kind === 'decade') {
        min = /decades/i.test(m[0]) ? 20 : 10
      } else if (kind === 'range') {
        min = toNumber(m[1])
        max = toNumber(m[2])
        if (min !== null && max !== null && max < min) [min, max] = [max, min]
        if (min !== null && max !== null && max === min) max = null
      } else {
        min = toNumber(m[1])
      }
      if (min === null || min <= 0 || min > MAX_PLAUSIBLE || (max !== null && max > MAX_PLAUSIBLE)) continue

      const after = text.slice(end, end + 120)
      const before = text.slice(Math.max(0, start - 40), start)
      if (NOT_EXPERIENCE_AFTER.test(after) || NOT_EXPERIENCE_BEFORE.test(before)) {
        taken.push([start, end])
        continue
      }
      // "2-year contract", "a 3-year term"
      if (/-\s*(?:year|yr)\b/i.test(m[0]) && !/years/i.test(m[0])) {
        taken.push([start, end])
        continue
      }
      const tiedToExperience =
        kind === 'decade' ? /^\W{0,3}(?:of\s+)?(?:[\w&/,-]+\s+){0,6}?experience/i.test(after) || REQUIREMENT_BEFORE.test(before)
        : EXPERIENCE_AFTER.test(after) || (kind !== 'plain' && REQUIREMENT_BEFORE.test(before)) || /\b(minimum|at least|min\.?)\s*(?:of\s*)?$/i.test(before)
      if (!tiedToExperience) continue

      taken.push([start, end])
      const { sentence, offset } = sentenceAround(text, start, end)
      const preferred = sentenceSaysPreferred(sentence, start - offset, end - offset) || underPreferredHeading(text, start)
      found.push({
        start,
        min,
        max,
        strength: preferred ? 'preferred' : 'required',
        orEquivalent: OR_EQUIVALENT.test(sentence),
        phrase: m[0].trim().replace(/\s+/g, ' '),
      })
    }
  }

  if (found.length === 0) return null
  const required = found.filter((f) => f.strength === 'required')
  const pool = required.length > 0 ? required : found
  const best = pool.reduce((a, b) => (b.min > a.min || (b.min === a.min && b.start < a.start) ? b : a))
  return { min: best.min, max: best.max, strength: best.strength, orEquivalent: best.orEquivalent, phrase: best.phrase }
}

export function formatYearsRequirement(r: YearsRequirement | null): string {
  if (!r) return 'Not stated'
  const base = r.max !== null ? `${r.min}–${r.max} yrs` : `${r.min}+ yrs`
  const soft = r.strength === 'preferred' ? ' (preferred)' : r.orEquivalent ? ' (or equivalent)' : ''
  return base + soft
}
