// A company's outlook: Building, Steady, Cooling or Not enough data, from public records and our own hiring data,
// with the evidence listed. Pure. It never reads the company's industry or area into the score (a company is not
// blamed for its industry); those are shown beside it as context.
//
// Scored: layoff notices (a notice in the last 12 months caps the label at Cooling), capital raised and federal
// contract awards in the last 12 months, and a hiring pace (roles opened in the last 90 days against roles open now).
// The hiring trend over time is left out until our history is long enough (180 days); this is level and pace only.
// Fewer than two sources with data is "Not enough data".

export type CompanyOutlookLabel = 'Building' | 'Steady' | 'Cooling' | 'Not enough data'
export interface CompanyOutlook { label: CompanyOutlookLabel; evidence: string[] }

export interface CompanyOutlookInput {
  /** WARN notices filed in the last 12 months, and in the 12 months before that. */
  layoffs12: number
  layoffs12to24: number
  /** SEC events in the last 12 months. */
  fundraises12: number
  /** Federal contract awards in the last two years and the latest start date. */
  federal: { awards: number; latestStart: Date | null } | null
  /** Our hiring data: null when we do not track the company. */
  hiring: { openNow: number; opened90d: number } | null
  now?: number
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

export function companyOutlook(x: CompanyOutlookInput): CompanyOutlook {
  const now = x.now ?? Date.now()
  const evidence: string[] = []
  let score = 0
  let sources = 0

  if (x.hiring && x.hiring.openNow >= 1) {
    sources++
    const pace = x.hiring.openNow >= 3 && x.hiring.opened90d >= Math.max(3, Math.round(x.hiring.openNow * 0.3))
    if (pace) score += 1
    evidence.push(`${plural(x.hiring.openNow, 'open professional role', 'open professional roles')}, ${x.hiring.opened90d.toLocaleString('en-US')} opened in the last 90 days`)
  }
  const layoffs = x.layoffs12 + x.layoffs12to24
  if (layoffs > 0) {
    sources++
    if (x.layoffs12 > 0) { score -= 2; evidence.push(`${plural(x.layoffs12, 'layoff notice', 'layoff notices')} filed in the last 12 months`) }
    else { score -= 1; evidence.push(`${plural(x.layoffs12to24, 'layoff notice', 'layoff notices')} filed 12 to 24 months ago`) }
  } else if (x.hiring) {
    evidence.push('No layoff notices on record in the last 24 months')
  }
  if (x.fundraises12 > 0) {
    sources++
    score += 1
    evidence.push(`Capital raised, filed with the SEC in the last 12 months (${x.fundraises12.toLocaleString('en-US')} ${x.fundraises12 === 1 ? 'filing' : 'filings'})`)
  }
  if (x.federal && x.federal.awards > 0 && x.federal.latestStart && now - x.federal.latestStart.getTime() <= 365 * 86_400_000) {
    sources++
    score += 1
    evidence.push(`${plural(x.federal.awards, 'federal contract award', 'federal contract awards')} in the last two years, the latest in ${x.federal.latestStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`)
  }

  if (sources < 2) return { label: 'Not enough data', evidence }
  if (x.layoffs12 > 0 || score <= -2) return { label: 'Cooling', evidence }
  return { label: score >= 2 ? 'Building' : 'Steady', evidence }
}
