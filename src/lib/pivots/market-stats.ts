// Nightly market aggregates behind pivot paths (PivotMarketStat).
//
// Reads the live board's narrow copy (BoardLightRow) in pages of PAGE_SIZE by
// id, plus jobs archived in the last 180 days (they still count as postings for
// the trend windows), and counts per pivot role x geography x level band:
// open now, open and low-competition, new postings in the last 30/90 days and
// the windows before, and the median posted pay. Then replaces the table in one
// transaction. Members' pages read a handful of these rows — never the board.
//
// The aggregation itself (aggregateMarketRows) is pure and unit-tested.

import { inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { scoreCompetition } from '@/lib/jobs/competition'
import { annualizePay, statesFromLocation } from '@/lib/pay/market-pay'
import { classifyLocation } from '@/lib/jobs/us-location'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { ROLES, titleVariants } from './pivot-map'
import type { Band, MarketStatRow } from './scoring'

export interface MarketInputRow {
  id: string
  title: string
  companyName: string | null
  location: string | null
  level: string | null
  sourceCategory: string | null
  sourceCount: number | null
  postedAt: Date | null
  createdAt: Date
  salaryMin: number | null
  salaryMax: number | null
  /** Null = still live on the board. */
  archivedAt: Date | null
  /** For a generic title ("Director"), the role read from the description (rebuild-market-stats). */
  roleHint?: string | null
}

const DAY = 86_400_000

/** The board's level rung (job-seniority) to a pivot band; unknown rungs read the title. */
export function bandForRow(level: string | null, title: string): Band {
  switch (level) {
    // Early-career postings (career-stage.ts) are individual roles too.
    case 'ENTRY_IC':
    case 'EARLY_IC':
    case 'MID_IC':
    case 'SENIOR_IC':
    case 'PRINCIPAL':
      return 'IC'
    case 'MANAGER':
    case 'SR_MANAGER':
      return 'MANAGER'
    case 'DIRECTOR':
    case 'HEAD':
    case 'SCHOOL_LEADER':
      return 'DIRECTOR'
    case 'VP':
    case 'EVP_SVP':
    case 'C_SUITE':
    case 'PARTNER':
    case 'CHIEF_OF_STAFF':
    case 'BOARD':
      return 'EXEC'
  }
  const inferred = inferLevelFromTitle(title)
  if (inferred === 'Manager') return 'MANAGER'
  if (inferred === 'Director') return 'DIRECTOR'
  if (inferred === 'VP' || inferred === 'C-Suite') return 'EXEC'
  return 'IC'
}

const ROLE_LIST = [...ROLES.values()]

/** Pivot roles whose title patterns match this title. */
export function rolesForTitle(title: string): string[] {
  const out = new Set<string>()
  // The title as written first; "Director, Finance"-style titles also read the part after the comma.
  for (const t of titleVariants(title)) {
    for (const r of ROLE_LIST) if (r.titles.test(t)) out.add(r.key)
    if (out.size) break
  }
  return [...out]
}

interface Acc {
  openNow: number
  lowCompetitionOpen: number
  new30: number
  prior30: number
  new90: number
  prior90: number
  pays: number[]
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/** Median pay is only stored with at least this many posted salaries in the cell. */
export const MIN_PAY_SAMPLE = 10

/**
 * Pure aggregation. Every row counts toward geography 'US' (when it is a US or
 * unknown-location job), 'REMOTE' when remote, and each state its location
 * names; and toward role '*' (all jobs) plus every pivot role its title matches.
 */
export function aggregateMarketRows(rows: MarketInputRow[], now: Date): MarketStatRow[] {
  const t = now.getTime()
  // Live jobs per employer, the size proxy competition.ts uses.
  const companyLive = new Map<string, number>()
  for (const r of rows) {
    if (r.archivedAt || !r.companyName) continue
    const k = normalizeOrgName(r.companyName)
    companyLive.set(k, (companyLive.get(k) ?? 0) + 1)
  }

  const acc = new Map<string, Acc>()
  const bump = (key: string): Acc => {
    let a = acc.get(key)
    if (!a) {
      a = { openNow: 0, lowCompetitionOpen: 0, new30: 0, prior30: 0, new90: 0, prior90: 0, pays: [] }
      acc.set(key, a)
    }
    return a
  }

  for (const r of rows) {
    if (classifyLocation(r.location) === 'non_us') continue
    const { states, isRemote } = statesFromLocation(r.location)
    const geos = ['US', ...(isRemote ? ['REMOTE'] : []), ...states]
    const band = bandForRow(r.level, r.title)
    const byTitle = rolesForTitle(r.title)
    const roles = ['*', ...(byTitle.length ? byTitle : r.roleHint ? [r.roleHint] : [])]
    const live = r.archivedAt === null
    const age = (t - (r.postedAt ?? r.createdAt).getTime()) / DAY
    const low =
      live &&
      scoreCompetition(
        { sourceCategory: r.sourceCategory, location: r.location, postedAt: r.postedAt, createdAt: r.createdAt, sourceCount: r.sourceCount },
        r.companyName ? (companyLive.get(normalizeOrgName(r.companyName)) ?? 0) : 0,
        now
      ).level === 'low'
    const pay = live ? annualizePay(r.salaryMin, r.salaryMax, null) : null

    for (const role of roles) {
      for (const geo of geos) {
        const a = bump(`${role}|${geo}|${band}`)
        if (live) {
          a.openNow++
          if (low) a.lowCompetitionOpen++
          if (pay) a.pays.push(pay.mid)
        }
        if (age >= 0 && age < 30) a.new30++
        else if (age >= 30 && age < 60) a.prior30++
        if (age >= 0 && age < 90) a.new90++
        else if (age >= 90 && age < 180) a.prior90++
      }
    }
  }

  const out: MarketStatRow[] = []
  for (const [key, a] of acc) {
    const [roleKey, geo, band] = key.split('|')
    const payP50 = a.pays.length >= MIN_PAY_SAMPLE ? median(a.pays) : null
    out.push({
      roleKey,
      geo,
      band,
      openNow: a.openNow,
      lowCompetitionOpen: a.lowCompetitionOpen,
      new30: a.new30,
      prior30: a.prior30,
      new90: a.new90,
      prior90: a.prior90,
      payP50,
      paySample: a.pays.length,
    })
  }
  return out
}
