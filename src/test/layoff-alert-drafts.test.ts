import { describe, it, expect } from 'vitest'
import { ALONGSIDE, CLOSE, SIGN_OFF, draftFor, composeKey, readComposeKey, draftKind, greetingFor, withComposeLinks, COMPOSE_ACCOUNT } from '@/lib/warn/layoff-alert-drafts'
import { alertBody, type ContactCard, type ContactGroup } from '@/lib/warn/layoff-alert-rules'
import type { LocalPicture } from '@/lib/warn/layoff-picture'

const picture: LocalPicture = {
  employer: 'Acme', employees: 875, state: 'CA', county: 'Los Angeles', industryKey: 'healthcare', openInState: 96715, openInIndustry: 5796, openSeniorInState: 33069,
  topIndustries: [{ key: 'technology', openings: 33465 }], unemploymentRate: 4.9, areaLabel: 'Los Angeles County', layoffs12mo: null, layoffEvents12mo: null,
}
const card = (o: Partial<ContactCard> = {}): ContactCard => ({ name: 'Chelsea Lee', title: 'Head of HR', org: 'Acme', email: 'chelsea@acme.com', phone: null, strength: null, href: null, greet: 'Chelsea', ...o })
const ctx = { picture, peoplePage: 'https://launchyournextchapter.com/network/company/acme' }

describe('head of HR note', () => {
  it("is Justin's own edited wording with the people page link", () => {
    const d = draftFor('head_hr', card(), ctx)
    expect(d.body.startsWith("Chelsea,\n\nI'm Justin Kulla, founder of NextChapter")).toBe(true)
    expect(d.body).toContain('96,715 professional roles open in California right now')
    expect(d.body).toContain('We sit alongside them')
    expect(['875 people leaving Acme', "where Acme's 875 can land", 'a page for the 875 leaving Acme']).toContain(d.subject)
    expect(d.variant).toMatch(/^[ABC]$/)
    expect(draftFor('head_hr', card(), ctx).subject).toBe(d.subject)
    expect(d.body).toContain('regardless of whether you partner with us: https://launchyournextchapter.com/network/company/acme')
    expect(d.body).toContain('15 minutes this week')
    expect(d.body.match(/https:\/\//g)?.length).toBe(1)
    expect(d.body).not.toContain('/prepared/')
    expect(d.body.endsWith(SIGN_OFF)).toBe(true)
  })
})

describe('greetingFor', () => {
  it('uses the first name, and Dr. Last for a doctor', () => {
    expect(greetingFor('Chelsea Lee')).toBe('Chelsea')
    expect(greetingFor('Dr. Ann Smith')).toBe('Dr. Smith')
    expect(greetingFor('')).toBe('team')
  })
})

describe('draftFor', () => {
  it('opens on a checkable number, and stays short; partners get two links, everyone else one', () => {
    for (const kind of ['head_hr', 'rewards', 'er', 'ta', 'other_employee', 'rapid_response', 'workforce_board', 'job_centers', 'economic_development', 'recruiters'] as const) {
      const d = draftFor(kind, card(), ctx)
      expect(d.body.startsWith('Chelsea,')).toBe(true)
      // We are selling: every note asks for the same 15-minute call and signs off the same way.
      expect(d.body).toContain(CLOSE)
      expect(d.body.endsWith(`${ALONGSIDE}\n\n${CLOSE}\n\n${SIGN_OFF}`)).toBe(true)
      expect(d.body).not.toMatch(/one-page|handout|reply "yes"/i)
      expect(d.body.match(/https:\/\//g)?.length).toBe(['rapid_response', 'workforce_board', 'job_centers', 'economic_development'].includes(kind) ? 2 : 1)
      if (!['head_hr', 'rapid_response', 'workforce_board', 'job_centers', 'economic_development'].includes(kind)) expect(d.body.split(/\s+/).length).toBeLessThan(190)
      expect(d.body.split(/\s+/).length).toBeLessThan(260)
      expect(d.body).not.toMatch(/white-collar/i)
    }
  })
  it('greets a center as a team', () => {
    expect(draftFor('job_centers', card({ greet: 'team' }), ctx).body.startsWith('Hi team,')).toBe(true)
  })
  it('picks the HR note by title', () => {
    expect(draftKind('hr_team', 'Talent Acquisition Specialist')).toBe('ta')
    expect(draftKind('hr_team', 'Employee Relations Manager')).toBe('er')
    expect(draftKind('hr_team', 'Total Rewards Director')).toBe('rewards')
    expect(draftKind('head_hr', 'CHRO')).toBe('head_hr')
  })
})

describe('partner page link', () => {
  it("uses the partner's own page in place of the county picture when it has one", () => {
    const c = card({ page: 'https://launchyournextchapter.com/workforce-boards/california/south-bay', pageName: 'South Bay Workforce Investment Board' })
    const d = draftFor('workforce_board', c, { ...ctx, localPage: 'https://launchyournextchapter.com/places/california/county/los-angeles-county' })
    expect(d.body).toContain('the page I built for South Bay Workforce Investment Board')
    expect(d.body).toContain('workforce-boards/california/south-bay')
    expect(d.body).not.toContain('/county/')
    expect(draftFor('workforce_board', card(), { ...ctx, localPage: 'https://launchyournextchapter.com/places/california/county/los-angeles-county' }).body).toContain('/county/los-angeles-county')
  })
})

describe('withComposeLinks', () => {
  const group = (cards: ContactCard[]): ContactGroup => ({ key: 'head_hr', label: 'Head of HR', why: 'w', emptyHint: '', cards })
  it('adds a Gmail compose link from the Justin account to each card with an email', () => {
    const [g] = withComposeLinks([group([card(), card({ email: null })])], ctx)
    const u = new URL(g.cards[0].compose!)
    expect(u.origin + u.pathname).toBe('https://mail.google.com/mail/')
    expect(u.searchParams.get('authuser')).toBe(COMPOSE_ACCOUNT)
    expect(u.searchParams.get('to')).toBe('chelsea@acme.com')
    expect(g.cards[1].compose).toBeUndefined()
  })
  it('shows a Write email button only on cards that have a link', () => {
    const base = { employer: 'Acme', employees: 1, percent: null, kind: 'warn' as const, confirmed: true, inCrm: false, people: 0, warm: 0, contactsFound: 0 }
    const links = { source: null, org: null, notices: 'https://x.test' }
    expect(alertBody({ ...base, groups: [group([card()])] }, links)).not.toContain('Write email')
    expect(alertBody({ ...base, groups: withComposeLinks([group([card()])], ctx) }, links)).toContain('Write email')
  })
})

describe('tracked compose links', () => {
  it('round-trips the click key', () => {
    expect(readComposeKey(composeKey('rapid_response', 'B', 'abc:1', 'p9'))).toEqual({ group: 'rapid_response', variant: 'B', personId: 'p9', noticeId: 'abc:1' })
    expect(readComposeKey(composeKey('head_hr', undefined, 'n1'))).toEqual({ group: 'head_hr', variant: null, personId: null, noticeId: 'n1' })
    expect(readComposeKey('weekly_digest')).toBeNull()
  })
  it('wraps the compose link when a tracker is given', () => {
    const group: ContactGroup = { key: 'head_hr', label: 'Head of HR', why: 'w', emptyHint: '', cards: [card()] }
    const [g] = withComposeLinks([group], { ...ctx, track: (href, m) => `https://track.test/?g=${m.group}&v=${m.variant}&u=${encodeURIComponent(href)}` })
    expect(g.cards[0].compose).toMatch(/^https:\/\/track\.test\/\?g=head_hr&v=[ABC]&u=https%3A%2F%2Fmail\.google\.com/)
  })
})
