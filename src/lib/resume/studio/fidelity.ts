import type { ResumeDocumentData } from '@/lib/resume/export/document-data'

/**
 * The completeness check for an imported resume. It compares the text of the uploaded file with the
 * document built from it and reports what the document lost (words, figures and dates that are in the
 * file but not the document) and what it invented (figures, dates or words that are in the document but
 * not the file). It is pure and has no model in it, so the same check runs in tests and in production.
 *
 * It looks at tokens, not layout, so reordering, re-wrapping and punctuation changes do not trip it.
 * What does trip it: a bullet that was dropped or shortened, a number that changed, a month that was
 * added to a bare year, a title that was made up.
 */

export interface FidelityReport {
  /** True when nothing of substance was lost or added. */
  ok: boolean
  /** Share of the file's meaningful words that made it into the document, 0 to 1. */
  coverage: number
  /** In the file, not in the document: dropped figures first, then dropped words. */
  missing: string[]
  /** In the document, not in the file: figures, months and words that were not in the upload. */
  added: string[]
  /** Lines of the file that hold something missing, for showing to the person and for a retry. */
  unplacedLines: string[]
}

const TOKEN = /[\p{L}\p{N}]+(?:[.,'&+-][\p{L}\p{N}]+)*/gu

// Section headings: the templates print them whether or not the file had them, and a file's heading
// ("EXPERIENCE") is not content the document has to carry.
const HEADING_WORDS = new Set(['summary', 'experience', 'education', 'skills', 'certifications'])
// 'present' is a template word too: an open-ended date prints as "Present".
const TEMPLATE_WORDS = new Set([...HEADING_WORDS, 'present'])

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'its', 'our', 'was', 'were', 'has', 'have', 'had', 'are', 'but', 'not', 'all', 'any', 'per'])

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/ /g, ' ')
}

/** Tokens of a text: words and figures, lowercased, thousands separators removed from figures. */
export function tokenize(text: string): string[] {
  const out: string[] = []
  for (const m of normalize(text).matchAll(TOKEN)) {
    const raw = m[0].replace(/^[.,'&+-]+|[.,'&+-]+$/g, '')
    if (!raw) continue
    // "2023-present" and "AI-first" count as their parts, so "AI first" and "AI-first" match each other.
    for (const part of raw.split('-')) {
      if (part) out.push(/^\d[\d,]*(?:\.\d+)?/.test(part) ? part.replace(/(?<=\d),(?=\d{3}\b)/g, '') : part)
    }
  }
  return out
}

const hasDigit = (t: string) => /\d/.test(t)
const meaningful = (t: string) => hasDigit(t) || (t.length >= 3 && !STOPWORDS.has(t))

function counts(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1)
  return m
}

/** Every string in the document, in order, as one text. */
export function documentText(doc: ResumeDocumentData): string {
  const parts: (string | null | undefined)[] = [doc.name, doc.contact.email, doc.contact.phone, doc.contact.location, doc.contact.linkedinUrl, doc.targetTitle, doc.summary]
  for (const w of doc.workHistory) {
    parts.push(w.companyName, w.roleTitle, w.dateRangeLabel, w.location, ...w.bullets)
    for (const r of w.extraRoles ?? []) parts.push(r.roleTitle, r.dateRangeLabel)
  }
  for (const e of doc.education) parts.push(e.schoolName, e.degreeLabel, e.dateLabel)
  parts.push(...doc.skills, ...doc.certifications, doc.skillsHeading)
  for (const s of doc.sections ?? []) {
    parts.push(s.heading)
    for (const i of s.items) parts.push(i.title, i.subtitle, i.dateLabel, ...i.bullets)
  }
  return parts.filter((p): p is string => Boolean(p)).join('\n')
}

export function checkCompleteness(sourceText: string, doc: ResumeDocumentData): FidelityReport {
  return compareTexts(sourceText, documentText(doc))
}

/** The same check between any two texts: for example an upload and the text read back out of an exported file. */
export function compareTexts(sourceText: string, outputText: string): FidelityReport {
  const sourceTokens = tokenize(sourceText)
  const docTokens = tokenize(outputText)
  const sourceCounts = counts(sourceTokens)
  const docCounts = counts(docTokens)

  const missingFigures: string[] = []
  const missingWords: string[] = []
  let meaningfulTotal = 0
  let meaningfulKept = 0
  for (const [token, n] of sourceCounts) {
    if (!meaningful(token) || HEADING_WORDS.has(token)) continue
    meaningfulTotal += n
    const have = docCounts.get(token) ?? 0
    meaningfulKept += Math.min(n, have)
    // Figures and dates are held to their count: a date that appears twice in the file must appear twice.
    // Words only need to appear once, so a repeated word that was legitimately merged does not trip it.
    if (hasDigit(token) ? have < n : have === 0) (hasDigit(token) ? missingFigures : missingWords).push(token)
  }

  const added: string[] = []
  for (const [token, n] of docCounts) {
    if (!meaningful(token) || TEMPLATE_WORDS.has(token)) continue
    const inSource = sourceCounts.get(token) ?? 0
    if (hasDigit(token) ? n > inSource : inSource === 0) added.push(token)
  }

  const missing = [...missingFigures, ...missingWords]
  const lines = sourceText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const missingSet = new Set(missing)
  const unplacedLines = lines.filter((line) => tokenize(line).some((t) => missingSet.has(t)))

  const coverage = meaningfulTotal === 0 ? 1 : meaningfulKept / meaningfulTotal
  return { ok: missingFigures.length === 0 && added.length === 0 && coverage >= 0.97, coverage, missing, added, unplacedLines }
}
