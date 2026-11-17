import { describe, expect, it } from 'vitest'
import { MAX_PER_BOARD, feedIdFromTag, feedTag, keepNear, nameFromToken, parseBoardLink, planRefresh } from '@/lib/workforce/job-feeds'

const job = (n: number, location: string | null = 'Louisville, KY') => ({ title: `Job ${n}`, location, url: `https://boards.greenhouse.io/acme/jobs/${n}` })

describe('job feeds', () => {
  it('reads the board from a pasted link', () => {
    expect(parseBoardLink('https://boards.greenhouse.io/Acme/jobs/123')).toEqual({ provider: 'GREENHOUSE', token: 'acme' })
    expect(parseBoardLink('job-boards.greenhouse.io/acme-health')).toEqual({ provider: 'GREENHOUSE', token: 'acme-health' })
    expect(parseBoardLink('https://jobs.lever.co/acme')).toEqual({ provider: 'LEVER', token: 'acme' })
    expect(parseBoardLink('https://jobs.ashbyhq.com/acme/abc-123')).toEqual({ provider: 'ASHBY', token: 'acme' })
  })
  it('says what to do when the link cannot be read', () => {
    expect(parseBoardLink('')).toHaveProperty('error')
    expect(parseBoardLink('https://acme.wd1.myworkdayjobs.com/Careers')).toMatchObject({ error: expect.stringMatching(/Greenhouse, Lever and Ashby/) })
    expect(parseBoardLink('https://boards.greenhouse.io/')).toMatchObject({ error: expect.stringMatching(/board name/) })
    expect(parseBoardLink('https://boards.greenhouse.io/a b%00')).toHaveProperty('error')
    expect(parseBoardLink('https://boards.greenhouse.io.evil.test/acme')).toHaveProperty('error')
  })
  it('turns a board name into a starting employer name', () => {
    expect(nameFromToken('acme-health')).toBe('Acme Health')
  })
  it('keeps jobs near the region, and remote ones when asked', () => {
    const jobs = [job(1), job(2, 'Remote - US'), job(3, 'Austin, TX'), job(4, null)]
    expect(keepNear(jobs, 'louisville', false).map((j) => j.title)).toEqual(['Job 1'])
    expect(keepNear(jobs, 'Louisville', true).map((j) => j.title)).toEqual(['Job 1', 'Job 2'])
    expect(keepNear(jobs, '', false)).toHaveLength(4)
    expect(keepNear([{ title: 'x', location: null, url: 'javascript:alert(1)' }], '', false)).toHaveLength(0)
  })
  it('adds new jobs, skips ones already on NextChapter, and takes down what left the board', () => {
    const known = [
      { id: 'k1', url: job(1).url },
      { id: 'k2', url: job(2).url },
    ]
    const p = planRefresh([job(1), job(3), job(4), job(3)], known, new Set([job(4).url]))
    expect(p.toAdd.map((j) => j.title)).toEqual(['Job 3'])
    expect(p.toArchive).toEqual(['k2'])
    expect(p.alreadyElsewhere).toBe(1)
    expect(p.matched).toBe(3)
  })
  it('never keeps more than the cap from one board', () => {
    const many = Array.from({ length: 200 }, (_, i) => job(i))
    expect(planRefresh(many, [], new Set()).toAdd).toHaveLength(MAX_PER_BOARD)
  })
  it('tags and untags listings', () => {
    expect(feedIdFromTag(feedTag('abc'))).toBe('abc')
    expect(feedIdFromTag('someone@example.com')).toBeNull()
  })
})
