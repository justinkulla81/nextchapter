import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { EXCLUDE_MID_LEVEL_WHERE, emailSafeJobs, midLevelInEmails, midLevelRelevantFor } from '@/lib/jobs/mid-level'
import { boardLevelWindowWhere } from '@/lib/jobs/board-shortlist'
import { screenImportedJob } from '@/lib/jobs/import-screen'
import { SENIORITY_GROUPS, levelsInGroup, seniorityGroupOf, screenJobTitle } from '@/lib/jobs/job-seniority'

describe('mid-level tier', () => {
  it('imports mid-level professional roles; level I is entry-level, clinical coordinators stay out', () => {
    expect(screenImportedJob('Data Scientist', 'Louisville, KY')).toMatchObject({ keep: true, level: 'MID_IC' })
    // Unmarked analyst/engineer titles read 2-5 years (2026-10-15).
    expect(screenImportedJob('Financial Analyst', 'Louisville, KY')).toMatchObject({ keep: true, level: 'EARLY_IC' })
    expect(screenImportedJob('Software Engineer', 'Remote')).toMatchObject({ keep: true, level: 'EARLY_IC' })
    expect(screenImportedJob('Software Engineer I', 'Remote')).toMatchObject({ keep: true, level: 'ENTRY_IC' })
    expect(screenImportedJob('Marketing Coordinator', 'Remote')).toMatchObject({ keep: true, level: 'ENTRY_IC' })
    expect(screenImportedJob('Patient Coordinator', 'Remote').keep).toBe(false)
    // Other feeds keep the manager floor unless they ask for less.
    expect(screenJobTitle('Financial Analyst').keep).toBe(false)
  })

  it('has a Mid-level seniority group', () => {
    expect(SENIORITY_GROUPS.map((g) => g.key)).toContain('MID_LEVEL')
    expect(seniorityGroupOf('MID_IC')).toBe('MID_LEVEL')
    expect(levelsInGroup('MID_LEVEL')).toEqual(['MID_IC'])
  })

  it('shows mid-level jobs to manager, senior-individual, unknown-level and pivoting members only', () => {
    expect(midLevelRelevantFor({ highestLevelReached: 'IC' })).toBe(true)
    expect(midLevelRelevantFor({ highestLevelReached: 'Manager' })).toBe(true)
    expect(midLevelRelevantFor({ highestLevelReached: null })).toBe(true)
    expect(midLevelRelevantFor({ highestLevelReached: 'Director' })).toBe(false)
    expect(midLevelRelevantFor({ highestLevelReached: 'DIRECTOR' })).toBe(false)
    expect(midLevelRelevantFor({ highestLevelReached: 'VP' })).toBe(false)
    expect(midLevelRelevantFor({ highestLevelReached: 'C-Suite' })).toBe(false)
    // Directors see two levels down; changing careers adds one more, reaching mid-level.
    expect(midLevelRelevantFor({ highestLevelReached: 'Director', isPivoting: true })).toBe(true)
    expect(midLevelRelevantFor({ highestLevelReached: 'Manager', isPivoting: true })).toBe(true)
  })

  it('leaves mid-level jobs out of the board query unless asked for', () => {
    const where = { createdAt: { gte: new Date(0) } }
    const levels = (w: ReturnType<typeof boardLevelWindowWhere>) =>
      (((w.AND as object[])[1] as { OR: { level: { in?: string[] } | null }[] }).OR[1].level as { in: string[] }).in
    expect((boardLevelWindowWhere(where).AND as object[])[0]).toBe(where)
    expect(levels(boardLevelWindowWhere(where))).not.toContain('MID_IC')
    expect(levels(boardLevelWindowWhere(where, { includeMidLevel: true }))).toContain('MID_IC')
    expect(levels(boardLevelWindowWhere(undefined))).toContain('VP')
    expect(EXCLUDE_MID_LEVEL_WHERE).toBeDefined()
  })

  it('keeps mid-level jobs out of emails while MID_LEVEL_IN_EMAILS is off', () => {
    const jobs = [{ id: 'a', level: 'MID_IC' }, { id: 'b', level: 'MANAGER' }, { id: 'c', level: null }]
    expect(midLevelInEmails({})).toBe(false)
    expect(midLevelInEmails({ MID_LEVEL_IN_EMAILS: '1' })).toBe(false)
    expect(emailSafeJobs(jobs, {}).map((j) => j.id)).toEqual(['b', 'c'])
    expect(midLevelInEmails({ MID_LEVEL_IN_EMAILS: 'true' })).toBe(true)
    expect(emailSafeJobs(jobs, { MID_LEVEL_IN_EMAILS: 'true' }).map((j) => j.id)).toEqual(['a', 'b', 'c'])
  })

  it('every email job path asks for mid-level only behind the flag and filters its results', () => {
    for (const file of ['src/lib/jobs/fresh-job-alerts.ts', 'src/lib/job-search-daily/build.ts', 'src/lib/coach/weekly-digest.ts']) {
      const src = readFileSync(file, 'utf8')
      expect(src, file).toContain('includeMidLevel: midLevelInEmails()')
      expect(src, file).toContain('emailSafeJobs(')
    }
  })
})
