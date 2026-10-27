import { describe, expect, it } from 'vitest'
import { BOARD_KIT_SOURCES, boardKitCopy, boardKitLabel, boardKitLink, parseBoardKitLabel, summarizeBoardKit } from '@/lib/org-claims/board-kit'
import { parseKitLabel } from '@/lib/cohorts/launch-kit'

const links = { email: 'https://x.test/e', web: 'https://x.test/w', social: 'https://x.test/s', print: 'https://x.test/p' }

describe('board kit labels', () => {
  it('round-trips a label and does not collide with the layoff-cohort labels', () => {
    const l = boardKitLabel('KY-247', 'email')
    expect(l).toBe('ob:KY-247:email')
    expect(parseBoardKitLabel(l)).toEqual({ boardId: 'KY-247', source: 'email' })
    expect(parseKitLabel(l)).toBeNull()
    expect(parseBoardKitLabel('lc:abc:hr')).toBeNull()
    expect(parseBoardKitLabel('ob:KY-247')).toBeNull()
  })
  it('builds a short tracked link that lands on the board page', () => {
    const url = boardKitLink('https://launchyournextchapter.com', 'abc123', '/workforce-boards/kentucky/x')
    expect(url).toBe('https://launchyournextchapter.com/api/r/abc123?to=/workforce-boards/kentucky/x')
  })
})

describe('board kit copy', () => {
  const copy = boardKitCopy({ boardName: 'Test Board', area: 'the Test area', links })
  it('puts the right link in each place', () => {
    expect(copy.email.body).toContain(links.email)
    expect(copy.newsletter).toContain(links.web)
    expect(copy.social).toContain(links.social)
  })
  it('says the platform is independent and promises only what exists', () => {
    expect(copy.email.body).toContain('not run by Test Board')
    const all = JSON.stringify(copy).toLowerCase()
    for (const word of ['guarantee', 'partnership', 'official', 'endorse', '$']) expect(all).not.toContain(word)
  })
})

describe('board kit stats', () => {
  it('holds the joined counts back under the floor', () => {
    const s = summarizeBoardKit([{ source: 'email', clicks: 40, joined: 6 }, { source: 'web', clicks: 3, joined: 1 }])
    expect(s.totalJoined).toBeNull()
    expect(s.sources.every((x) => x.joined === null)).toBe(true)
    expect(s.totalClicks).toBe(43)
    expect(s.sources.map((x) => x.source)).toEqual(BOARD_KIT_SOURCES.map((x) => x.source))
  })
  it('shows them once the total reaches the floor', () => {
    const s = summarizeBoardKit([{ source: 'email', clicks: 90, joined: 9 }, { source: 'social', clicks: 10, joined: 3 }])
    expect(s.totalJoined).toBe(12)
    expect(s.sources.find((x) => x.source === 'email')?.joined).toBe(9)
    expect(s.sources.find((x) => x.source === 'print')?.joined).toBe(0)
  })
})

describe('board kit QR link', () => {
  it('stays within what a QR holds and keeps the landing page when it can', async () => {
    const { boardKitQrLink } = await import('@/lib/org-claims/board-kit')
    const short = boardKitQrLink('https://launchyournextchapter.com', 'abc123', '/workforce-boards/kentucky/greater-louisville-workforce-development-board')
    expect(short.length).toBeLessThanOrEqual(213)
    expect(short.split('?to=')[1]).toBe('/workforce-boards/kentucky/greater-louisville-workforce-development-board')
    const long = boardKitQrLink('https://launchyournextchapter.com', 'abc123', `/workforce-boards/ohio/${'x'.repeat(200)}`)
    expect(long).toBe('https://launchyournextchapter.com/api/r/abc123')
  })
})

describe('area phrase', () => {
  it('reads naturally for one, a few and many counties, and a whole state', async () => {
    const { areaPhrase } = await import('@/lib/org-claims/board-kit')
    const c = (...n: string[]) => ({ statewide: false, counties: n.map((name) => ({ name })) })
    expect(areaPhrase(c('Jefferson County'), 'Kentucky')).toBe('Jefferson County')
    expect(areaPhrase(c('A County', 'B County'), 'Kentucky')).toBe('A County and B County')
    expect(areaPhrase(c('A County', 'B County', 'C County'), 'Kentucky')).toBe('A County, B County and C County')
    expect(areaPhrase(c('A County', 'B County', 'C County', 'D County'), 'Kentucky')).toBe('A County and 3 nearby counties')
    expect(areaPhrase({ statewide: true, counties: [] }, 'Ohio')).toBe('all of Ohio')
    expect(areaPhrase(c(), 'Ohio')).toBe('the Ohio area')
    const sized = { statewide: false, counties: [{ name: 'Bullitt County', population: 83000 }, { name: 'Jefferson County', population: 780000 }, { name: 'Henry County', population: 16000 }, { name: 'Oldham County', population: 68000 }] }
    expect(areaPhrase(sized, 'Kentucky')).toBe('Jefferson County and 3 nearby counties')
  })
})
