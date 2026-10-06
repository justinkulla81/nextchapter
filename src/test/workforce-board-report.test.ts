import { describe, expect, it } from 'vitest'
import { buildBoardReport, isCompanyWide, type ReportNotice } from '@/lib/workforce/board-report'

const board = (id: string, name: string, extra: Partial<{ state: string; serviceArea: string; directorName: string }> = {}) => ({
  id, name, state: extra.state ?? 'TX', serviceArea: extra.serviceArea ?? null, directorName: extra.directorName ?? null, chairName: null,
})
let seq = 0
const notice = (boardId: string, employer: string, employees: number | null, filed: string, effective?: string, companyWide = false): ReportNotice => ({
  id: String(++seq), workforceBoardId: boardId, employer, normalizedEmployer: employer.toLowerCase(), employees,
  noticeDate: new Date(filed), effectiveDate: effective ? new Date(effective) : null, companyId: null, sourceUrl: null, companyWide,
})

const boards = [
  board('dallas', 'Workforce Solutions Greater Dallas', { serviceArea: 'Dallas', directorName: 'Laura Ward' }),
  board('gulf', 'Gulf Coast Workforce Development Board', { serviceArea: 'Harris, Fort Bend' }),
  board('alamo', 'Workforce Solutions Alamo', { serviceArea: 'Bexar' }),
]
const notices = [
  notice('dallas', 'Acme Corp', 100, '2026-09-01', '2026-11-01'),
  notice('dallas', 'Acme Corp', 50, '2026-09-20', '2026-12-15'),
  notice('dallas', 'Beta LLC', null, '2026-08-01', '2026-10-01'),
  notice('gulf', 'Gamma Energy', 400, '2026-07-01', '2026-09-01'),
  notice('alamo', 'Delta Foods', 20, '2026-10-01', '2026-12-01'),
]
const now = new Date('2026-10-05')

describe('buildBoardReport', () => {
  it('rolls a board up by company: jobs, filings, effective range', () => {
    const [dallas] = buildBoardReport(boards, notices, { now, sort: 'name' }).filter((r) => r.board.id === 'dallas')
    expect(dallas.jobs).toBe(150)
    expect(dallas.notices).toBe(3)
    expect(dallas.companies.map((c) => c.employer)).toEqual(['Acme Corp', 'Beta LLC'])
    const acme = dallas.companies[0]
    expect(acme).toMatchObject({ notices: 2, jobs: 150, jobsUnknown: false })
    expect(acme.firstEffective?.toISOString().slice(0, 10)).toBe('2026-11-01')
    expect(acme.lastEffective?.toISOString().slice(0, 10)).toBe('2026-12-15')
    expect(dallas.companies[1]).toMatchObject({ jobs: 0, jobsUnknown: true })
    expect(dallas.latestFiled?.toISOString().slice(0, 10)).toBe('2026-09-20')
    // Beta's October 1 date has passed; the next people to leave are Acme's.
    expect(dallas.nextEffective?.toISOString().slice(0, 10)).toBe('2026-11-01')
  })

  it('sorts by job loss, recency or name, either way', () => {
    const ids = (o: Parameters<typeof buildBoardReport>[2]) => buildBoardReport(boards, notices, { now, ...o }).map((r) => r.board.id)
    expect(ids({ sort: 'jobs' })).toEqual(['gulf', 'dallas', 'alamo'])
    expect(ids({ sort: 'jobs', dir: 'asc' })).toEqual(['alamo', 'dallas', 'gulf'])
    expect(ids({ sort: 'recent' })).toEqual(['alamo', 'dallas', 'gulf'])
    expect(ids({ sort: 'name' })).toEqual(['gulf', 'alamo', 'dallas'])
  })

  it('searches boards, counties, contacts and companies', () => {
    const ids = (q: string) => buildBoardReport(boards, notices, { now, q }).map((r) => r.board.id)
    expect(ids('gulf')).toEqual(['gulf'])
    expect(ids('bexar')).toEqual(['alamo'])
    expect(ids('laura')).toEqual(['dallas'])
    expect(ids('acme')).toEqual(['dallas'])
    expect(buildBoardReport(boards, notices, { now, q: 'acme' })[0].matchedCompany).toBe(true)
    expect(ids('nothing like this')).toEqual([])
  })

  it('leaves out boards with no layoffs unless asked', () => {
    const quiet = [...boards, board('quiet', 'Quiet Board')]
    expect(buildBoardReport(quiet, notices, { now }).some((r) => r.board.id === 'quiet')).toBe(false)
    expect(buildBoardReport(quiet, notices, { now, includeEmpty: true }).some((r) => r.board.id === 'quiet')).toBe(true)
  })
})

describe('company-wide reports', () => {
  it('are told apart from state filings', () => {
    expect(isCompanyWide({ source: 'WARN_FILING', sourceUrl: 'https://layoffs.fyi/' })).toBe(true)
    expect(isCompanyWide({ source: 'MANUAL_ANNOUNCEMENT', sourceUrl: null })).toBe(true)
    expect(isCompanyWide({ source: 'WARN_FILING', sourceUrl: 'https://data.texas.gov/resource/x.json' })).toBe(false)
  })

  it('stay out of a board’s local job loss and its sort', () => {
    const withHq = [...notices, notice('alamo', 'Huge Co', 16000, '2026-09-01', undefined, true)]
    const rows = buildBoardReport(boards, withHq, { now, sort: 'jobs' })
    const alamo = rows.find((r) => r.board.id === 'alamo')!
    expect(alamo).toMatchObject({ jobs: 20, reportedJobs: 16000 })
    expect(alamo.companies.find((c) => c.employer === 'Huge Co')?.companyWide).toBe(true)
    expect(rows.map((r) => r.board.id)).toEqual(['gulf', 'dallas', 'alamo'])
  })
})
