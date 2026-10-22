import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('pickNextChapterPage', () => {
  it('picks the page named for NextChapter, or the only page', async () => {
    const { pickNextChapterPage } = await import('./page-posting')
    const a = { urn: 'urn:li:organization:1', name: 'Some Other Co' }
    const b = { urn: 'urn:li:organization:2', name: 'NextChapter' }
    expect(pickNextChapterPage([a, b])).toBe(b)
    expect(pickNextChapterPage([{ urn: 'urn:li:organization:3', name: 'Next Chapter, Inc.' }, a])?.urn).toBe('urn:li:organization:3')
    expect(pickNextChapterPage([a])).toBe(a)
  })
  it('does not guess between several unrelated pages, or from none', async () => {
    const { pickNextChapterPage } = await import('./page-posting')
    expect(pickNextChapterPage([{ urn: 'urn:li:organization:1', name: 'A' }, { urn: 'urn:li:organization:2', name: 'B' }])).toBeNull()
    expect(pickNextChapterPage([])).toBeNull()
  })
})

describe('toCommentary', () => {
  it('escapes the characters LinkedIn treats as markup so the post is not cut off', async () => {
    const { toCommentary } = await import('./page-posting')
    expect(toCommentary('Kroger cut 3,000 jobs (37% of staff).')).toBe('Kroger cut 3,000 jobs \\(37% of staff\\).')
    expect(toCommentary('a_b *c* ~d~ [e] {f} <g> @h | i \\ j')).toBe('a\\_b \\*c\\* \\~d\\~ \\[e\\] \\{f\\} \\<g\\> \\@h \\| i \\\\ j')
  })
  it('turns #words into real hashtags and leaves plain text alone', async () => {
    const { toCommentary } = await import('./page-posting')
    expect(toCommentary('#Layoffs #CareerSupport')).toBe('{hashtag|\\#|Layoffs} {hashtag|\\#|CareerSupport}')
    expect(toCommentary('Plain text, with commas.')).toBe('Plain text, with commas.')
  })
})
