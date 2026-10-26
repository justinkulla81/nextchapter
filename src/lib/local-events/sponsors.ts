// Pulls company names out of an event's title and description: the employer in "Cooper Standard Hiring Event" or "Caltrans – Engineering Career
// Event", and the names after "sponsored by" / "Sponsors:". Pure and rule-based (no model calls). The importer links a name only when it matches a
// company exactly (normalized), so a wrong guess here costs nothing.

const EVENT_WORDS = '(?:hiring (?:event|day|fair|blitz)|career (?:fair|event|day|expo)|job (?:fair|expo)|recruiting (?:event|day)|open house|information session|info session|virtual (?:hiring|career|job))'
const GENERIC = /^(?:the|our|a|an|this|annual|spring|summer|fall|winter|virtual|online|in[- ]person|free|local|community|regional|county|city|state|national|career|job|hiring|hybrid|open|public|veterans?|military|student|students|women|spring|expo)$/i

const clean = (s: string) => s.replace(/[“”"*]/g, '').replace(/\s+/g, ' ').replace(/^[\s:–—-]+|[\s:–—,.-]+$/g, '').trim()
const plausible = (s: string) => {
  if (s.length < 3 || s.length > 60) return false
  if (!/[A-Z]/.test(s[0])) return false
  const words = s.split(' ')
  if (words.length > 6) return false
  return !words.every((w) => GENERIC.test(w))
}

export function extractCompanies(title: string, description = ''): { sponsors: string[]; employers: string[] } {
  const employers = new Set<string>()
  const sponsors = new Set<string>()

  // "<Company> Hiring Event", "<Company> – Engineering Career Event", "<Company>: Hiring Day"
  const lead = title.match(new RegExp(`^(.{3,70}?)\\s*(?:[–—:|-]\\s*(?:[^–—:|-]{0,40}?)\\s*)?${EVENT_WORDS}\\b`, 'i'))
  if (lead) {
    const name = clean(lead[1].split(/\s[–—-]\s|:\s/)[0])
    if (plausible(name)) employers.add(name)
  }
  // "Hiring Event with <Company>", "Career Fair hosted by <Company>"
  const tail = title.match(new RegExp(`${EVENT_WORDS}\\s+(?:with|at|by|hosted by|presented by)\\s+(.{3,60})$`, 'i'))
  if (tail) { const name = clean(tail[1]); if (plausible(name)) employers.add(name) }

  const text = `${title}. ${description.slice(0, 1500)}`
  for (const m of text.matchAll(/(?:sponsored|presented|underwritten|supported|brought to you) by:?\s+([^.;\n]{3,160})/gi)) {
    for (const part of m[1].split(/,|\band\b|&|\|/)) { const name = clean(part); if (plausible(name)) sponsors.add(name) }
  }
  for (const m of text.matchAll(/\b(?:our )?sponsors?:\s+([^.\n]{3,200})/gi)) {
    for (const part of m[1].split(/,|\band\b|&|\|/)) { const name = clean(part); if (plausible(name)) sponsors.add(name) }
  }
  return { sponsors: [...sponsors].slice(0, 12), employers: [...employers].slice(0, 6) }
}
