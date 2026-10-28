import { describe, it, expect } from 'vitest'
import { draftFor, draftKind, greetingFor, withComposeLinks, COMPOSE_ACCOUNT } from '@/lib/warn/layoff-alert-drafts'
import { alertBody, type ContactCard, type ContactGroup } from '@/lib/warn/layoff-alert-rules'
import type { LocalPicture } from '@/lib/warn/layoff-picture'

const picture: LocalPicture = {
  employer: 'Acme', employees: 875, state: 'CA', county: 'Los Angeles', industryKey: 'healthcare', openInState: 96715, openInIndustry: 5796, openSeniorInState: 33069,
  topIndustries: [{ key: 'technology', openings: 33465 }], unemploymentRate: 4.9, areaLabel: 'Los Angeles County', layoffs12mo: null, layoffEvents12mo: null,
}
const card = (o: Partial<ContactCard> = {}): ContactCard => ({ name: 'Chelsea Lee', title: 'Head of HR', org: 'Acme', email: 'chelsea@acme.com', phone: null, strength: null, href: null, greet: 'Chelsea', ...o })
const ctx = { picture, employerPage: 'https://launchyournextchapter.com/prepared/acme' }

describe('head of HR note', () => {
  it("is Justin's wording and signs off 'Justin'", () => {
    const d = draftFor('head_hr', card(), ctx)
    expect(d.body).toContain('we complement it')
    expect(d.body).toContain('Claim it with your work email')
    expect(d.body).toContain('nothing for them to fill out')
    expect(d.body).toContain('I saw the news that 875 people are leaving Acme.')
    expect(d.body.endsWith('\n\nJustin')).toBe(true)
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
  it('opens on a checkable number, links once, and stays short', () => {
    for (const kind of ['head_hr', 'rewards', 'er', 'ta', 'other_employee', 'rapid_response', 'workforce_board', 'job_centers', 'economic_development', 'recruiters'] as const) {
      const d = draftFor(kind, card(), ctx)
      expect(d.body.startsWith('Chelsea,')).toBe(true)
      expect(d.body.match(/https:\/\//g)?.length).toBe(1)
      if (kind !== 'head_hr') expect(d.body.split(/\s+/).length).toBeLessThan(110)
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
