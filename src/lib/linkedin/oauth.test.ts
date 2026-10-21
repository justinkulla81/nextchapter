import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/portal-hosts', () => ({ callbackOriginForAppPath: () => 'https://example.com' }))

describe('pickNextChapterPage', () => {
  it('picks the page named for NextChapter, or the only page', async () => {
    const { pickNextChapterPage } = await import('./oauth')
    const a = { urn: 'urn:li:organization:1', name: 'Some Other Co' }
    const b = { urn: 'urn:li:organization:2', name: 'NextChapter' }
    expect(pickNextChapterPage([a, b])).toBe(b)
    expect(pickNextChapterPage([{ urn: 'urn:li:organization:3', name: 'Next Chapter, Inc.' }, a])?.urn).toBe('urn:li:organization:3')
    expect(pickNextChapterPage([a])).toBe(a)
  })
  it('does not guess between several unrelated pages, or from none', async () => {
    const { pickNextChapterPage } = await import('./oauth')
    expect(pickNextChapterPage([{ urn: 'urn:li:organization:1', name: 'A' }, { urn: 'urn:li:organization:2', name: 'B' }])).toBeNull()
    expect(pickNextChapterPage([])).toBeNull()
  })
})
