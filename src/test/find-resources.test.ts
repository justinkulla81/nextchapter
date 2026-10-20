import { describe, it, expect } from 'vitest'
import { labelBoards, recruiterListingLine, resumeBookCopy } from '@/lib/jobs/find-resources'
import { GENERAL_JOB_BOARDS, getIndustryJobBoards } from '@/lib/constants/industry-job-boards'
import { FIND_PART_HEADER } from '@/lib/jobs/find-part-copy'
import { FIND_PARTS } from '@/components/dashboard/FindParts'

describe('labelBoards', () => {
  it('gives every board the reason it is listed', () => {
    const industries = ['Healthcare']
    const tiles = labelBoards(GENERAL_JOB_BOARDS, getIndustryJobBoards(industries))
    expect(tiles.length).toBeGreaterThan(GENERAL_JOB_BOARDS.length)
    for (const t of tiles) expect(t.why.length).toBeGreaterThan(0)
    expect(tiles[0].why).toBe('Open to every industry.')
    expect(tiles.at(-1)?.why).toBe('Matches your target industries.')
  })
  it('lists a board once and keeps general boards first', () => {
    const b = { name: 'X', url: 'https://x.test', description: 'd' }
    const tiles = labelBoards([b], [b, { ...b, name: 'Y' }])
    expect(tiles.map((t) => t.name)).toEqual(['X', 'Y'])
    expect(tiles[1].why).toBe('Matches your target industries.')
  })
})

describe('resume book copy', () => {
  it('states what is true now and what the other choice does, without pressure', () => {
    expect(resumeBookCopy(true).state).toBe('Your résumé is in the book.')
    expect(resumeBookCopy(false).state).toBe('Your résumé is private.')
    expect(resumeBookCopy(false).effect).toMatch(/Include it/)
  })
  it('says nothing about recruiter listing until the member has answered', () => {
    expect(recruiterListingLine(false, true)).toBeNull()
    expect(recruiterListingLine(true, true)).toBe('You are listed with executive recruiters.')
    expect(recruiterListingLine(true, false)).toBe('You are not listed with executive recruiters.')
  })
})

describe('part headers', () => {
  it('every part has one headline and one line, and they match the tab names', () => {
    for (const p of FIND_PARTS) {
      expect(FIND_PART_HEADER[p.key].intro.length).toBeGreaterThan(0)
      if (p.key !== 'jobs') expect(FIND_PART_HEADER[p.key].title).toBe(p.label)
    }
  })
})
