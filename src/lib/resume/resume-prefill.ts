// Prefilling the profile from the member's résumé, without ever overwriting what
// they entered themselves.
//
// A field is filled from the résumé only when it is blank, or when it still holds
// an earlier résumé value the member hasn't confirmed (listed in
// CandidateProfile.resumePrefilledFields). Anything else — typed in onboarding,
// edited on the profile, or confirmed — is the member's and stays as it is.
// Filled fields are listed in resumePrefilledFields, so the profile shows
// "From your résumé — confirm" on them; confirming that section clears them.
//
// The detectors below are plain text rules (no LLM): clearance, work
// authorization and licenses only when the résumé states them outright, and a
// home city only from the contact header. The LLM fields (city, years, title,
// function, industry, education, keywords) come from the existing extraction
// call in extract-profile-fields.ts; nothing here adds a model call.

import { LICENSE_KEYS, type LicenseKey } from '@/lib/jobs/requirements'

export const PREFILL_FIELDS = [
  'currentCity',
  'currentState',
  'yearsExperience',
  'resumeLatestJobTitle',
  'primaryFunction',
  'industryContext',
  'highestEducationLevel',
  'resumeKeywords',
  'licensesHeld',
  'clearanceLevel',
  'workAuthorization',
] as const
export type PrefillField = (typeof PREFILL_FIELDS)[number]

/** Which fields each existing confirm form covers; confirming it clears their "from your résumé" marks. */
export const PREFILL_SECTIONS = {
  basics: ['currentCity', 'currentState'],
  function: ['resumeLatestJobTitle', 'yearsExperience', 'primaryFunction'],
  industry: ['industryContext'],
  education: ['highestEducationLevel'],
  keywords: ['resumeKeywords'],
  workAuth: ['workAuthorization'],
  screening: ['clearanceLevel', 'licensesHeld'],
} as const satisfies Record<string, readonly PrefillField[]>

/** The marks left after the member confirms (or edits) a section. */
export function withoutPrefill(current: readonly string[] | null | undefined, section: keyof typeof PREFILL_SECTIONS): string[] {
  const drop = new Set<string>(PREFILL_SECTIONS[section])
  return (current ?? []).filter((f) => !drop.has(f))
}

export type PrefillValues = {
  currentCity?: string | null
  currentState?: string | null
  yearsExperience?: number | null
  resumeLatestJobTitle?: string | null
  primaryFunction?: string | null
  industryContext?: string | null
  highestEducationLevel?: string | null
  resumeKeywords?: string[] | null
  licensesHeld?: string[] | null
  clearanceLevel?: string | null
  workAuthorization?: string | null
}

export type PrefillCurrent = Required<{ [K in keyof PrefillValues]: PrefillValues[K] | null }> & {
  resumePrefilledFields: string[]
  /** Set once the member answered the licenses question (even "none"): their answer stands. */
  licensesAnsweredAt: Date | null
}

const isBlank = (v: unknown) =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * What to write from the résumé: only fields that are blank or still an unconfirmed
 * résumé value, and only with a real value. Returns the update and the fields filled
 * (changed), plus the new marker list.
 */
export function planResumePrefill(
  current: PrefillCurrent,
  fromResume: PrefillValues
): { data: PrefillValues; filled: PrefillField[]; resumePrefilledFields: string[] } {
  const marked = new Set(current.resumePrefilledFields ?? [])
  const data: PrefillValues = {}
  const filled: PrefillField[] = []
  for (const field of PREFILL_FIELDS) {
    const next = fromResume[field]
    if (isBlank(next)) continue
    const now = current[field]
    // An answered licenses question is the member's, even when the answer was "none".
    if (field === 'licensesHeld' && current.licensesAnsweredAt) continue
    if (!isBlank(now) && !marked.has(field)) continue
    if (same(now, next)) continue
    ;(data as Record<string, unknown>)[field] = next
    filled.push(field)
    marked.add(field)
  }
  return { data, filled, resumePrefilledFields: [...marked] }
}

// ── Text rules ───────────────────────────────────────────────────────────────

// "able to obtain", "eligible for", "willing to get" a clearance is not holding one.
const NOT_HELD_BEFORE = /(obtain|eligib|able to (get|hold)|willing to|pursu|apply(ing)? for|in process|pending)[^.\n]{0,40}$/i

function heldMatch(text: string, re: RegExp): boolean {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  for (let m = g.exec(text); m; m = g.exec(text)) {
    const before = text.slice(Math.max(0, m.index - 60), m.index)
    if (!NOT_HELD_BEFORE.test(before)) return true
  }
  return false
}

/** The highest security clearance the résumé says the member holds, or null. */
export function detectClearance(text: string | null | undefined): 'ts_sci' | 'top_secret' | 'secret' | 'public_trust' | null {
  if (!text) return null
  if (heldMatch(text, /\bTS\s*\/\s*SCI\b/i)) return 'ts_sci'
  if (heldMatch(text, /\btop[\s-]secret\b(?=[^.\n]{0,30}\bclearance\b)|\b(clearance|cleared)\s*[:\-–(]?\s*top[\s-]secret\b|\bactive\s+top[\s-]secret\b/i)) return 'top_secret'
  if (heldMatch(text, /\bsecret\s+(security\s+)?clearance\b|\b(clearance|cleared)\s*[:\-–(]?\s*secret\b|\bactive\s+secret\b/i)) return 'secret'
  if (heldMatch(text, /\bpublic\s+trust\b(?=[^.\n]{0,30}\b(clearance|position|eligib|background)\b)|\b(clearance|cleared)\s*[:\-–(]?\s*public\s+trust\b/i)) return 'public_trust'
  return null
}

/** Work authorization, only when the résumé states it outright (values match the Screening form). */
export function detectWorkAuthorization(text: string | null | undefined): 'us_citizen' | 'permanent_resident' | 'work_authorized_no_sponsorship' | 'need_sponsorship' | null {
  if (!text) return null
  // "U.S. Citizenship and Immigration Services" is an employer, not a status.
  const US = String.raw`(?:U\.?\s?S\.?(?:A\.?)?|United States|American)`
  const OTHER = String.raw`(?:\s*(?:&|and|\/)\s*[A-Z][a-z]+)?`
  if (
    new RegExp(String.raw`\b${US}${OTHER}\s+citizen\b(?!ship)`, 'i').test(text) || // "US citizen", "US & Brazilian Citizen"
    new RegExp(String.raw`\b[A-Z][a-z]+\s*(?:&|and|\/)\s*${US}\s+citizen\b(?!ship)`).test(text) || // "Brazilian & US citizen"
    new RegExp(String.raw`\bcitizenship\s*[:\-–]\s*${US}\b`, 'i').test(text) // "Citizenship: US"
  ) {
    return 'us_citizen'
  }
  if (/\b(green card holder|lawful permanent resident|U\.?S\.? permanent resident)\b/i.test(text)) return 'permanent_resident'
  if (/\bauthori[sz]ed to work in the (U\.?S\.?|United States)\b[^.\n]{0,40}\b(without|no|not require)\b[^.\n]{0,20}\bsponsorship\b/i.test(text)) {
    return 'work_authorized_no_sponsorship'
  }
  if (/\b(will|would|do(es)?)\s+(require|need)\s+(visa\s+)?sponsorship\b|\brequires?\s+(H-?1B\s+|visa\s+)?sponsorship\b/i.test(text)) return 'need_sponsorship'
  return null
}

const LICENSE_FROM_CERT: Record<LicenseKey, RegExp> = {
  cpa: /^(CPA|Certified Public Accountant)\b/i,
  pe: /^(P\.?E\.?|Professional Engineer|Licensed Professional Engineer)\b/i,
  bar: /\b(bar admission|admitted to (the )?[A-Z][a-z]+( [A-Z][a-z]+)? bar|state bar)\b/i,
  rn: /^(RN|Registered Nurse)\b/i,
  pmp: /\b(PMP|Project Management Professional)\b/i,
  series_7: /\bSeries\s*7\b/i,
  series_24: /\bSeries\s*24\b/i,
  series_63: /\bSeries\s*63\b/i,
  series_65: /\bSeries\s*65\b/i,
  series_66: /\bSeries\s*66\b/i,
}
// In free text only the unambiguous phrasings count ("CPA" alone may be a firm the member worked at).
const LICENSE_FROM_TEXT: Partial<Record<LicenseKey, RegExp>> = {
  cpa: /\b(licensed|certified)\s+(CPA|public accountant)\b/i,
  pe: /\blicensed professional engineer\b/i,
  bar: /\b(admitted to (the )?[A-Z][a-z]+( [A-Z][a-z]+)? (state )?bar|member of the [A-Z][a-z]+( [A-Z][a-z]+)? (state )?bar)\b/,
  rn: /\bregistered nurse\b/i,
  pmp: /\b(PMP|Project Management Professional)\b/,
  series_7: /\bSeries\s*7\b/,
  series_24: /\bSeries\s*24\b/,
  series_63: /\bSeries\s*63\b/,
  series_65: /\bSeries\s*65\b/,
  series_66: /\bSeries\s*66\b/,
}

/** Licenses (requirement keys) named among the résumé's certifications or stated plainly in its text. */
export function detectLicenses(certifications: readonly string[], text: string | null | undefined): LicenseKey[] {
  const found = new Set<LicenseKey>()
  for (const key of LICENSE_KEYS) {
    if (certifications.some((c) => LICENSE_FROM_CERT[key].test(c.trim()))) found.add(key)
    const re = LICENSE_FROM_TEXT[key]
    if (text && re && re.test(text)) found.add(key)
  }
  return LICENSE_KEYS.filter((k) => found.has(k))
}

const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}
const STATE_NAMES = Object.values(STATES).sort((a, b) => b.length - a.length).join('|')
const CITY = "[A-Z][A-Za-z.'’-]+(?: [A-Z][A-Za-z.'’-]+){0,2}"
const HEADER_CITY_STATE = new RegExp(`(?:^|[|•·▫,\\n]\\s*|\\s{2,})(${CITY}),\\s*(${Object.keys(STATES).join('|')}|D\\.C\\.|${STATE_NAMES})\\b(?!\\s*\\d{4}\\b)`)

/**
 * Home city and state from the résumé's contact header (its first lines) only — a
 * job's location further down is where the member worked, not where they live.
 */
export function detectHomeLocation(text: string | null | undefined): { city: string; state: string } | null {
  if (!text) return null
  const header = text.slice(0, 400)
  // The header ends where the first section starts.
  const cut = header.search(/\b(EXPERIENCE|PROFESSIONAL EXPERIENCE|SUMMARY|PROFESSIONAL SUMMARY|PROFILE|EDUCATION|WORK HISTORY)\b/)
  const m = (cut > 0 ? header.slice(0, cut) : header).match(HEADER_CITY_STATE)
  if (!m) return null
  const city = m[1].trim()
  const raw = m[2].replace(/\./g, '')
  const state = raw.length === 2 ? raw.toUpperCase() : (Object.entries(STATES).find(([, n]) => n === raw)?.[0] ?? raw)
  return { city, state }
}
