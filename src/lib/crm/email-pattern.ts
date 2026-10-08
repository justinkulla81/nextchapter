/**
 * Working out an organization's email format from addresses we already
 * have, and guessing it for people we have none for.
 *
 * A university almost always gives everyone the same shape of address —
 * jane.roe@, jroe@, roej@ — so three known addresses at a domain usually
 * settle it. A guess is only a guess: it is stored apart from the real
 * email, with how it was reached, and shown as one.
 */

const TEMPLATES = {
  'first.last': (f: string, l: string) => `${f}.${l}`,
  firstlast: (f: string, l: string) => `${f}${l}`,
  flast: (f: string, l: string) => `${f[0]}${l}`,
  'f.last': (f: string, l: string) => `${f[0]}.${l}`,
  first_last: (f: string, l: string) => `${f}_${l}`,
  'first-last': (f: string, l: string) => `${f}-${l}`,
  firstl: (f: string, l: string) => `${f}${l[0]}`,
  'first.l': (f: string, l: string) => `${f}.${l[0]}`,
  lastf: (f: string, l: string) => `${l}${f[0]}`,
  'last.first': (f: string, l: string) => `${l}.${f}`,
  lastfirst: (f: string, l: string) => `${l}${f}`,
  first: (f: string) => f,
  last: (_f: string, l: string) => l,
} as const
export type EmailTemplate = keyof typeof TEMPLATES

/** "Dr. Jane Q. Roe-Smith, PhD '09" → { first: 'jane', last: 'roesmith' }. */
export function nameParts(fullName: string): { first: string; last: string } | null {
  const cleaned = fullName
    .split(',')[0]
    .replace(/\b(dr|mr|mrs|ms|mx|prof|rev)\b\.?/gi, ' ')
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi, ' ')
    .replace(/\b[A-Z]?'\d{2}\b/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
  const tokens = cleaned.split(/\s+/).map((t) => t.toLowerCase().replace(/[^a-z-]/g, '')).filter(Boolean)
  // Initials are not names: "Jane Q. Roe" is Jane Roe.
  const words = tokens.filter((t) => t.replace(/-/g, '').length > 1)
  if (words.length < 2) return null
  return { first: words[0].replace(/-/g, ''), last: words[words.length - 1].replace(/-/g, '') }
}

/** Which templates turn this name into this local part (a trailing number, as in jroe2, is ignored). */
export function templatesFor(local: string, fullName: string): EmailTemplate[] {
  const parts = nameParts(fullName)
  if (!parts) return []
  const l = local.toLowerCase().replace(/\d+$/, '')
  return (Object.keys(TEMPLATES) as EmailTemplate[]).filter((t) => TEMPLATES[t](parts.first, parts.last) === l)
}

export interface DomainPattern {
  template: EmailTemplate
  /** Known addresses at the domain that fit some template, and how many fit this one. */
  examples: number
  matching: number
}

/**
 * Each domain's format, from known (name, address) pairs. A pair that fits
 * several templates ("jane@" is both first and, for Jane Jane, last) splits
 * its vote. A format is kept only when it carries most of the votes, and the
 * single-name templates (first@, last@) only with two or more examples —
 * one "roe@" says little.
 */
export function learnPatterns(known: { name: string; email: string }[]): Map<string, DomainPattern> {
  const votes = new Map<string, Map<EmailTemplate, number>>()
  const fits = new Map<string, number>()
  for (const k of known) {
    const [local, domain] = k.email.toLowerCase().trim().split('@')
    if (!local || !domain) continue
    const ts = templatesFor(local, k.name)
    if (!ts.length) continue
    const v = votes.get(domain) ?? new Map<EmailTemplate, number>()
    for (const t of ts) v.set(t, (v.get(t) ?? 0) + 1 / ts.length)
    votes.set(domain, v)
    fits.set(domain, (fits.get(domain) ?? 0) + 1)
  }
  const out = new Map<string, DomainPattern>()
  for (const [domain, v] of votes) {
    const examples = fits.get(domain)!
    const [template, score] = [...v.entries()].sort((a, b) => b[1] - a[1])[0]
    const single = template === 'first' || template === 'last'
    if (score / examples < 0.6 || (single && examples < 2)) continue
    out.set(domain, { template, examples, matching: Math.round(score) })
  }
  return out
}

export function applyTemplate(template: EmailTemplate, fullName: string, domain: string): string | null {
  const parts = nameParts(fullName)
  return parts ? `${TEMPLATES[template](parts.first, parts.last)}@${domain}` : null
}

/** "first.last, from 4 of 4 known addresses at tulane.edu" — shown with every guess. */
export function describePattern(domain: string, p: DomainPattern): string {
  return `${p.template} — ${p.matching} of ${p.examples} known ${p.examples === 1 ? 'address' : 'addresses'} at ${domain} use it`
}
