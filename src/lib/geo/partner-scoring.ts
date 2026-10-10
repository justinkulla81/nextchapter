/**
 * Internal fit scoring (0-100) for the bodies we sell to or through:
 * WIOA boards, American Job Centers, EDA districts, state agencies,
 * local EDOs and economic-development / workforce nonprofits.
 *
 * One scale for all of them so they sort together, built from parts that each
 * answer a plain question and each carry a note saying why. Every number comes
 * from a stored field; a part with no data scores a neutral 40% of its maximum
 * and lowers `coverage`, so an unresearched lead can't outrank a researched one
 * on ignorance alone.
 *
 * Colleges are scored by src/lib/workforce/college-score.ts, which takes the
 * college facts from CollegeProfile.
 *
 * The weights are judgement calls and live in one place (WEIGHTS) so they can
 * be changed without touching the callers.
 */

export interface ScorePart { key: string; label: string; points: number; max: number; note: string; known: boolean }
export interface FitScore { total: number; coverage: number; parts: ScorePart[] }

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)
/** 0 at `lo`, 1 at `hi`, on a log scale. */
export const logScale = (v: number | null | undefined, lo: number, hi: number): number | null =>
  v == null || !(v > 0) ? null : clamp01((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)))
export const linScale = (v: number | null | undefined, lo: number, hi: number): number | null =>
  v == null || !Number.isFinite(v) ? null : clamp01((v - lo) / (hi - lo))
const UNKNOWN = 0.4

function part(key: string, label: string, max: number, frac: number | null, note: string): ScorePart {
  const known = frac !== null
  return { key, label, max, known, points: Math.round(max * (known ? frac! : UNKNOWN) * 10) / 10, note }
}
function finish(parts: ScorePart[]): FitScore {
  const total = Math.round(parts.reduce((s, p) => s + p.points, 0))
  const coverage = Math.round((parts.filter((p) => p.known).reduce((s, p) => s + p.max, 0) / parts.reduce((s, p) => s + p.max, 0)) * 100) / 100
  return { total, coverage, parts }
}

// ── Partners (boards, job centers, districts, agencies, EDOs, nonprofits) ───

export interface AreaSignal {
  whiteCollarShare?: number | null
  laborForce?: number | null
  layoffs12mo?: number | null
  layoffs90d?: number | null
  wcUnemploymentEst?: number | null
}
export type PartnerKind = 'WIOA_BOARD' | 'STATE_BOARD' | 'AJC' | 'EDD' | 'STATE_AGENCY' | 'LOCAL_EDO' | 'NONPROFIT_ECON' | 'NONPROFIT_WORKFORCE' | 'CHAMBER'
export interface PartnerInput {
  kind: PartnerKind
  area: AreaSignal
  hasName: boolean
  hasEmail: boolean
  hasPhone: boolean
  hasWebsite: boolean
  /** AJC only: comprehensive / affiliate / specialized, and whether a business-services contact is listed. */
  ajcType?: string | null
  hasBusinessRep?: boolean
  /** Nonprofits only. */
  revenue?: number | null
  name?: string
  /** The strongest contact we have there: hot / warm (a lot) or any (a little). Counts outside the 100. */
  contact?: 'hot' | 'warm' | 'any' | null
}
/** Same values as college-score.ts CONTACT_POINTS. */
const CONTACT_POINTS = { hot: 25, warm: 20, any: 5 } as const

/** How directly this kind of body can act on a displaced professional (0-1). */
const KIND_MISSION: Record<PartnerKind, { v: number; why: string }> = {
  WIOA_BOARD: { v: 1.0, why: 'Dislocated-worker services and Rapid Response are statutory for a local board' },
  STATE_BOARD: { v: 0.8, why: 'Sets state policy and funds Rapid Response, but delivery is local' },
  AJC: { v: 0.7, why: 'The front door where laid-off workers actually walk in' },
  EDD: { v: 0.6, why: 'Regional planner; reaches employers and local government, not workers directly' },
  STATE_AGENCY: { v: 0.7, why: 'Runs state business-retention and layoff-response programs' },
  LOCAL_EDO: { v: 0.55, why: 'Knows the area\'s employers; layoff response is secondary to recruitment' },
  NONPROFIT_ECON: { v: 0.5, why: 'Economic-development nonprofit; mission varies' },
  NONPROFIT_WORKFORCE: { v: 0.6, why: 'Workforce nonprofit; often youth or low-income focused' },
  CHAMBER: { v: 0.45, why: 'Member employers, little direct worker service' },
}
const LOW_FIT_NAME = /\b(youth|teen|veteran|disab|blind|deaf|homeless|ex-?offender|reentry|refugee|immigrant|farm|migrant|apprentice|trades?|construction|culinary)\b/i
const HIGH_FIT_NAME = /\b(professional|executive|career transition|dislocated|manag|white.?collar|engineer|technology|tech\b|business)\b/i

export function scorePartner(i: PartnerInput): FitScore {
  const a = i.area
  const wc = linScale(a.whiteCollarShare, 0.28, 0.55)
  const lay = logScale(a.layoffs12mo, 50, 10_000)
  const reach = wc !== null && lay !== null ? 0.6 * wc + 0.4 * lay : wc ?? lay
  const isNonprofit = i.kind.startsWith('NONPROFIT') || i.kind === 'CHAMBER'
  const sizeFrac = isNonprofit ? logScale(i.revenue, 250_000, 100_000_000) : logScale(a.laborForce, 20_000, 3_000_000)

  let mission = KIND_MISSION[i.kind].v
  let missionNote = KIND_MISSION[i.kind].why
  if (i.kind === 'AJC') {
    const t = (i.ajcType ?? '').toLowerCase()
    mission = t.startsWith('comp') ? 1 : t.startsWith('aff') ? 0.7 : 0.45
    if (i.hasBusinessRep) mission = Math.min(1, mission + 0.1)
    missionNote = `${i.ajcType ?? 'Job center'}${i.hasBusinessRep ? ', lists a business-services rep' : ''}`
  } else if (isNonprofit && i.name) {
    if (LOW_FIT_NAME.test(i.name)) { mission = Math.min(mission, 0.3); missionNote = 'Name suggests a youth, veteran, disability or trades focus' }
    else if (HIGH_FIT_NAME.test(i.name)) { mission = Math.min(1, mission + 0.3); missionNote = 'Name suggests professional or career-transition work' }
  }

  // Contact details help a little (10 of 100); a warm contact in the CRM helps a lot (+20 outside the 100).
  const contact = (i.hasName ? 4 : 0) + (i.hasEmail ? 3 : 0) + (i.hasPhone ? 1.5 : 0) + (i.hasWebsite ? 1.5 : 0)
  const lay90 = logScale(a.layoffs90d, 25, 3_000)
  const wcu = linScale(a.wcUnemploymentEst, 0.02, 0.06)
  const timing = lay90 !== null && wcu !== null ? 0.6 * lay90 + 0.4 * wcu : lay90 ?? wcu

  return finish([
    part('whiteCollar', 'Reach to white-collar workers', 35, reach, a.whiteCollarShare != null ? `${Math.round(a.whiteCollarShare * 100)}% of workers in the area are professional; ${a.layoffs12mo ?? 0} laid off in 12 months` : 'No area data'),
    part('scale', isNonprofit ? 'Budget' : 'Size of workforce served', 25, sizeFrac, isNonprofit ? (i.revenue ? `$${(i.revenue / 1e6).toFixed(1)}M revenue` : 'Revenue unknown') : (a.laborForce ? `${a.laborForce.toLocaleString()} in the labor force` : 'No area data')),
    part('mission', 'Mission fit', 20, mission, missionNote),
    { key: 'reach', label: 'Contact details', max: 10, known: true, points: contact, note: [i.hasName && 'named contact', i.hasEmail && 'email', i.hasPhone && 'phone', i.hasWebsite && 'website'].filter(Boolean).join(', ') || 'No contact info' },
    part('timing', 'Timing', 10, timing, `${a.layoffs90d ?? 0} laid off in the last 90 days`),
    // Outside the 100 and outside coverage: a warm contact beats anything the public data says.
    { key: 'relationship', label: 'Contact in the CRM', max: 0, known: true, points: i.contact ? CONTACT_POINTS[i.contact] : 0,
      note: i.contact === 'any' ? 'Someone in the CRM works there' : i.contact ? 'A warm contact in the CRM' : 'No contact in the CRM' },
  ])
}
