// LinkedIn's connections export routinely includes emoji, decorative quotes
// around nicknames, and trailing credential suffixes ("Jane Doe, MBA") —
// none of which belong in a contact list. Applied to every contact import
// (see csv-import.ts) so the name shown in the Contact Directory is just
// the person's name.

// Not exhaustive — the common credentials that actually show up appended to
// LinkedIn display names. Matched case-insensitively, right at the end of
// the string, optionally repeated (e.g. "Jane Doe, MBA, CFA").
const CREDENTIAL_SUFFIXES = [
  'MBA',
  'PhD',
  'Ph\\.D\\.?',
  'JD',
  'J\\.D\\.?',
  'MD',
  'M\\.D\\.?',
  'CPA',
  'CFA',
  'CMA',
  'PMP',
  'Esq\\.?',
  'DDS',
  'DVM',
  'MSW',
  'MPH',
  'PE',
  'RN',
  'CISSP',
  'CFP',
  'CIA',
  'CISA',
  'MSc',
  'LLM',
  'LL\\.M\\.?',
]
const SUFFIX_PATTERN = new RegExp(`[,\\s-]+(${CREDENTIAL_SUFFIXES.join('|')})\\.?$`, 'i')

// Honorific prefixes LinkedIn display names sometimes carry ahead of the
// actual name ("Dr Jane Doe", "Prof Dr Alexander Van de Putte"). Stripped
// before the word-count guard below so it isn't mistaken for the first
// word of the name — "Dr Jane" is a much worse guess than "Jane Doe".
// Matched case-insensitively, possibly repeated ("Prof Dr ..."), at the
// very start of the string only.
const TITLE_PREFIXES = ['Dr', 'Prof', 'Professor', 'Mr', 'Mrs', 'Ms', 'Rev']
const PREFIX_PATTERN = new RegExp(`^(${TITLE_PREFIXES.join('|')})\\.?[,\\s-]+`, 'i')

// A "<Name> <separator> <description>" boundary — the separator is either
// " is "/" is a "/" is the " (the exact shape of the reported bug: "Chris
// Fong is the founder of..."), a comma, an em/en dash, or a plain hyphen
// with spaces around it (LinkedIn bios commonly read "Name - Title -
// Company"). Only the first occurrence matters — everything after it is
// assumed to be the description, not more of the name.
const BIO_SEPARATOR_PATTERN = /\s+is\s+(?:the|a|an)\s+|\s*[,—–]\s*|\s+-\s+/i

// Broad-strokes emoji ranges — pictographs, symbols, flags, dingbats — plus
// the variation-selector/ZWJ characters LinkedIn exports sometimes leave
// behind attached to them.
const EMOJI_PATTERN =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu

// Double-quote-like marks only — straight/curly double quotes, low quotes,
// guillemets, backtick, acute accent. Deliberately excludes apostrophes
// (straight or curly): those are handled separately below so an internal
// apostrophe (O'Brien, D'Angelo) survives while a decorative one at the
// edge of the string doesn't.
const QUOTE_PATTERN = /["“”„«»´`]/g

// Title-cases a name, word by word — capitalize the first letter, lowercase
// the rest ("CHRIS FONG" / "chris fong" -> "Chris Fong"). Deliberately a
// simple per-word pass rather than special-casing apostrophes/hyphens
// (O'Brien, Mary-Jane): getting those perfect requires a name-particle
// dictionary that isn't worth building for a last-resort fallback path.
function titleCase(value: string): string {
  return value
    .split(' ')
    .map(titleCaseWord)
    .join(' ')
}

// Capitalizes each hyphen/apostrophe-delimited segment of a single word
// separately ("o'connor" -> "O'Connor", "mary-jane" -> "Mary-Jane") instead
// of just the word's first letter — cheap to get right and avoids an
// obviously-wrong "Mary-jane"/"O'connor" for the fairly common names that
// use either character.
function titleCaseWord(word: string): string {
  if (word.length === 0) return word
  return word
    .split(/([-'’])/)
    .map((segment) => (segment === '-' || segment === "'" || segment === '’' ? segment : titleCaseSegment(segment)))
    .join('')
}

function titleCaseSegment(segment: string): string {
  return segment.length === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
}

// Last-resort extraction for a string that's already failed the "this is
// short enough to be a name" check in sanitizeContactName below — i.e. a
// scraped bio/description slipped into the name field instead of an actual
// name (e.g. "Chris Fong is the founder of the Google alumni community
// Xoogler Ventures and cofounder of Key AI"). Two strategies, in order of
// confidence:
//
// 1. If there's a recognizable "<Name> <separator> <description>" boundary
//    (an "is the/a/an", a comma, a dash), everything before it is very
//    likely the actual name — but only trust that if the result itself is
//    short enough to plausibly be a name; a false-positive separator deep
//    in a long description could otherwise still leave junk.
// 2. Otherwise, assume the first two words are a first + last name. Most
//    personal names are two words, and guessing a 3rd word risks getting a
//    middle name half-right or, worse, grabbing the start of a description
//    that happens to look name-shaped — two words is the safer bet.
//
// Exported for testability; not meant to be called directly on ordinary
// short names — sanitizeContactName only invokes it once its own word-count
// guard has already decided the input needs this treatment.
export function extractLikelyName(raw: string): string {
  // Strip stacked title prefixes ("Prof Dr Alexander ..." has two).
  let withoutTitle = raw
  let strippedTitle = true
  while (strippedTitle) {
    const next = withoutTitle.replace(PREFIX_PATTERN, '')
    strippedTitle = next !== withoutTitle
    withoutTitle = next
  }
  const candidate = withoutTitle.trim() || raw.trim()

  const separatorMatch = candidate.split(BIO_SEPARATOR_PATTERN)[0]?.trim()
  if (separatorMatch && separatorMatch.split(/\s+/).filter(Boolean).length <= 4) {
    return titleCase(separatorMatch)
  }

  const firstTwoWords = candidate.split(/\s+/).filter(Boolean).slice(0, 2).join(' ')
  return titleCase(firstTwoWords)
}

export function sanitizeContactName(raw: string): string {
  let name = raw

  // Strip trailing credential suffixes, possibly stacked ("Jane Doe, MBA, CFA").
  let stripped = true
  while (stripped) {
    const next = name.replace(SUFFIX_PATTERN, '')
    stripped = next !== name
    name = next
  }

  name = name.replace(EMOJI_PATTERN, '')
  name = name.replace(QUOTE_PATTERN, '')
  name = name.replace(/\s+/g, ' ').trim()

  // A real name is essentially never more than 4 words (first, middle,
  // last, suffix) — anything longer slipping through here is almost always
  // a scraped bio/description that made it into the name field during
  // import, not an unusually long real name. Only kicks in past that
  // threshold, so ordinary short names pass through byte-for-byte. Run
  // before the comma/period strip below, since extractLikelyName's
  // "<Name>, <description>" split needs that comma still in place.
  const wordCount = name.split(/\s+/).filter(Boolean).length
  if (wordCount > 4) {
    name = extractLikelyName(name)
  }

  name = name.replace(/[.,]/g, '')

  // Leading/trailing apostrophes only (straight or curly) — an apostrophe
  // in the middle of a name (O'Brien, D'Angelo) is part of the name, not
  // decoration, so it's deliberately not touched anywhere else.
  name = name.replace(/^['’‘]+|['’‘]+$/g, '')

  return name.replace(/\s+/g, ' ').trim()
}
