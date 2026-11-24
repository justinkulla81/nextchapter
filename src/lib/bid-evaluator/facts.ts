/**
 * NextChapter's own facts a bid or grant response needs, and the reusable answers (content library).
 *
 * Pure: definitions and parsers only. Values live in BidCompanyFact / BidContentBlock (admin only), never in the repo.
 * A fact left blank is UNKNOWN to the evaluator: it never fails a gate on a guess, it says which fact is missing.
 */

export type FactKind = 'text' | 'longtext' | 'date' | 'money' | 'number' | 'choice' | 'states'

export interface FactDef {
  key: string
  label: string
  group: 'Identity' | 'Registrations' | 'Insurance' | 'Security' | 'Money' | 'Track record' | 'Certifications'
  kind: FactKind
  options?: string[]
  help?: string
}

export const FACT_DEFS: FactDef[] = [
  { key: 'legalName', label: 'Legal name', group: 'Identity', kind: 'text' },
  { key: 'entityType', label: 'Entity type', group: 'Identity', kind: 'choice', options: ['C corporation', 'LLC', 'S corporation', 'Other'] },
  { key: 'incorporationState', label: 'State of incorporation', group: 'Identity', kind: 'text', help: 'Two letters, e.g. DE' },
  { key: 'incorporatedOn', label: 'Date incorporated', group: 'Identity', kind: 'date', help: 'Years in business is worked out from this.' },
  { key: 'address', label: 'Business address', group: 'Identity', kind: 'text' },
  { key: 'ein', label: 'EIN', group: 'Identity', kind: 'text' },
  { key: 'signer', label: 'Who signs (name and title)', group: 'Identity', kind: 'text' },
  { key: 'headcount', label: 'Employees (full-time / part-time)', group: 'Identity', kind: 'text' },

  { key: 'samUei', label: 'SAM.gov UEI', group: 'Registrations', kind: 'text', help: 'Blank = not registered. Federal money and most federal flow-through need it.' },
  { key: 'samExpires', label: 'SAM registration expires', group: 'Registrations', kind: 'date' },
  { key: 'statesRegistered', label: 'States registered to do business or as a vendor', group: 'Registrations', kind: 'states', help: 'Two-letter codes, comma separated.' },
  { key: 'etplStates', label: 'States where a program is on the training provider list (ETPL)', group: 'Registrations', kind: 'states' },

  { key: 'insGeneral', label: 'General liability (per occurrence / aggregate)', group: 'Insurance', kind: 'text', help: 'e.g. 1000000/2000000. Blank = none.' },
  { key: 'insProfessional', label: 'Professional / E&O liability', group: 'Insurance', kind: 'money' },
  { key: 'insCyber', label: 'Cyber liability', group: 'Insurance', kind: 'money' },
  { key: 'insWorkersComp', label: 'Workers’ compensation', group: 'Insurance', kind: 'choice', options: ['Yes', 'No'] },
  { key: 'insAuto', label: 'Hired / non-owned auto', group: 'Insurance', kind: 'money' },

  { key: 'soc2', label: 'SOC 2', group: 'Security', kind: 'choice', options: ['None', 'In progress', 'Type I', 'Type II'] },
  { key: 'soc2Date', label: 'SOC 2 report date (or expected)', group: 'Security', kind: 'date' },
  { key: 'vpat', label: 'Accessibility conformance report (VPAT) on file', group: 'Security', kind: 'choice', options: ['Yes', 'No'] },
  { key: 'securityNotes', label: 'Security and data handling summary', group: 'Security', kind: 'longtext' },

  { key: 'cashFloat', label: 'Most we can spend before being reimbursed', group: 'Money', kind: 'money', help: 'Cost-reimbursement contracts pay after you spend.' },
  { key: 'minContract', label: 'Smallest contract worth a full response', group: 'Money', kind: 'money' },
  { key: 'rateHourly', label: 'Hourly rate', group: 'Money', kind: 'money' },
  { key: 'rateDaily', label: 'Daily rate', group: 'Money', kind: 'money' },
  { key: 'pricePerParticipant', label: 'Price per participant (training and coaching)', group: 'Money', kind: 'money' },
  { key: 'pricePlatform', label: 'Platform price (per seat or per program)', group: 'Money', kind: 'text' },
  { key: 'pilotPrice', label: 'Pilot price', group: 'Money', kind: 'money' },
  { key: 'financials', label: 'Financial statements available', group: 'Money', kind: 'choice', options: ['Audited', 'Reviewed', 'Internal only', 'None'] },

  { key: 'references', label: 'References (past 5 years): organization, contact, service, term, value', group: 'Track record', kind: 'longtext' },
  { key: 'pastPerformance', label: 'Results so far (participants, placements, skill gains)', group: 'Track record', kind: 'longtext' },
  { key: 'keyStaff', label: 'Key staff: name, role, background', group: 'Track record', kind: 'longtext' },

  { key: 'certifications', label: 'Business certifications held (HUB, WOSB, MBE, VOSB...)', group: 'Certifications', kind: 'text', help: 'Blank = none.' },
  { key: 'smallBusiness', label: 'Small business (SBA size standard)', group: 'Certifications', kind: 'choice', options: ['Yes', 'No'] },
  { key: 'debarred', label: 'Ever debarred or suspended', group: 'Certifications', kind: 'choice', options: ['No', 'Yes'] },
  { key: 'bankruptcy7y', label: 'Bankruptcy in the past 7 years', group: 'Certifications', kind: 'choice', options: ['No', 'Yes'] },
  { key: 'litigation', label: 'Litigation or contract terminations to disclose', group: 'Certifications', kind: 'longtext', help: 'Write "None" if none.' },
]

export interface LibraryDef { key: string; label: string; help: string }

/** Reusable answers. The completer quotes these; it never invents a claim that is not in a fact or a block. */
export const LIBRARY_DEFS: LibraryDef[] = [
  { key: 'orgDescription', label: 'Organization description', help: 'Who NextChapter is, in a paragraph.' },
  { key: 'approachDislocated', label: 'Approach: professionals and dislocated workers', help: 'How we serve laid-off managers and professionals.' },
  { key: 'trainingOffer', label: 'Training: AI reskilling courses', help: 'Courses, length, format, credentials, how skill gain is measured.' },
  { key: 'softwareOffer', label: 'Software: layoff-response platform', help: 'Program workspace, sign-up page, seats, reporting.' },
  { key: 'coachingOffer', label: 'Coaching', help: 'Who coaches, how sessions run, how many.' },
  { key: 'outcomes', label: 'Measuring and reporting results', help: 'What we count and report to a board or state.' },
  { key: 'accessibility', label: 'Accessibility', help: 'Disability, limited English, low digital literacy.' },
  { key: 'dataPrivacy', label: 'Data handling and privacy', help: 'Where data lives, who sees it, consent.' },
  { key: 'partnering', label: 'Working with boards, job centers and colleges', help: 'Where we fit beside their case management.' },
]

export type Facts = Record<string, string>

export const isKnown = (f: Facts, key: string) => !!f[key]?.trim()

/** Dollars from "$1,000,000", "1M", "500k", "1000000/2000000" (takes the first). Null when absent or unreadable. */
export function parseMoney(raw: string | null | undefined): number | null {
  if (!raw) return null
  const m = /\$?\s*([\d,]+(?:\.\d+)?)\s*([kKmM]|million|thousand)?/.exec(raw.split('/')[0])
  if (!m) return null
  let n = parseFloat(m[1].replace(/,/g, ''))
  const unit = (m[2] ?? '').toLowerCase()
  if (unit === 'k' || unit === 'thousand') n *= 1_000
  if (unit === 'm' || unit === 'million') n *= 1_000_000
  return Number.isFinite(n) ? n : null
}

/** The aggregate of "per occurrence / aggregate", or the single figure. */
export function parseAggregate(raw: string | null | undefined): number | null {
  if (!raw) return null
  const parts = raw.split('/')
  return parseMoney(parts[parts.length - 1]) ?? parseMoney(parts[0])
}

export function parseStates(raw: string | null | undefined): string[] {
  return (raw ?? '').toUpperCase().split(/[^A-Z]+/).filter((s) => s.length === 2)
}

/** Whole years since incorporation; null when the date is not set. */
export function yearsInBusiness(f: Facts, now: Date): number | null {
  const d = f.incorporatedOn ? new Date(f.incorporatedOn) : null
  if (!d || Number.isNaN(d.getTime())) return null
  return Math.floor((now.getTime() - d.getTime()) / (365.25 * 86_400_000))
}

const SOC2_RANK: Record<string, number> = { none: 0, 'in progress': 1, 'type i': 2, 'type ii': 3 }
export function soc2Rank(f: Facts): number | null {
  const v = f.soc2?.trim().toLowerCase()
  return v ? SOC2_RANK[v] ?? null : null
}

/** Facts the completer flags as missing for a draft. */
export function missingFacts(f: Facts, keys: string[]): FactDef[] {
  return FACT_DEFS.filter((d) => keys.includes(d.key) && !isKnown(f, d.key))
}
