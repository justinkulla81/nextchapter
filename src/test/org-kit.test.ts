import { describe, expect, it } from 'vitest'
import { KIT_SOURCES, areaPhrase, kitCopy, kitLabel, kitLabelPrefix, kitLink, kitQrLink, parseKitLabelAny, summarizeKit, type KitKind } from '@/lib/org-claims/org-kit'
import { parseKitLabel } from '@/lib/cohorts/launch-kit'

const links = { email: 'https://x.test/e', web: 'https://x.test/w', social: 'https://x.test/s', print: 'https://x.test/p' }

describe('kit labels', () => {
  it('keeps the board label the first kits used, and files every other kind under ok:', () => {
    expect(kitLabel('WORKFORCE_BOARD', 'KY-247', 'email')).toBe('ob:KY-247:email')
    expect(kitLabel('COLLEGE', '123456', 'print')).toBe('ok:COLLEGE:123456:print')
    expect(kitLabel('EMPLOYER', 'acme & sons', 'web')).toBe('ok:EMPLOYER:acme & sons:web')
  })
  it('round-trips every kind, including an id that holds spaces and colons', () => {
    const cases: [KitKind, string][] = [['WORKFORCE_BOARD', 'KY-247'], ['JOB_CENTER', 'KY-9001'], ['ECON_DEV', 'cmx1y2z'], ['COLLEGE', '190150'], ['EMPLOYER', 'acme & sons: east']]
    for (const [kind, id] of cases) {
      const l = kitLabel(kind, id, 'social')
      expect(parseKitLabelAny(l)).toEqual({ kind, id, source: 'social' })
      expect(l.startsWith(kitLabelPrefix(kind, id))).toBe(true)
    }
  })
  it('does not collide with the layoff-cohort labels, and refuses anything else', () => {
    expect(parseKitLabel(kitLabel('WORKFORCE_BOARD', 'KY-247', 'email'))).toBeNull()
    expect(parseKitLabelAny('lc:abc:hr')).toBeNull()
    expect(parseKitLabelAny('ob:KY-247')).toBeNull()
    expect(parseKitLabelAny('ok:NOPE:1:email')).toBeNull()
  })
  it('keeps one board from matching another board whose id starts the same', () => {
    expect(kitLabel('WORKFORCE_BOARD', 'KY-2470', 'email').startsWith(kitLabelPrefix('WORKFORCE_BOARD', 'KY-247'))).toBe(false)
  })
})

describe('kit links', () => {
  it('builds a short tracked link that lands on the page', () => {
    expect(kitLink('https://launchyournextchapter.com', 'abc123', '/workforce-boards/kentucky/x')).toBe('https://launchyournextchapter.com/api/r/abc123?to=/workforce-boards/kentucky/x')
  })
  it('stays within what a QR holds and keeps the landing page when it can', () => {
    const short = kitQrLink('https://launchyournextchapter.com', 'abc123', '/workforce-boards/kentucky/greater-louisville-workforce-development-board')
    expect(short.length).toBeLessThanOrEqual(213)
    expect(short.split('?to=')[1]).toBe('/workforce-boards/kentucky/greater-louisville-workforce-development-board')
    expect(kitQrLink('https://launchyournextchapter.com', 'abc123', `/workforce-boards/ohio/${'x'.repeat(200)}`)).toBe('https://launchyournextchapter.com/api/r/abc123')
  })
})

describe('kit copy', () => {
  const kinds: KitKind[] = ['WORKFORCE_BOARD', 'JOB_CENTER', 'ECON_DEV', 'COLLEGE', 'EMPLOYER']
  it('puts the right link in each place, for every kind', () => {
    for (const kind of kinds) {
      const c = kitCopy({ kind, name: 'Test Org', area: kind === 'EMPLOYER' ? '' : 'the Test area', links })
      expect(c.email.body, kind).toContain(links.email)
      expect(c.newsletter, kind).toContain(links.web)
      expect(c.social, kind).toContain(links.social)
      expect(c.email.body, kind).toContain('not run by Test Org')
    }
  })
  it('has no doubled words, for every kind and with or without an area', () => {
    for (const kind of kinds) for (const area of ['', 'Marion County']) {
      const all = JSON.stringify(kitCopy({ kind, name: 'Test Org', area, links }))
      expect(all, `${kind} ${area}`).not.toMatch(/\b(\w+) \1\b/i)
    }
  })
  it('promises only what exists, for every kind', () => {
    for (const kind of kinds) {
      const all = JSON.stringify(kitCopy({ kind, name: 'Test Org', area: 'the Test area', links })).toLowerCase()
      for (const word of ['guarantee', 'partnership', 'official', 'endorse', '$']) expect(all, `${kind} ${word}`).not.toContain(word)
    }
  })
  it('speaks to the right audience', () => {
    expect(kitCopy({ kind: 'COLLEGE', name: 'Westfield', area: 'Westfield, MA', links }).email.subject).toBe('A free tool for Westfield students and alumni')
    expect(kitCopy({ kind: 'WORKFORCE_BOARD', name: 'B', area: 'Marion County', links }).email.subject).toBe('A free tool for job seekers in Marion County')
    const emp = kitCopy({ kind: 'EMPLOYER', name: 'Acme', area: '', links })
    expect(emp.email.subject).toBe('Support for people affected by changes at Acme')
    expect(emp.email.body).toContain('nothing is shared with Acme unless you choose to share it')
    expect(emp.flyer.headline).toBe('Affected by changes at Acme? See where you stand.')
  })
  it('reads sensibly with no area', () => {
    const c = kitCopy({ kind: 'JOB_CENTER', name: 'Center', area: '', links })
    expect(c.email.subject).toBe('A free tool for job seekers near you')
    expect(c.social).not.toContain('in ?')
  })
})

describe('kit stats', () => {
  it('holds the joined counts back under the floor', () => {
    const s = summarizeKit([{ source: 'email', clicks: 40, joined: 6 }, { source: 'web', clicks: 3, joined: 1 }])
    expect(s.totalJoined).toBeNull()
    expect(s.sources.every((x) => x.joined === null)).toBe(true)
    expect(s.totalClicks).toBe(43)
    expect(s.sources.map((x) => x.source)).toEqual(KIT_SOURCES.map((x) => x.source))
  })
  it('shows them once the total reaches the floor', () => {
    const s = summarizeKit([{ source: 'email', clicks: 90, joined: 9 }, { source: 'social', clicks: 10, joined: 3 }])
    expect(s.totalJoined).toBe(12)
    expect(s.sources.find((x) => x.source === 'email')?.joined).toBe(9)
    expect(s.sources.find((x) => x.source === 'print')?.joined).toBe(0)
  })
})

describe('area phrase', () => {
  it('reads naturally for one, a few and many counties, and a whole state', () => {
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
