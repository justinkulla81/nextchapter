import { normalizeOrgName } from '@/lib/text/org-name-match'

// Deterministic checks that run on every question before it is shown or posted. They do not replace the AI
// rewrite or the member's own review. They make sure the things we already know about the member never go out.

export interface KnownIdentifiers {
  names: string[]
  companies: string[]
  places: string[]
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const PHONE = /(?:\+?\d[\s().-]?){9,}/
const URL_LIKE = /\b(?:https?:\/\/|www\.)\S+/i

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function terms(ids: KnownIdentifiers): string[] {
  const out = new Set<string>()
  for (const n of ids.names) for (const part of n.split(/\s+/)) if (part.trim().length >= 3) out.add(part.trim())
  for (const c of [...ids.companies, ...ids.places]) {
    const t = c.trim()
    if (t.length >= 3) out.add(t)
    const norm = normalizeOrgName(t)
    if (norm.length >= 3) out.add(norm)
  }
  // Longest first, so "Acme Corp" is replaced before "Acme".
  return [...out].sort((a, b) => b.length - a.length)
}

function termRegex(term: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${escapeRe(term)}(?![A-Za-z0-9])`, 'gi')
}

/** Replaces everything we know identifies the member, and reports which kinds were found. */
export function scrubKnown(text: string, ids: KnownIdentifiers): { text: string; found: Set<'company' | 'name' | 'place'> } {
  const found = new Set<'company' | 'name' | 'place'>()
  let out = text
  const groups: Array<['company' | 'name' | 'place', string[]]> = [
    ['company', ids.companies],
    ['name', ids.names],
    ['place', ids.places],
  ]
  for (const [kind, list] of groups) {
    for (const term of terms({ names: kind === 'name' ? list : [], companies: kind === 'company' ? list : [], places: kind === 'place' ? list : [] })) {
      const re = termRegex(term)
      if (re.test(out)) {
        found.add(kind)
        out = out.replace(termRegex(term), '[removed]')
      }
    }
  }
  return { text: out, found }
}

/** Returns a plain reason when the text still carries something that identifies the member, or null when it is clear. */
export function findLeak(text: string, ids: KnownIdentifiers): string | null {
  if (EMAIL.test(text) || PHONE.test(text) || URL_LIKE.test(text)) return 'It includes an email address, phone number or link.'
  if (/\[removed\]/i.test(text)) return 'It still has a blank where a name was taken out. Reword that part.'
  for (const term of terms(ids)) {
    if (termRegex(term).test(text)) return 'It still mentions your company, your name or your city.'
  }
  return null
}
