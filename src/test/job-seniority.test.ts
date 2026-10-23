import { describe, expect, it } from 'vitest'
import { classifyTitleRung, levelForPosting, screenJobTitle, seniorityGroupOf } from '@/lib/jobs/job-seniority'
import { screenImportedJob } from '@/lib/jobs/import-screen'
import parity from './fixtures/job-seniority-parity.json'

describe('job seniority', () => {
  it('matches ncrawl (Python) on every parity title', () => {
    const mismatches = (parity as [string, string, number, boolean?][])
      .map(([title, rung, rank, schoolContext]) => ({ title, expected: `${rung} ${rank}`, got: classifyTitleRung(title, { schoolContext }) }))
      .filter((m) => `${m.got.rung} ${m.got.rank}` !== m.expected)
    expect(mismatches).toEqual([])
  })

  it('keeps manager-and-up and senior individual roles', () => {
    for (const title of ['Senior Software Engineer', 'Senior Product Manager', 'Manager, Product Management', 'Director of Finance', 'Senior Financial Analyst', 'Assistant Vice President, Credit Risk']) {
      expect(screenJobTitle(title).keep, title).toBe(true)
    }
  })

  it('places individual-contributor "Manager" titles by real seniority (2026-10-15)', () => {
    for (const title of ['Product Manager', 'Project Manager', 'Program Manager', 'Key Account Manager']) {
      expect(classifyTitleRung(title).rung, title).toBe('MID_IC')
    }
    for (const title of ['Account Manager', 'Customer Success Manager', 'Office Manager', 'Territory Manager']) {
      expect(classifyTitleRung(title).rung, title).toBe('EARLY_IC')
    }
    expect(classifyTitleRung('Senior Account Manager').rung).toBe('SENIOR_IC')
    for (const title of ['Manager, Engineering', 'Manager of Account Management', 'General Manager', 'Regional Account Manager']) {
      expect(classifyTitleRung(title).rank, title).toBeGreaterThanOrEqual(40)
    }
  })

  it('screens out entry-level and frontline work', () => {
    for (const title of ['Software Engineer II', 'Store Manager', 'Truck Driver', 'Marketing Coordinator', 'Cashier', 'Software Engineer, Intern']) {
      expect(screenJobTitle(title).keep, title).toBe(false)
    }
  })

  it('tags mid-level professional roles MID_IC, still below the manager floor', () => {
    for (const title of ['Data Scientist', 'Attorney', 'Sales Engineer', 'Senior Paralegal', 'Program Analyst (GS-12)']) {
      expect(classifyTitleRung(title).rung, title).toBe('MID_IC')
      expect(screenJobTitle(title).keep, title).toBe(false)
    }
    // Unmarked analyst / engineer / accountant titles read 2-5 years (2026-10-15); the
    // posting's years requirement lifts them to MID_IC.
    for (const title of ['Financial Analyst', 'Software Engineer', 'Accountant', 'Recruiter', 'UX Designer']) {
      expect(classifyTitleRung(title).rung, title).toBe('EARLY_IC')
      expect(screenJobTitle(title).keep, title).toBe(false)
    }
    // Level I / junior / associate professional titles are entry-level (ENTRY_IC), GS-9 early career.
    for (const title of ['Software Engineer I', 'Junior Accountant', 'Associate Consultant']) {
      expect(classifyTitleRung(title).rung, title).toBe('ENTRY_IC')
    }
    expect(classifyTitleRung('Contract Specialist (GS-9)').rung).toBe('EARLY_IC')
    for (const title of ['Help Desk Analyst', 'Police Officer (GS-11)']) {
      expect(classifyTitleRung(title).rung, title).toBe('OTHER')
    }
  })

  it('reads bare Superintendent as the district head only on a school board', () => {
    expect(screenJobTitle('Superintendent').keep).toBe(false)
    expect(screenJobTitle('Superintendent', { schoolContext: true })).toEqual({ keep: true, level: 'C_SUITE' })
    expect(screenJobTitle('Construction Superintendent', { schoolContext: true }).keep).toBe(false)
    expect(classifyTitleRung('Assistant Principal').rank).toBeLessThan(classifyTitleRung('Principal, Lincoln High School').rank)
    expect(classifyTitleRung('General Manager').rung).toBe('MANAGER')
    expect(classifyTitleRung('General Manager, Residential Products Business').rung).toBe('C_SUITE')
  })

  it('groups rungs for display', () => {
    expect(seniorityGroupOf('C_SUITE')).toBe('EXECUTIVE')
    expect(seniorityGroupOf('HEAD')).toBe('VP')
    expect(seniorityGroupOf('SENIOR_IC')).toBe('SENIOR_IC')
    expect(seniorityGroupOf('OTHER')).toBeNull()
    expect(seniorityGroupOf(null)).toBeNull()
  })

  it('levels the 2026-10-23 grade-ladder and early-career allowlists (parity titles cover the rest)', () => {
    expect(classifyTitleRung('Corporate Tax Senior Associate').rung).toBe('MID_IC')
    expect(classifyTitleRung('IT Audit/SOX - Experienced Associate').rung).toBe('EARLY_IC')
    expect(classifyTitleRung('Wealth Management Associate').rung).toBe('EARLY_IC')
    expect(classifyTitleRung('Assistant Project Manager').rung).toBe('EARLY_IC')
    for (const title of ['Senior Associate Director', 'Associate General Counsel']) expect(classifyTitleRung(title).rank, title).toBeGreaterThanOrEqual(40)
    for (const title of ['Associate Professor', 'Assistant Store Manager', 'Electrician Apprentice', 'Senior Sales Associate']) {
      expect(classifyTitleRung(title).rung, title).toBe('OTHER')
    }
  })

  it('puts an assistant project manager whose posting manages people back at MANAGER (import screen too)', () => {
    const people = 'You will supervise a team of 6 field staff. 3+ years of experience.'
    expect(levelForPosting('Assistant Project Manager', 'Own schedules and budgets. 2-4 years of experience.').rung).toBe('EARLY_IC')
    expect(levelForPosting('Assistant Project Manager', people).rung).toBe('MANAGER')
    const v = screenImportedJob('Assistant Project Manager', 'Austin, TX', { description: people })
    expect(v.keep && v.level).toBe('MANAGER')
  })

  it('lifts a GS-5/7 posting on the Pathways Recent Graduates hiring path (not the title)', () => {
    expect(classifyTitleRung('Inventory Management Specialist (GS-5/7)', { recentGraduate: true }).rung).toBe('ENTRY_IC')
    expect(classifyTitleRung('Contact Representative (GS-5/7)', { recentGraduate: true }).rung).toBe('OTHER')
    expect(classifyTitleRung('Social Science Research Analyst (GS-5/7)').rung).toBe('ENTRY_IC')
    expect(classifyTitleRung('Program Support Assistant (GS-5/7)').rung).toBe('OTHER')
  })
})
