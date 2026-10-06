import { isKnowledgeWork, naicsSector } from './sector'

/**
 * The workforce board view: each local board with the layoffs filed in its
 * area — which companies, how many jobs, when — for outreach to the board
 * that runs Rapid Response there.
 */

export interface ReportBoard {
  id: string
  state: string
  name: string
  serviceArea: string | null
  directorName: string | null
  chairName: string | null
}

export interface ReportNotice {
  id: string
  workforceBoardId: string | null
  employer: string
  normalizedEmployer: string
  employees: number | null
  noticeDate: Date | null
  effectiveDate: Date | null
  companyId: string | null
  sourceUrl: string | null
  /** A company-wide count (layoffs.fyi, a press announcement) placed at the
   * headquarters city, not a filing for jobs in this board's area. */
  companyWide: boolean
  /** As the state publishes it ("54 Professional …"); null in most states. */
  industry?: string | null
}

/** layoffs.fyi rows and announcements count the whole company, not one site. */
export function isCompanyWide(n: { source: string; sourceUrl: string | null }): boolean {
  return n.source !== 'WARN_FILING' || /layoffs\.fyi/i.test(n.sourceUrl ?? '')
}

export interface ReportCompany {
  key: string
  employer: string
  companyId: string | null
  notices: number
  jobs: number
  /** True when at least one notice gave no headcount, so `jobs` is a floor. */
  jobsUnknown: boolean
  latestFiled: Date | null
  firstEffective: Date | null
  lastEffective: Date | null
  sourceUrl: string | null
  /** Every notice for it is a company-wide report rather than a state filing. */
  companyWide: boolean
  /** Two-digit NAICS sector, where the state publishes one. */
  sector: string | null
}

export interface ReportRow<B extends ReportBoard> {
  board: B
  companies: ReportCompany[]
  notices: number
  /** Jobs in state WARN filings for this area. */
  jobs: number
  /** Company-wide counts reported for companies headquartered here — kept apart, since they are not local. */
  reportedJobs: number
  /** Filed jobs whose sector the state published, and how many of those are white collar. */
  sectorJobs: number
  knowledgeJobs: number
  latestFiled: Date | null
  /** The soonest effective date still ahead — when the next people leave. */
  nextEffective: Date | null
  /** The search matched a company here, not the board itself. */
  matchedCompany: boolean
}

export type ReportSort = 'jobs' | 'recent' | 'name'

const later = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b)
const earlier = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a < b ? a : b)
const norm = (s: string | null | undefined) => (s ?? '').toLowerCase()

export function buildBoardReport<B extends ReportBoard>(
  boards: B[],
  notices: ReportNotice[],
  opts: { q?: string; sort?: ReportSort; dir?: 'asc' | 'desc'; includeEmpty?: boolean; now?: Date },
): ReportRow<B>[] {
  const now = opts.now ?? new Date()
  const q = norm(opts.q).trim()
  const byBoard = new Map<string, ReportNotice[]>()
  for (const n of notices) {
    if (!n.workforceBoardId) continue
    byBoard.set(n.workforceBoardId, [...(byBoard.get(n.workforceBoardId) ?? []), n])
  }

  const rows: ReportRow<B>[] = []
  for (const board of boards) {
    const list = byBoard.get(board.id) ?? []
    if (!list.length && !opts.includeEmpty) continue

    // One line per company: a company that filed for three sites is one employer to call about.
    const companies = new Map<string, ReportCompany>()
    for (const n of list) {
      const key = n.companyId ?? n.normalizedEmployer
      const c = companies.get(key) ?? {
        key, employer: n.employer, companyId: n.companyId, notices: 0, jobs: 0, jobsUnknown: false,
        latestFiled: null, firstEffective: null, lastEffective: null, sourceUrl: n.sourceUrl, companyWide: true, sector: null,
      }
      c.sector ??= naicsSector(n.industry)
      if (!n.companyWide) c.companyWide = false
      c.notices++
      if (n.employees == null) c.jobsUnknown = true
      else c.jobs += n.employees
      if (n.noticeDate && (!c.latestFiled || n.noticeDate > c.latestFiled)) { c.latestFiled = n.noticeDate; c.sourceUrl = n.sourceUrl ?? c.sourceUrl }
      c.firstEffective = earlier(c.firstEffective, n.effectiveDate)
      c.lastEffective = later(c.lastEffective, n.effectiveDate)
      companies.set(key, c)
    }
    const companyList = [...companies.values()].sort((a, b) => (b.latestFiled?.getTime() ?? 0) - (a.latestFiled?.getTime() ?? 0))

    const boardHit = !q || [board.name, board.state, board.serviceArea, board.directorName, board.chairName].some((f) => norm(f).includes(q))
    const companyHit = !!q && companyList.some((c) => norm(c.employer).includes(q))
    if (!boardHit && !companyHit) continue

    rows.push({
      board,
      companies: companyList,
      notices: list.length,
      jobs: list.reduce((s, n) => s + (n.companyWide ? 0 : n.employees ?? 0), 0),
      reportedJobs: list.reduce((s, n) => s + (n.companyWide ? n.employees ?? 0 : 0), 0),
      sectorJobs: list.reduce((s, n) => s + (!n.companyWide && naicsSector(n.industry) ? n.employees ?? 0 : 0), 0),
      knowledgeJobs: list.reduce((s, n) => s + (!n.companyWide && isKnowledgeWork(n.industry) ? n.employees ?? 0 : 0), 0),
      latestFiled: companyList.reduce<Date | null>((d, c) => later(d, c.latestFiled), null),
      nextEffective: list.reduce<Date | null>((d, n) => (n.effectiveDate && n.effectiveDate >= now ? earlier(d, n.effectiveDate) : d), null),
      matchedCompany: !boardHit && companyHit,
    })
  }

  const sort = opts.sort ?? 'jobs'
  const dir = opts.dir ?? (sort === 'name' ? 'asc' : 'desc')
  const sign = dir === 'asc' ? 1 : -1
  rows.sort((a, b) => {
    const by =
      sort === 'name' ? a.board.name.localeCompare(b.board.name)
      : sort === 'recent' ? (a.latestFiled?.getTime() ?? 0) - (b.latestFiled?.getTime() ?? 0)
      : a.jobs - b.jobs
    return by * sign || a.board.name.localeCompare(b.board.name)
  })
  return rows
}
