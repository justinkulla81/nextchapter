import { describe, expect, it } from 'vitest'
import { armFor, countsFor, decide, employerTitleB, jobTitleB, MAX_TEST_DAYS, pickTitle, TITLE_TESTS, type ArmStats } from '@/lib/seo/title-tests'

const arm = (impressions: number, clicks: number, position = 8): ArmStats => ({ impressions, clicks, positionSum: position * impressions })

describe('title test arms', () => {
  it('gives a path the same arm every time and splits a large set about evenly', () => {
    expect(armFor('/jobs/abc')).toBe(armFor('/jobs/abc'))
    const b = Array.from({ length: 2000 }, (_, i) => armFor(`/jobs/${i}`)).filter((a) => a === 'B').length
    expect(b).toBeGreaterThan(900)
    expect(b).toBeLessThan(1100)
  })
  it('shows each page its arm while running and the winner once decided', () => {
    const path = Array.from({ length: 50 }, (_, i) => `/jobs/${i}`).find((p) => armFor(p) === 'B') as string
    expect(pickTitle({ status: 'running', winner: null }, path, 'cur', 'alt')).toBe('alt')
    expect(pickTitle({ status: 'decided', winner: 'A' }, path, 'cur', 'alt')).toBe('cur')
    expect(pickTitle({ status: 'decided', winner: 'B' }, '/jobs/x', 'cur', 'alt')).toBe('alt')
    expect(pickTitle(null, path, 'cur', 'alt')).toBe('cur')
  })
  it('builds the alternate titles', () => {
    expect(jobTitleB('Data Analyst', 'Acme', 'Austin, TX', '$90k–$110k')).toBe('Data Analyst Job at Acme, $90k–$110k · Austin, TX')
    expect(jobTitleB('Data Analyst', 'Acme', null, null)).toBe('Data Analyst Job at Acme')
    expect(employerTitleB('Acme', 1200)).toBe('Jobs at Acme: 1,200 Open Roles, Pay and Hiring')
    expect(employerTitleB('Acme', 0)).toBe('Jobs at Acme')
  })
})

describe('which pages count toward a test', () => {
  const jobs = TITLE_TESTS.find((t) => t.key === 'jobs')!
  const employers = TITLE_TESTS.find((t) => t.key === 'employers')!
  it('counts job pages and not the hubs under /jobs/', () => {
    expect(countsFor(jobs, '/jobs/cmvfubih200cujt09shw20ytv')).toBe(true)
    for (const p of ['/jobs/title/data-analyst', '/jobs/industry/museum', '/jobs/type/contract', '/jobs/entry-level', '/jobs/alerts', '/jobs/title/data-analyst/chicago']) expect(countsFor(jobs, p)).toBe(false)
  })
  it('counts employer pages and not the pages inside them or other sections', () => {
    expect(countsFor(employers, '/employers/sage')).toBe(true)
    expect(countsFor(employers, '/employers/sage/jobs')).toBe(false)
    expect(countsFor(employers, '/layoffs/company/sage')).toBe(false)
  })
})

describe('title test decision', () => {
  it('waits for enough impressions', () => {
    expect(decide(arm(500, 5), arm(500, 25), 14).verdict).toBe('continue')
  })
  it('picks B on a real lift and A on a real loss', () => {
    expect(decide(arm(20000, 200), arm(20000, 300), 14).verdict).toBe('B')
    expect(decide(arm(20000, 300), arm(20000, 200), 14).verdict).toBe('A')
  })
  it('keeps going on a small gap, then keeps the current title at the limit', () => {
    expect(decide(arm(20000, 200), arm(20000, 205), 14).verdict).toBe('continue')
    expect(decide(arm(20000, 200), arm(20000, 205), MAX_TEST_DAYS).verdict).toBe('A')
    expect(decide(arm(100, 1), arm(100, 1), MAX_TEST_DAYS).verdict).toBe('A')
  })
  it('reports click rate and average position per arm', () => {
    const v = decide(arm(1000, 10, 6), arm(1000, 20, 9), 14)
    expect(v.ctrA).toBeCloseTo(0.01)
    expect(v.ctrB).toBeCloseTo(0.02)
    expect(v.positionA).toBeCloseTo(6)
    expect(v.positionB).toBeCloseTo(9)
  })
})
