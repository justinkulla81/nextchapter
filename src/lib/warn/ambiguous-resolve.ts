import { normalizeOrgName } from '@/lib/text/org-name-match'

// A WARN employer name often carries a site, a division or a legal tail ("Uber Technologies, Inc. - 200 Mathilda Place",
// "Kaiser Foundation Hospitals and Kaiser Foundation Health Plan, Inc."). The loose matcher finds the company inside the name, but
// substring containment also finds "Meta" inside "Metallics". This decides which loose matches are the same company, on whole words:
// the candidate's name must be the start of the employer's name, and what follows it must be a site, a place after a separator, or
// a plain descriptor. It is an allowlist: anything it does not recognise stays for a person.

export type Candidate = { id: string; name: string }
export type Resolution =
  | { kind: 'match'; id: string; name: string }
  | { kind: 'new' }
  | { kind: 'review' }

/** Words that follow a company name without changing which company it is. */
const DESCRIPTORS = new Set([
  'services', 'service', 'operations', 'operation', 'maintenance', 'group', 'groups', 'holdings', 'holding', 'foundation', 'hospitals', 'hospital',
  'health', 'plan', 'campus', 'store', 'stores', 'america', 'usa', 'us', 'technologies', 'technology', 'systems',
  'solutions', 'international', 'worldwide', 'global', 'enterprises', 'industries', 'partners', 'and', 'dba',
])
const SITE_WORDS = new Set(['campus', 'store', 'plant', 'center', 'facility', 'warehouse', 'hotel'])
const LINKS = new Set(['of', 'for', 'at', 'in', 'and', 'on', 'by', 'from'])
const LEGAL = new Set(['inc', 'incorporated', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'company', 'co', 'plc', 'lp', 'llp', 'pllc', 'pc'])

const decode = (s: string) => s.replace(/&amp;/gi, '&').replace(/&#39;/g, "'")
const stem = (w: string) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)
/** Filing notes that ride on a name without being part of it: "UPDATE", "*Updated*", "- Revised", "Revision 1", "Total WARN:". */
const NOTES = /^\s*\*?\s*updated?\s*\*?\s*[-–:]?\s*|\s*[-–]?\s*(revised|revision\s*\d+)\s*$|\s*total warn:?\s*$/gi
const prep = (raw: string) => decode(raw).replace(NOTES, '').toLowerCase().replace(/^the\s+/, '').replace(/[.'’]/g, '')

type Tok = { w: string; end: number }
function tokens(raw: string): Tok[] {
  const out: Tok[] = []
  for (const m of prep(raw).matchAll(/[a-z0-9]+/g)) out.push({ w: stem(m[0]), end: m.index! + m[0].length })
  return out
}
function stripLegal(t: Tok[]): Tok[] {
  const out = [...t]
  while (out.length > 1 && LEGAL.has(out[out.length - 1].w)) out.pop()
  return out
}

/** How many leading words of the employer the candidate covers, or 0 when the candidate is not the start of the employer's name. */
function prefixLength(employer: string, candidate: string): number {
  const e = tokens(employer)
  const c = stripLegal(tokens(candidate))
  if (c.length === 0 || c.length > e.length) return 0
  for (let i = 0; i < c.length; i++) if (e[i].w !== c[i].w) return 0
  const rest = e.slice(c.length)
  if (rest.length === 0) return c.length
  const tail = prep(employer).slice(e[c.length - 1].end)
  // A site or place set off by a separator: "Intel Corporation - SC-9", "Oracle (Pleasanton Campus)", "Uber Technologies, Inc. - 200 Mathilda".
  if (/^\s*([(,:/]|\s[-–—]\s)/.test(tail)) return c.length
  const body = rest.filter((t) => !LEGAL.has(t.w))
  // A site code on a hyphen: "Amazon-BWI1".
  if (/^-\S/.test(tail) && rest.length === 1 && /\d/.test(rest[0].w)) return c.length
  // A street address straight after the name: "Uber Technologies, Inc. 1725 3rd Street".
  if (body.length > 0 && /^\d/.test(body[0].w)) return c.length
  // A single-word name needs more than a descriptor or two to be sure it is the same company.
  if (body.every((t) => DESCRIPTORS.has(t.w)) && (c.length > 1 || body.length <= 2)) return c.length
  // A place after a descriptor: "Oracle Pleasanton Campus".
  if (body.length <= 3 && body.some((t) => SITE_WORDS.has(t.w))) return c.length
  // A division or site of a multi-word company: "Georgia-Pacific Gypsum LLC". Not when the tail names a place or a different owner.
  if (c.length >= 2 && body.length <= 2 && !body.some((t) => LINKS.has(t.w))) return c.length
  return 0
}

/** The same test the other way round: the filing names the company in short ("Temco Logistics") and the record carries the site. */
const covers = (employer: string, candidate: string) => prefixLength(candidate, employer)

export function resolveAmbiguous(employer: string, candidates: Candidate[]): Resolution {
  const scored = candidates.map((c) => ({ c, n: Math.max(prefixLength(employer, c.name), covers(employer, c.name)) })).filter((x) => x.n > 0)
  if (scored.length > 0) {
    const best = Math.max(...scored.map((x) => x.n))
    const top = scored.filter((x) => x.n === best)
    if (top.length === 1) return { kind: 'match', id: top[0].c.id, name: top[0].c.name }
    // Two records with the same words (a duplicate company) are not a safe pick; a merge belongs on the Review List.
    return { kind: 'review' }
  }
  // Nothing shares the employer's first word and none sits inside the name as whole words, so the loose match was only a
  // substring ("Meta" in "Metallics"): the employer is a new company.
  const et = tokens(employer)
  const joined = ' ' + et.map((t) => t.w).join(' ') + ' '
  const related = candidates.some((c) => {
    const ct = stripLegal(tokens(c.name))
    if (ct.length === 0) return false
    if (ct[0].w === et[0]?.w) return true
    if (joined.includes(' ' + ct.map((t) => t.w).join(' ') + ' ')) return true
    // The employer sits inside the candidate's name as whole words ("Natural Foods" inside "United Natural Foods").
    const cj = ' ' + tokens(c.name).map((t) => t.w).join(' ') + ' '
    return cj.includes(' ' + stripLegal(et).map((t) => t.w).join(' ') + ' ') || cj.replace(/ /g, '') === joined.replace(/ /g, '') || stripLegal(et).map((t) => t.w).join('') === ct.map((t) => t.w).join('')
  })
  if (!related && normalizeOrgName(employer).length > 0) return { kind: 'new' }
  return { kind: 'review' }
}
