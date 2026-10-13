/**
 * Can NextChapter pursue this, and how?
 *
 *   DIRECT       open to a for-profit / small business, or unrestricted.
 *   VIA_PARTNER  only a state, local government, college or nonprofit may apply
 *                — our customers and partners — and NextChapter can be backed
 *                in as the vendor or subrecipient that delivers the funded work.
 *   NOT_ELIGIBLE no route in at all (individuals, tribes only, set-asides we
 *                do not hold). Dropped; never shown, never scored.
 *   UNKNOWN      the notice does not say. Kept, flagged "unconfirmed".
 *
 * Pure: no network, no database. Grants.gov applicant-type codes are often just
 * "25 — Others" with the real answer in free text, so the text is read too,
 * sentence by sentence, with negation ("for-profits are not eligible").
 */

export type ApplicantKind =
  | 'STATE_GOV' | 'LOCAL_GOV' | 'HIGHER_ED' | 'NONPROFIT'
  | 'TRIBAL' | 'FOR_PROFIT' | 'SMALL_BUSINESS' | 'INDIVIDUAL' | 'UNRESTRICTED'

export type Eligibility = 'DIRECT' | 'VIA_PARTNER' | 'NOT_ELIGIBLE' | 'UNKNOWN'

export interface EligibilityResult {
  eligibility: Eligibility
  /** Every applicant kind the notice allows. */
  kinds: ApplicantKind[]
  /** For VIA_PARTNER: the partner kinds that could submit. */
  partnerKinds: ApplicantKind[]
  /** One plain line saying why. */
  note: string
}

/** What NextChapter is, for set-asides. Edit when a certification is obtained. */
export const NEXTCHAPTER_PROFILE = {
  smallBusiness: true,
  /** SAM.gov set-aside codes we qualify for beyond small business, e.g. 'WOSB'. */
  certifications: [] as string[],
}

const OPEN_TO_US: ApplicantKind[] = ['UNRESTRICTED', 'FOR_PROFIT', 'SMALL_BUSINESS']
const PARTNER_KINDS: ApplicantKind[] = ['STATE_GOV', 'LOCAL_GOV', 'HIGHER_ED', 'NONPROFIT']

/** Grants.gov applicant-type ids. */
const TYPE_ID: Record<string, ApplicantKind> = {
  '00': 'STATE_GOV',
  '01': 'LOCAL_GOV', '02': 'LOCAL_GOV', '04': 'LOCAL_GOV', '05': 'LOCAL_GOV', '08': 'LOCAL_GOV',
  '06': 'HIGHER_ED', '20': 'HIGHER_ED',
  '07': 'TRIBAL', '11': 'TRIBAL',
  '12': 'NONPROFIT', '13': 'NONPROFIT',
  '21': 'INDIVIDUAL',
  '22': 'FOR_PROFIT',
  '23': 'SMALL_BUSINESS',
  '99': 'UNRESTRICTED',
}

const TEXT_RULES: [ApplicantKind, RegExp][] = [
  ['STATE_GOV', /state workforce agenc|\bstate(s)?\b.{0,40}\b(agenc|government|department)|\bgovernors?\b|territor|outlying areas/i],
  ['LOCAL_GOV', /local workforce (development )?boards?|workforce development boards?|\bcount(y|ies)\b|municipalit|\bcit(y|ies)\b|local governments?|units? of (general )?local government|school districts?|american job center/i],
  ['HIGHER_ED', /institutions? of higher (education|learning)|universit|\bcolleges?\b/i],
  ['NONPROFIT', /non-?profit|501\(c\)|community[- ]based organization|faith[- ]based|\bCBOs?\b|labor organizations?|\bunions?\b/i],
  ['FOR_PROFIT', /for-?profit|private (sector )?(entit|organization|compan|firm)|commercial (organization|entit)|\bbusinesses\b|\bcompanies\b|\bvendors?\b/i],
  ['SMALL_BUSINESS', /small business/i],
  ['INDIVIDUAL', /individuals? (are|is|may be) eligible (to apply|applicants?)|applicants? (may|can) be individuals/i],
  ['TRIBAL', /\btribal\b|\btribes?\b|native hawaiian|native american|alaska native|indian (tribe|organization)/i],
  ['UNRESTRICTED', /unrestricted|any (entity|organi[sz]ation)|all (entities|organi[sz]ations)|open to (all|any)/i],
]

const NEGATION = /\bnot eligible\b|\bineligible\b|\bmay not\b|\bcannot\b|\bcan not\b|\bare not\b|\bis not\b|\bexcluded\b|\bnot permitted\b|\bnot allowed\b/i

export function applicantKindsFromGrant(typeIds: string[], text: string): ApplicantKind[] {
  const kinds = new Set<ApplicantKind>()
  for (const id of typeIds) {
    const k = TYPE_ID[id.trim().padStart(2, '0')]
    if (k) kinds.add(k)
  }
  const negated = new Set<ApplicantKind>()
  for (const sentence of text.split(/[.;\n]+/)) {
    const hits = TEXT_RULES.filter(([, re]) => re.test(sentence)).map(([k]) => k)
    for (const k of hits) (NEGATION.test(sentence) ? negated : kinds).add(k)
  }
  for (const k of negated) kinds.delete(k)
  return [...kinds]
}

export function classifyGrant(typeIds: string[], text: string): EligibilityResult {
  const kinds = applicantKindsFromGrant(typeIds, text)
  const open = kinds.filter((k) => OPEN_TO_US.includes(k))
  if (open.length) {
    return { eligibility: 'DIRECT', kinds, partnerKinds: [], note: 'Open to for-profit or unrestricted applicants: NextChapter can apply.' }
  }
  const partners = kinds.filter((k) => PARTNER_KINDS.includes(k))
  if (partners.length) {
    return {
      eligibility: 'VIA_PARTNER', kinds, partnerKinds: partners,
      note: `Only ${partners.map(label).join(', ')} can apply. NextChapter could be written in as the vendor or subrecipient.`,
    }
  }
  if (kinds.length) {
    return { eligibility: 'NOT_ELIGIBLE', kinds, partnerKinds: [], note: `Limited to ${kinds.map(label).join(', ')}: no route for NextChapter or its customers.` }
  }
  return { eligibility: 'UNKNOWN', kinds: [], partnerKinds: [], note: 'Eligibility not stated in the notice. Read it before pursuing.' }
}

/** SAM.gov set-aside code → can NextChapter bid? */
export function classifySetAside(code: string | null | undefined, description?: string | null): EligibilityResult {
  const c = (code ?? '').trim().toUpperCase()
  if (!c || c === 'NONE') {
    return { eligibility: 'DIRECT', kinds: ['UNRESTRICTED'], partnerKinds: [], note: 'Full and open competition.' }
  }
  if (c === 'SBA' || c === 'SBP') {
    return NEXTCHAPTER_PROFILE.smallBusiness
      ? { eligibility: 'DIRECT', kinds: ['SMALL_BUSINESS'], partnerKinds: [], note: 'Small-business set-aside: eligible if NextChapter meets the size standard for the NAICS code.' }
      : { eligibility: 'NOT_ELIGIBLE', kinds: ['SMALL_BUSINESS'], partnerKinds: [], note: 'Small-business set-aside; NextChapter is not a small business.' }
  }
  if (NEXTCHAPTER_PROFILE.certifications.map((x) => x.toUpperCase()).includes(c)) {
    return { eligibility: 'DIRECT', kinds: ['SMALL_BUSINESS'], partnerKinds: [], note: `Set-aside ${c}: NextChapter holds this certification.` }
  }
  return {
    eligibility: 'NOT_ELIGIBLE', kinds: [], partnerKinds: [],
    note: `Set aside for ${description?.trim() || c}: NextChapter does not hold this certification.`,
  }
}

const LABEL: Record<ApplicantKind, string> = {
  STATE_GOV: 'state agencies', LOCAL_GOV: 'local governments and workforce boards', HIGHER_ED: 'colleges and universities',
  NONPROFIT: 'nonprofits', TRIBAL: 'tribal organizations', FOR_PROFIT: 'for-profit organizations',
  SMALL_BUSINESS: 'small businesses', INDIVIDUAL: 'individuals', UNRESTRICTED: 'any organization',
}
export const label = (k: ApplicantKind) => LABEL[k]

/** The applicant kinds a CRM organization of these types can be. */
export function kindsForOrgTypes(orgTypes: string[]): ApplicantKind[] {
  const out = new Set<ApplicantKind>()
  for (const t of orgTypes) {
    if (t === 'GOVERNMENT') { out.add('STATE_GOV'); out.add('LOCAL_GOV') }
    else if (t === 'UNIVERSITY') out.add('HIGHER_ED')
    else if (t === 'NONPROFIT' || t === 'FOUNDATION') out.add('NONPROFIT')
  }
  return [...out]
}

/** Which kinds a pitch-deck customer type is. */
export function kindsForCustomerType(type: string): ApplicantKind[] {
  switch (type) {
    case 'HIGHER_ED': return ['HIGHER_ED']
    case 'ECON_DEV': return ['LOCAL_GOV', 'STATE_GOV', 'NONPROFIT']
    case 'WIOA_BOARD': return ['LOCAL_GOV']
    case 'WORKFORCE_NONPROFIT':
    case 'CHAMBER': return ['NONPROFIT']
    default: return []
  }
}

/**
 * Could this organization apply (or be the partner that applies)?
 * Unrestricted notices fit anyone; NOT_ELIGIBLE never matches.
 */
export function matchesOrgKinds(opp: { eligibility: Eligibility; kinds: ApplicantKind[] }, orgKinds: ApplicantKind[]): boolean {
  if (opp.eligibility === 'NOT_ELIGIBLE' || orgKinds.length === 0) return false
  if (opp.kinds.includes('UNRESTRICTED')) return true
  return opp.kinds.some((k) => orgKinds.includes(k))
}

const DAY = 86_400_000

/** Soonest real close date among matches, for the rank. Null when none is inside the window. */
export function nextCloseAmong(opps: { closesAt: Date | null }[], now: Date, withinDays = 60): Date | null {
  const horizon = now.getTime() + withinDays * DAY
  const dates = opps
    .map((o) => o.closesAt)
    .filter((d): d is Date => !!d && d.getTime() >= now.getTime() && d.getTime() <= horizon)
    .sort((a, b) => a.getTime() - b.getTime())
  return dates[0] ?? null
}
