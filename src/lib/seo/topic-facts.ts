// Turns the numbers behind an industry or function page into sourced facts and a data-built opening paragraph.
// Pure. Every fact names its source and period; nothing here claims AI caused an outcome, and estimates say so.

import { OCCUPATION_TRENDS, OCCUPATION_TRENDS_SOURCE } from '@/lib/market/occupation-trends-data'
import { CES_SERIES_BY_BUCKET } from '@/lib/market/bls-industry-trends'
import { AEI_OBSERVED_EXPOSURE, AEI_SOURCE } from '@/lib/market/aei-observed-exposure'
import type { GroupWage } from '@/lib/market/bls-wages'
import { FUNCTION_SOC_GROUP } from '@/lib/seo/topics'
import type { Fact } from '@/lib/seo/topic-quality'
import type { ConfSummary, JobStats, TopicNotice } from '@/lib/seo/topic-data'

const OWN_JOBS = 'NextChapter job data'
const usd = (n: number) => `$${n.toLocaleString('en-US')}`
const n0 = (n: number) => n.toLocaleString('en-US')
const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function jobFacts(total: number, s: JobStats | null, checkedNote = 'jobs verified live in the last 7 days'): Fact[] {
  const f: Fact[] = []
  if (total > 0) f.push({ key: 'open', label: 'Verified open jobs', value: `about ${n0(total)}`, source: OWN_JOBS, period: checkedNote })
  if (!s) return f
  const basis = `newest ${n0(s.sample)} verified open jobs`
  if (s.p50) f.push({ key: 'pay', label: 'Typical posted salary', value: `${usd(s.p50)} a year (middle half ${usd(s.p25!)} to ${usd(s.p75!)})`, source: `${OWN_JOBS}: salary ranges employers posted, midpoint of each range`, period: `${n0(s.paid)} of the ${basis}` })
  f.push({ key: 'entry', label: 'Entry or early-career level', value: `${s.entryPct}% of openings`, source: `${OWN_JOBS}: level read from the full posting`, period: basis })
  if (s.noExperiencePct > 0) f.push({ key: 'noexp', label: 'Say no experience is needed', value: `${s.noExperiencePct}% of openings`, source: `${OWN_JOBS}: phrase detected in the posting`, period: basis })
  f.push({ key: 'ai-skill', label: 'Ask for AI skills', value: `${s.aiSkillPct}% of openings`, source: `${OWN_JOBS}: AI-skill tagger on the posting text`, period: basis })
  f.push({ key: 'remote', label: 'Remote', value: `${s.remotePct}% of openings`, source: OWN_JOBS, period: basis })
  return f
}

const CES_LABEL: Record<string, string> = {
  CES5500000001: 'financial activities', CES6000000001: 'professional and business services', CES5000000001: 'information', CES6562000001: 'health care and social assistance',
  CES3000000001: 'manufacturing', CES6561000001: 'educational services', CES4200000001: 'retail trade', CES7000000001: 'leisure and hospitality',
  CES4422000001: 'utilities', CES2000000001: 'construction', CES4300000001: 'transportation and warehousing', CES9000000001: 'government',
}

export function trendFact(trend: { yoyPct: number; asOf: string } | undefined, bucket?: string): Fact | null {
  if (!trend) return null
  const sector = bucket ? CES_LABEL[CES_SERIES_BY_BUCKET[bucket] ?? ''] : undefined
  const [y, m] = trend.asOf.split('-')
  const period = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { key: 'ces', label: 'Employment, year over year', value: `${trend.yoyPct >= 0 ? '+' : '−'}${Math.abs(trend.yoyPct)}%${sector ? ` in ${sector}, the closest BLS sector` : ' in the closest BLS sector'}`, source: 'BLS Current Employment Statistics, seasonally adjusted payroll employment', period }
}

export function exposureFacts(fn: string, wages: Record<string, GroupWage> = {}): Fact[] {
  const code = FUNCTION_SOC_GROUP[fn]
  const row = code ? OCCUPATION_TRENDS.find((r) => r.socGroup === code) : null
  if (!row) return []
  const aei = AEI_OBSERVED_EXPOSURE[code]
  const wage = wages[code]
  const src = `${OCCUPATION_TRENDS_SOURCE.title}, ${OCCUPATION_TRENDS_SOURCE.edition}`
  return [
    ...(wage ? [{ key: 'wage', label: `Median annual wage, ${row.name} occupations`, value: usd(wage.median), source: 'BLS Occupational Employment and Wage Statistics, national, all industries', period: `May ${wage.year}` }] : []),
    ...(aei ? [{ key: 'aei', label: `Observed AI exposure, ${row.name} occupations`, value: `${Math.round(aei.exposure * 100)}% of tasks show work-related Claude usage (average across ${aei.occupations} occupations)`, source: `${AEI_SOURCE.title}, ${AEI_SOURCE.published}: coverage of tasks, not job loss`, period: 'estimate' }] : []),
    { key: 'exposure', label: `AI task exposure, closest group (${row.name})`, value: `${row.aiExposure} out of 100: what AI could do in principle, not a measured job loss`, source: `${src}; Eloundou et al. (2024) task-exposure score`, period: 'estimate' },
    { key: 'emp-change', label: `Employment change, ${row.name}`, value: `${row.employmentChangePct >= 0 ? '+' : '−'}${Math.abs(row.employmentChangePct)}% from 2022 to 2026`, source: `${src}, Census CPS (NextChapter calculation)`, period: 'January to August, 2022 and 2026' },
    { key: 'long-search', label: `Unemployed 27+ weeks, last job in ${row.name}`, value: `${row.longSearchSharePct}% of unemployed people`, source: `${src}, Census CPS (NextChapter calculation)`, period: `January to August 2026, ${n0(row.respondents)} respondents` },
  ]
}

export function layoffFacts(notices: TopicNotice[], scope: string): Fact[] {
  if (notices.length === 0) return []
  const workers = notices.reduce((s, n) => s + (n.workers ?? 0), 0)
  const states = new Map<string, number>()
  for (const n of notices) states.set(n.state, (states.get(n.state) ?? 0) + 1)
  const top = [...states].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, c]) => `${s} (${c})`).join(', ')
  const biggest = [...notices].filter((n) => n.workers).sort((a, b) => b.workers! - a.workers!)[0]
  const f: Fact[] = [
    { key: 'warn', label: `WARN layoff notices, ${scope}`, value: `${n0(notices.length)} notices${workers ? ` naming ${n0(workers)} workers` : ''}`, source: 'State WARN filings collected by NextChapter', period: 'last 12 months' },
    { key: 'warn-states', label: 'States with the most notices', value: top, source: 'State WARN filings collected by NextChapter', period: 'last 12 months' },
    { key: 'warn-latest', label: 'Most recent notice', value: shortDay(notices[0].noticeDate), source: 'State WARN filings collected by NextChapter' },
  ]
  if (biggest) f.push({ key: 'warn-biggest', label: 'Largest single notice', value: `${biggest.employer}, ${n0(biggest.workers!)} workers (${shortDay(biggest.noticeDate)})`, source: 'State WARN filings collected by NextChapter', period: 'last 12 months' })
  return f
}

export function conferenceFacts(c: ConfSummary, scope: string): Fact[] {
  if (c.total === 0) return []
  const f: Fact[] = [{ key: 'confs', label: `Conferences in the catalog for ${scope}`, value: `${n0(c.total)}, ${n0(c.upcoming)} with dates announced`, source: 'NextChapter conference catalog, checked against each event’s own site' }]
  if (c.next[0]) f.push({ key: 'confs-next', label: 'Next conference', value: `${c.next[0].name}, ${shortDay(c.next[0].start)}`, source: 'NextChapter conference catalog' })
  if (c.medianCost) f.push({ key: 'confs-cost', label: 'Median published ticket price', value: usd(c.medianCost), source: 'NextChapter conference catalog, lowest published price', period: `${n0(c.costed)} conferences with a price` })
  if (c.cfpOpen > 0) f.push({ key: 'confs-cfp', label: 'Open calls for speakers', value: `${n0(c.cfpOpen)} ${c.cfpOpen === 1 ? 'conference' : 'conferences'}`, source: 'NextChapter conference catalog' })
  return f
}

/** An opening paragraph built from the page's own numbers, so no two pages share it. */
export function openingParagraph(opts: { name: string; kind: 'industry' | 'function'; blurb: string; total: number; stats: JobStats | null; trend?: { yoyPct: number; asOf: string }; notices: number; confs: number; upcomingConfs: number }): string {
  const { name, blurb, total, stats, trend, notices, confs, upcomingConfs } = opts
  const parts: string[] = [blurb]
  if (total > 0) {
    const pay = stats?.p50 ? `, with a typical posted salary of ${usd(stats.p50)} a year` : ''
    const entry = stats ? ` About ${stats.entryPct}% of openings are entry or early-career level.` : ''
    parts.push(`${name} has about ${n0(total)} verified open jobs on NextChapter right now${pay}.${entry}`)
  }
  if (trend) parts.push(`Payroll employment in the closest BLS sector is ${trend.yoyPct >= 0 ? 'up' : 'down'} ${Math.abs(trend.yoyPct)}% over the past year (${monthYear(`${trend.asOf}-01`)}).`)
  if (notices > 0) parts.push(`${n0(notices)} WARN layoff notices were filed in the last 12 months.`)
  if (confs > 0) parts.push(`${n0(confs)} conferences are tagged to it${upcomingConfs ? `, ${n0(upcomingConfs)} with dates announced` : ''}.`)
  return parts.join(' ')
}
