import { extractTopSkills } from '@/lib/companies/skills-extraction'

// What is kept of a job description. Only a short excerpt is stored (enough for a
// card); the skills the posting asks for are extracted from the FULL text and stored
// alongside. Keeping every description whole would add ~125 MB to the database for no
// feature that needs it. Pure, so the rules are tested (src/test/posting-text.test.ts).

export const EXCERPT_CHARS = 1000
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

export function skillsFrom(title: string, description: string | null | undefined): string[] {
  const text = description?.trim()
  if (!text) return []
  return extractTopSkills([`${title}\n${text.slice(0, MAX_SCAN_CHARS)}`], MAX_POSTING_SKILLS).map((s) => s.term)
}
