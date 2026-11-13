import { describe, it, expect } from 'vitest'
import { ALONGSIDE, SIGN_OFF } from '@/lib/warn/layoff-alert-drafts'
import type { ContactCard, ContactGroup } from '@/lib/warn/layoff-alert-rules'
import type { LocalPicture } from '@/lib/warn/layoff-picture'
import { BLS_NOW, bodyToHtml, planOutreach, valueParagraph, type OutreachAudience } from '@/lib/warn/outreach/plan'
import { addCounts, emptyCounts, pct, rollup } from '@/lib/warn/outreach/stats'

const picture: LocalPicture = {
  employer: 'Acme', employees: 875, state: 'CA', county: 'Los Angeles', industryKey: 'healthcare', openInState: 96715, openInIndustry: 5796, openSeniorInState: 33069,
  topIndustries: [{ key: 'technology', openings: 33465 }], unemploymentRate: 4.9, areaLabel: 'Los Angeles County', layoffs12mo: null, layoffEvents12mo: null,
}
const ctx = { picture, peoplePage: 'https://launchyournextchapter.com/network/company/acme' }
const card = (o: Partial<ContactCard> = {}): ContactCard => ({ name: 'Chelsea Lee', title: 'Head of HR', org: 'Acme', email: 'chelsea@acme.com', phone: null, strength: null, href: null, greet: 'Chelsea', personId: 'p1', ...o })
const group = (key: string, cards: ContactCard[]): ContactGroup => ({ key, label: key, why: '', emptyHint: '', cards })
const none = { blocked: new Set<string>() }

describe('planOutreach', () => {
  it('writes each audience its own email, with the greeting as a merge tag and the value paragraph before "we sit alongside"', () => {
    const plans = planOutreach([
      group('head_hr', [card()]),
      group('rapid_response', [card({ name: 'Sam Roe', email: 'sam@state.gov', greet: 'Sam', personId: 'p2', title: 'Coordinator' })]),
    ], ctx, none)
    expect(plans.map((p) => p.audience).sort()).toEqual(['outplacement', 'rapid_response'])
    for (const p of plans) {
      expect(p.bodyHtml.startsWith('<p>Hi {{firstName}},')).toBe(true)
      expect(p.bodyHtml.indexOf(BLS_NOW.url)).toBeGreaterThan(-1)
      expect(p.bodyHtml.indexOf(BLS_NOW.url)).toBeLessThan(p.bodyHtml.indexOf('We sit alongside them'))
      expect(p.bodyHtml).toContain('<div data-signature>')
      expect(p.bodyHtml).toContain('15 minutes this week')
    }
  })

  it('emails an address once, never a guessed one, never a blocked one, never our own, and skips roles it writes no note for', () => {
    const plans = planOutreach([
      group('head_hr', [card(), card({ name: 'Dup', email: 'CHELSEA@acme.com' }), card({ name: 'Guess', email: 'g@acme.com', guessed: true }), card({ name: 'Blocked', email: 'b@acme.com' }), card({ name: 'Me', email: 'justin@launchyournextchapter.com' })]),
      group('recruiters', [card({ name: 'Rec', email: 'rec@firm.com' })]),
      group('employer_other', [card({ name: 'Other', email: 'o@acme.com' })]),
    ], ctx, { blocked: new Set(['b@acme.com']), ownAddresses: new Set(['justin@launchyournextchapter.com']) })
    expect(plans.flatMap((p) => p.recipients.map((r) => r.email))).toEqual(['chelsea@acme.com'])
  })

  it('puts people who would read the same words in one edition', () => {
    const plans = planOutreach([group('job_centers', [
      card({ name: 'Center A', email: 'a@center.org', greet: 'team', personId: undefined, title: null }),
      card({ name: 'Center B', email: 'b@center.org', greet: 'team', personId: undefined, title: null }),
    ])], ctx, none)
    const emails = plans.flatMap((p) => p.recipients.map((r) => r.email)).sort()
    expect(emails).toEqual(['a@center.org', 'b@center.org'])
    expect(plans.length).toBeLessThanOrEqual(2)
    expect(plans[0].bodyHtml.startsWith('<p>Hi team,')).toBe(true)
  })

  it('keeps a formal greeting (Dr. Smith) as written, not a merge tag', () => {
    const [p] = planOutreach([group('head_hr', [card({ greet: 'Dr. Smith' })])], ctx, none)
    expect(p.bodyHtml).not.toContain('{{firstName}}')
  })
})

describe('what the emails may claim', () => {
  const audiences: OutreachAudience[] = ['outplacement', 'rapid_response', 'workforce_board', 'job_center', 'economic_development']
  it('makes no guarantee, no placement or speed claim, and says nothing about a competitor', () => {
    for (const a of audiences) {
      const v = valueParagraph(a)
      expect(v).not.toMatch(/guarantee|until (they|you) (get|find|land)|won.t stop|placement rate|faster than|better than|old and|barely help|10x/i)
      expect(v).toContain(BLS_NOW.url)
      expect(v).toMatch(/free/i)
    }
  })
  it('offers the employer the pilot the outplacement page offers, and nobody else', () => {
    expect(valueParagraph('outplacement')).toContain('up to 10 seats at no charge')
    for (const a of audiences.filter((x) => x !== 'outplacement')) expect(valueParagraph(a)).not.toContain('seats')
  })
})

describe('bodyToHtml', () => {
  it('escapes text, links web addresses without the sentence punctuation, and sets the sign-off as the signature block', () => {
    const html = bodyToHtml(`Hi <b>x</b>,\n\nSee https://launchyournextchapter.com/a?b=1&c=2.\n\n${ALONGSIDE}\n\n${SIGN_OFF}`)
    expect(html).toContain('Hi &lt;b&gt;x&lt;/b&gt;,')
    expect(html).toContain('<a href="https://launchyournextchapter.com/a?b=1&amp;c=2">https://launchyournextchapter.com/a?b=1&amp;c=2</a>.')
    expect(html).toMatch(/<div data-signature>Best,<br>Justin Kulla/)
    expect(html.endsWith('</div>')).toBe(true)
  })
})

describe('campaign rollups', () => {
  it('adds editions up by type and by layoff and type', () => {
    const a = { ...emptyCounts(), recipients: 2, sent: 2, opened: 1 }
    const b = { ...emptyCounts(), recipients: 3, sent: 3, clicked: 1 }
    const editions = [
      { id: 'e1', audience: 'outplacement', warnNoticeId: 'n1' },
      { id: 'e2', audience: 'outplacement', warnNoticeId: 'n1' },
      { id: 'e3', audience: 'rapid_response', warnNoticeId: 'n1' },
    ]
    const by = new Map([['e1', a], ['e2', b], ['e3', a]])
    expect(rollup(editions, by, (e) => e.audience).get('outplacement')).toEqual(addCounts(a, b))
    expect(rollup(editions, by, (e) => `${e.warnNoticeId}|${e.audience}`).size).toBe(2)
    expect(pct(1, 4)).toBe('25%')
    expect(pct(0, 0)).toBe('–')
  })
})
