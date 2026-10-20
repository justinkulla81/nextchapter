import { describe, it, expect } from 'vitest'
import { FIND_PARTS, parseFindPart } from '@/components/dashboard/FindParts'
import { boardHref } from '@/lib/jobs/board-url'

describe('Find a job parts', () => {
  it('defaults to jobs and ignores unknown values', () => {
    expect(parseFindPart(undefined)).toBe('jobs')
    expect(parseFindPart('nonsense')).toBe('jobs')
    for (const p of FIND_PARTS) expect(parseFindPart(p.key)).toBe(p.key)
  })
  it('switching part keeps the search and filters', () => {
    const href = boardHref({ q: 'cfo', loc: 'Boston', types: 'full_time' }, { part: 'unposted' })
    expect(href).toContain('q=cfo')
    expect(href).toContain('loc=Boston')
    expect(href).toContain('part=unposted')
  })
  it('going back to jobs drops the part', () => {
    expect(boardHref({ q: 'cfo', part: 'unposted' }, { part: undefined })).not.toContain('part=')
  })
})
