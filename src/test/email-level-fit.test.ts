import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emailLevelFit } from '@/lib/jobs/email-level-fit'

// Cases from the 2026-10-19 level gate: real Job Search Daily picks that went to senior
// members at the wrong level (the board's seniority ring leaking into emails, and posts
// asking far fewer years than the member has).
const vp32 = { highestLevelReached: 'VP', yearsExperience: 32 }
const exec23 = { highestLevelReached: 'C-Suite', yearsExperience: 23 }
const exec15 = { highestLevelReached: 'Executive', yearsExperience: 15 }
const dir34 = { highestLevelReached: 'Director', yearsExperience: 34 }

describe('emailLevelFit', () => {
  it('drops a manager role sent to a VP (one level beyond the window: the board ring)', () => {
    expect(emailLevelFit(vp32, { level: 'MANAGER', description: 'Delivery Manager – Financial Services' })).toBe('below_window')
  })
  it('drops principal and senior-IC roles sent to executives', () => {
    expect(emailLevelFit(exec23, { level: 'PRINCIPAL', description: 'Requires 15+ years of experience in product.' })).toBe('below_window')
    expect(emailLevelFit(exec15, { level: 'SENIOR_IC', description: null })).toBe('below_window')
  })
  it('drops a post asking far fewer years than the member has (overqualified)', () => {
    expect(emailLevelFit(dir34, { level: 'HEAD', description: 'Minimum of 15 years of experience in finance.' })).toBe('years_overqualified')
    expect(emailLevelFit(vp32, { level: 'DIRECTOR', description: '5+ years of experience in public finance.' })).toBe('years_overqualified')
  })
  it('keeps a job at or near the member level', () => {
    expect(emailLevelFit(vp32, { level: 'VP', description: '20+ years of experience leading finance.' })).toBe('fits')
    expect(emailLevelFit(vp32, { level: 'DIRECTOR', description: '20+ years of experience.' })).toBe('fits')
    expect(emailLevelFit(exec23, { level: 'DIRECTOR', description: null })).toBe('fits') // director+ see two levels down
    expect(emailLevelFit(vp32, { level: null, description: null })).toBe('fits') // employer-posted, no level
  })
  it('drops a job asking far more years than the member has', () => {
    expect(emailLevelFit({ highestLevelReached: 'IC', yearsExperience: 2 }, { level: 'MID_IC', description: '8+ years of experience required.' })).toBe('years_far')
  })
})

describe('every job email applies the member level window without the board ring', () => {
  for (const file of ['src/lib/job-search-daily/build.ts', 'src/lib/jobs/fresh-job-alerts.ts', 'src/lib/coach/weekly-digest.ts']) {
    it(file, () => {
      const src = readFileSync(join(process.cwd(), file), 'utf8')
      expect(src).toMatch(/seniorityRing:\s*false/)
      expect(src).toMatch(/fitsMemberLevel\(/)
    })
  }
})
