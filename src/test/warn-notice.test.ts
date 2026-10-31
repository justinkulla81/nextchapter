import { describe, expect, it } from 'vitest'
import { buildNotices, longDate, noticeDeadline, noticeProblems, type NoticeInput } from '@/lib/tools/warn-notice'

const base: NoticeInput = {
  company: 'Acme Corp',
  siteName: 'Dayton Plant',
  siteAddress: '100 Main St, Dayton, OH 45402',
  contactName: 'Pat Lee, HR Director',
  contactPhone: '555-0100',
  action: 'closing',
  duration: 'permanent',
  entirePlant: true,
  firstSeparation: '2027-01-15',
  schedule: 'The remaining separations will follow in two stages, on February 1 and March 1, 2027.',
  positions: [{ title: 'Machine operator', count: 40 }, { title: 'Shift supervisor', count: 6 }],
  bumping: false,
  unionName: '',
  unionOfficer: '',
  unionOfficerAddress: '',
  noticeDate: '2026-11-10',
}

describe('WARN notice drafts', () => {
  it('formats dates and finds the 60-day deadline', () => {
    expect(longDate('2027-01-15')).toBe('January 15, 2027')
    expect(longDate('2027-02-30')).toBe('2027-02-30')
    expect(noticeDeadline('2027-01-15')).toBe('2026-11-16')
    expect(noticeDeadline('2027-01-15', 90)).toBe('2026-10-17')
    expect(noticeDeadline('nonsense')).toBeNull()
    expect(noticeDeadline('2027-02-30')).toBeNull()
  })

  it('names every item the regulation requires in the employee notice', () => {
    const { employee } = buildNotices(base)
    expect(employee).toContain('expected to be permanent')
    expect(employee).toContain('The entire plant will close.')
    expect(employee).toContain('January 15, 2027')
    expect(employee).toContain('[individual separation date]')
    expect(employee).toContain('No bumping rights exist')
    expect(employee).toContain('Pat Lee, HR Director, 555-0100')
  })

  it('gives the government notice job titles, counts and the union line', () => {
    const { government } = buildNotices(base)
    expect(government).toContain('- Machine operator: 40 employees')
    expect(government).toContain('- Shift supervisor: 6 employees')
    expect(government).toContain('46 employees in all')
    expect(government).toContain('No union represents the affected employees.')
    expect(government).toContain('100 Main St, Dayton, OH 45402')
  })

  it('writes a union notice only when a union represents the employees', () => {
    expect(buildNotices(base).union).toBeNull()
    const withUnion = buildNotices({ ...base, unionName: 'UAW Local 12', unionOfficer: 'Dana Ruiz', unionOfficerAddress: '9 Labor Way, Dayton, OH' })
    expect(withUnion.union).toContain('UAW Local 12')
    expect(withUnion.union).toContain('[names of the 40 workers in this position]')
    expect(withUnion.government).toContain('Chief elected officer: Dana Ruiz, 9 Labor Way, Dayton, OH')
  })

  it('describes a temporary mass layoff without saying the plant closes', () => {
    const { employee } = buildNotices({ ...base, action: 'layoff', duration: 'temporary', entirePlant: false, bumping: true })
    expect(employee).toContain('a reduction in force')
    expect(employee).toContain('expected to be temporary')
    expect(employee).not.toContain('entire plant')
    expect(employee).toContain('Bumping rights exist')
  })

  it('lists what is missing before drafting', () => {
    expect(noticeProblems(base)).toEqual([])
    const problems = noticeProblems({ ...base, company: '', contactPhone: '', firstSeparation: '', positions: [{ title: '', count: 0 }], unionName: 'UAW' })
    expect(problems.join(' ')).toContain('company name')
    expect(problems.join(' ')).toContain('phone number')
    expect(problems.join(' ')).toContain('first separation')
    expect(problems.join(' ')).toContain('job title')
    expect(problems.join(' ')).toContain('chief elected officer')
  })
})
