/**
 * Which month's Displacement Report an email carried, from what Gmail shows
 * of it: attachment filenames and the body text.
 *
 * A report attachment is named `displacement-report-2026-09.pdf` or
 * `NextChapter-Displacement-Report-2026-09.pdf`; a link points somewhere
 * under launchyournextchapter.com/reports/. The month is read as YYYY-MM, or
 * as a month name and year ("september-2026"), which is how the report's own
 * pages are slugged. Returns 'YYYY-MM', or null when nothing matches.
 */

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

const FILENAME_PREFIX = /^(?:nextchapter-)?displacement-report-/i
const REPORT_URL = /(?:https?:\/\/)?(?:www\.)?launchyournextchapter\.com\/reports\/[^\s"'<>)\]]+/gi

/** 'YYYY-MM' from text like "2026-09", "2026_09" or "september-2026". */
export function monthKeyFrom(text: string): string | null {
  const numeric = text.match(/(20\d{2})[-_.](0[1-9]|1[0-2])(?!\d)/)
  if (numeric) return `${numeric[1]}-${numeric[2]}`
  const named = text.toLowerCase().match(new RegExp(`(${MONTHS.join('|')})[-_ ]?(20\\d{2})`))
  if (named) return `${named[2]}-${String(MONTHS.indexOf(named[1]) + 1).padStart(2, '0')}`
  return null
}

export function editionFromFilename(filename: string): string | null {
  const base = filename.trim().split(/[\\/]/).pop() ?? ''
  if (!FILENAME_PREFIX.test(base)) return null
  return monthKeyFrom(base)
}

export function editionFromBody(body: string | null | undefined): string | null {
  if (!body) return null
  for (const match of body.matchAll(REPORT_URL)) {
    const key = monthKeyFrom(match[0])
    if (key) return key
  }
  return null
}

export function detectReportEdition(input: { attachmentNames?: string[]; body?: string | null }): string | null {
  for (const name of input.attachmentNames ?? []) {
    const key = editionFromFilename(name)
    if (key) return key
  }
  return editionFromBody(input.body)
}
