import { describe, expect, it } from 'vitest'
import { analyzeResume, bandFor, teaserFor, RESUME_MIN_CHARS } from '@/lib/tools/resume-check'

const GOOD = `Jordan Rivera
jordan.rivera@example.com | (502) 555-0142 | Louisville, KY

Summary
Operations leader who cut fulfillment costs 18% and scaled a team from 12 to 40 across three sites.

Experience
Director of Operations, Brightline Logistics
2019 – Present
- Led a 40-person operations team across three distribution sites, raising on-time delivery from 91% to 98%
- Cut fulfillment cost per order by 18% ($2.1M a year) by renegotiating carrier contracts
- Built a weekly forecasting process that reduced overtime by 22%
- Launched a returns program that recovered $640K in resale value in its first year
- Hired and trained 14 supervisors and reduced turnover from 31% to 19%

Operations Manager, Harbor Supply
2014 – 2019
- Managed a $12M budget and 25 staff across two warehouses
- Implemented a warehouse management system that cut picking errors by 35%
- Negotiated 9 vendor contracts that saved $480K over three years
- Redesigned the shipping layout and shortened pick time by 27%

Education
B.S. Business Administration, University of Louisville, 2014

Skills
Supply chain, forecasting, vendor negotiation, P&L management, team leadership, SQL, Excel`

const WEAK = `I am a hard worker and team player looking for a new opportunity where I can grow.

Objective
To obtain a challenging position that uses my skills.

My Journey
Responsible for managing the daily duties of the office.
Worked on many different projects with the team.
Helped with customer questions and assisted with training new staff.
Duties included answering phones and filing paperwork.
I was tasked with ordering supplies and participated in meetings.
References available upon request.
Detail-oriented and self-motivated professional with strong communication skills.`

describe('analyzeResume', () => {
  it('returns null for text that is too short to judge', () => {
    expect(analyzeResume('A short note.')).toBeNull()
    expect(analyzeResume('x'.repeat(RESUME_MIN_CHARS - 1))).toBeNull()
  })

  it('scores a results-led résumé high', () => {
    const r = analyzeResume(GOOD)!
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.band).toBe('strong')
  })

  it('scores a duty-and-filler résumé low and names the problems', () => {
    const r = analyzeResume(WEAK.repeat(2))!
    expect(r.score).toBeLessThan(45)
    expect(r.band).toBe('rework')
    const ids = r.findings.filter((f) => f.earned < f.points).map((f) => f.id)
    expect(ids).toEqual(expect.arrayContaining(['numbers', 'weak', 'cliches', 'headings', 'contact']))
  })

  it('gives the same answer for the same text', () => {
    expect(analyzeResume(GOOD)).toEqual(analyzeResume(GOOD))
  })

  it('has checks worth exactly 100 points, each with a fix', () => {
    const r = analyzeResume(GOOD)!
    expect(r.findings.reduce((n, f) => n + f.points, 0)).toBe(100)
    for (const f of r.findings) expect(f.fix.length).toBeGreaterThan(20)
  })

  it('lists the biggest losses first', () => {
    const r = analyzeResume(WEAK.repeat(2))!
    const loss = r.findings.map((f) => f.points - f.earned)
    expect([...loss].sort((a, b) => b - a)).toEqual(loss)
  })

  it('flags tab or pipe columns as a layout problem', () => {
    const cols = GOOD.split('\n').map((l, i) => (i % 3 === 0 ? `${l}\t| extra | column` : l)).join('\n')
    expect(analyzeResume(cols)!.findings.find((f) => f.id === 'layout')!.earned).toBeLessThan(5)
  })
})

describe('teaserFor', () => {
  it('shows the score, the count and the biggest problem, but no fixes or details', () => {
    const t = teaserFor(analyzeResume(WEAK.repeat(2))!)
    expect(t.issueCount).toBeGreaterThan(0)
    expect(t.topIssue).toBeTruthy()
    expect(JSON.stringify(t)).not.toContain('fix')
    expect(Object.keys(t).sort()).toEqual(['band', 'bandLabel', 'checkCount', 'issueCount', 'score', 'topIssue', 'wordCount'])
  })
})

describe('bandFor', () => {
  it('cuts at 80, 65 and 45', () => {
    expect(bandFor(80)).toBe('strong')
    expect(bandFor(79)).toBe('solid')
    expect(bandFor(65)).toBe('solid')
    expect(bandFor(64)).toBe('needs_work')
    expect(bandFor(45)).toBe('needs_work')
    expect(bandFor(44)).toBe('rework')
  })
})
