import { extractTopSkills } from '@/lib/companies/skills-extraction'

// What is kept of a job description. Since 2026-10-24 the FULL posting text is stored
// (aggregators such as Jooble and Talent.com require the employer's full description, and
// Google for Jobs prefers it), capped at MAX_DESCRIPTION_CHARS as a sanity bound against
// junk. The skills the posting asks for are still extracted from the full text and stored
// alongside. excerptOf is kept for card-sized reads (list pages and aggregates read a
// clipped copy so their payloads stay as small as before) and for internships, which still
// store an excerpt. Pure, so the rules are tested (src/test/posting-text.test.ts).

export const EXCERPT_CHARS = 1000
export const MAX_DESCRIPTION_CHARS = 50_000
const MAX_SCAN_CHARS = 20000 // sanity bound on what is scanned
export const MAX_POSTING_SKILLS = 12

export function excerptOf(description: string | null | undefined): string | null {
  const text = description?.trim()
  if (!text) return null
  if (text.length <= EXCERPT_CHARS) return text
  const cut = text.slice(0, EXCERPT_CHARS)
  const lastSpace = cut.lastIndexOf(' ')
  // Break at a word where there is one reasonably near the limit, never mid-word.
  return `${cut.slice(0, lastSpace > EXCERPT_CHARS * 0.6 ? lastSpace : EXCERPT_CHARS)}…`
}

/** True when a stored description is a cut-down excerpt (rows imported before full text was kept). */
export function isExcerpt(description: string | null | undefined): boolean {
  const text = description?.trimEnd() ?? ''
  return text.endsWith('…') && text.length <= EXCERPT_CHARS + 1
}

const ENTITIES: Record<string, string> = { amp: '&', nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•', hellip: '…' }

/**
 * The full description as stored: plain text (pages and feeds render it as escaped
 * paragraphs). The crawler already sends plain text; the few postings that arrive as HTML
 * get their tags turned into line breaks and their common entities decoded. Deterministic,
 * so a re-import of the same text is never seen as a change.
 */
export function fullDescriptionOf(description: string | null | undefined): string | null {
  let text = description?.trim()
  if (!text) return null
  if (/<\/?(p|br|li|ul|ol|div|h[1-6]|strong|b|em|span)\b[^>]*>/i.test(text)) {
    text = text
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(/<\/(p|div|h[1-6]|ul|ol|li|tr|table|section)>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  }
  text = text
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
      }
      return ENTITIES[e.toLowerCase()] ?? m
    })
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!text) return null
  if (text.length <= MAX_DESCRIPTION_CHARS) return text
  const cut = text.slice(0, MAX_DESCRIPTION_CHARS)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > MAX_DESCRIPTION_CHARS * 0.9 ? lastSpace : MAX_DESCRIPTION_CHARS)}…`
}

export function skillsFrom(title: string, description: string | null | undefined): string[] {
  const text = description?.trim()
  if (!text) return []
  return extractTopSkills([`${title}\n${text.slice(0, MAX_SCAN_CHARS)}`], MAX_POSTING_SKILLS).map((s) => s.term)
}
