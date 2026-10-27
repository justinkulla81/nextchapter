import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const boards = vi.fn()
const orgList = vi.fn()
const colleges = vi.fn()
const hasLayoffs = vi.fn()
vi.mock('@/lib/seo/workforce-pages', () => ({ getStateBoards: (c: string) => boards(c) }))
vi.mock('@/lib/seo/org-pages', () => ({ getStateOrgList: (k: string, s: string) => orgList(k, s) }))
vi.mock('@/lib/seo/college-pages', () => ({ getStateCollegeListings: (c: string) => colleges(c) }))
vi.mock('@/lib/warn/layoff-pages', () => ({ hasLayoffStatePage: (c: string) => hasLayoffs(c) }))

describe('layoff cross-links', () => {
  it('links a state only to the sibling pages that exist', async () => {
    boards.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }])
    orgList.mockImplementation(async (kind: string) => (kind === 'JOB_CENTER' ? { rows: [1] } : null))
    colleges.mockResolvedValue([])
    const { stateHelpLinks } = await import('@/lib/seo/layoff-links')
    const links = await stateHelpLinks('OH')
    expect(links.map((l) => l.href)).toEqual(['/rapid-response/ohio', '/workforce-boards/ohio', '/job-centers/ohio'])
  })
  it('links nothing for a state with no boards, centers, organizations or colleges', async () => {
    boards.mockResolvedValue([]); orgList.mockResolvedValue(null); colleges.mockResolvedValue([])
    const { stateHelpLinks } = await import('@/lib/seo/layoff-links')
    expect(await stateHelpLinks('WY')).toEqual([])
  })
  it('gives a state page its layoff and rapid response links only when those pages exist', async () => {
    boards.mockResolvedValue([{ id: 'b1' }]); hasLayoffs.mockResolvedValue(false)
    const { layoffAndRapidLinks } = await import('@/lib/seo/layoff-links')
    expect((await layoffAndRapidLinks('GA')).map((l) => l.href)).toEqual(['/rapid-response/georgia'])
    hasLayoffs.mockResolvedValue(true)
    expect((await layoffAndRapidLinks('GA')).map((l) => l.href)).toEqual(['/layoffs/georgia', '/rapid-response/georgia'])
    boards.mockResolvedValue([]); hasLayoffs.mockResolvedValue(false)
    expect(await layoffAndRapidLinks('WY')).toEqual([])
  })
})
