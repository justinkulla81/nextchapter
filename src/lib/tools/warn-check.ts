// The federal WARN Act (29 U.S.C. 2101) coverage test, as a pure function for the public checker at
// /tools/warn-act-checker. Counts are full-time employees (part-time workers are not counted). It does not model
// the exceptions (unforeseeable business circumstances, faltering company, natural disaster), state laws, or
// aggregation across 90 days beyond what the user enters as one figure.

export interface WarnInput {
  /** Full-time employees across the whole employer. */
  employerFullTime: number
  /** Full-time employees at the single site affected. */
  siteFullTime: number
  /** Full-time employees at that site who lose their jobs within 30 days (or 90 days if aggregated). */
  lossesAtSite: number
  /** The site, facility or operating unit is shutting down. */
  isShutdown: boolean
}

export type WarnVerdict = 'not_covered_employer' | 'notice_likely_required' | 'notice_likely_not_required'

export interface WarnResult {
  verdict: WarnVerdict
  reasons: string[]
}

export function checkWarn(i: WarnInput): WarnResult {
  if (i.employerFullTime < 100) {
    return { verdict: 'not_covered_employer', reasons: ['The WARN Act generally covers employers with 100 or more full-time employees.'] }
  }
  const share = i.siteFullTime > 0 ? i.lossesAtSite / i.siteFullTime : 0
  if (i.isShutdown && i.lossesAtSite >= 50) {
    return { verdict: 'notice_likely_required', reasons: ['A plant closing: a site or operating unit shuts down and 50 or more full-time employees lose their jobs within 30 days.'] }
  }
  if (i.lossesAtSite >= 500) {
    return { verdict: 'notice_likely_required', reasons: ['A mass layoff: 500 or more full-time employees at one site lose their jobs within 30 days.'] }
  }
  if (i.lossesAtSite >= 50 && share >= 1 / 3) {
    return { verdict: 'notice_likely_required', reasons: [`A mass layoff: ${i.lossesAtSite} employees is 50 or more and at least one third (${Math.round(share * 100)}%) of the site’s full-time workforce.`] }
  }
  return {
    verdict: 'notice_likely_not_required',
    reasons: [
      i.isShutdown ? 'A shutdown counts as a plant closing only when 50 or more full-time employees lose their jobs.' : 'A layoff counts as a mass layoff at 500 or more employees, or at 50 to 499 when they are at least one third of the site’s full-time workforce.',
      'Losses that fall below the thresholds can still reach them when added together over 90 days.',
    ],
  }
}
