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
  name = name.replace(/[.,]/g, '')
  name = name.replace(QUOTE_PATTERN, '')

  // Leading/trailing apostrophes only (straight or curly) — an apostrophe
  // in the middle of a name (O'Brien, D'Angelo) is part of the name, not
  // decoration, so it's deliberately not touched anywhere else.
  name = name.replace(/^['’‘]+|['’‘]+$/g, '')

  return name.replace(/\s+/g, ' ').trim()
}
