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
  it('writes each audience its own email, with the greeting as a merge tag and one tagged link', () => {
    const plans = planOutreach([
      group('head_hr', [card()]),
      group('rapid_response', [card({ name: 'Sam Roe', email: 'sam@state.gov', greet: 'Sam', personId: 'p2', title: 'Coordinator' })]),
    ], ctx, none)
    expect(plans.map((p) => p.audience).sort()).toEqual(['outplacement', 'rapid_response'])
    for (const p of plans) {
      expect(p.bodyHtml.startsWith('<p>Hi {{firstName}},')).toBe(true)
      expect(p.bodyHtml).toContain('utm_source=layoff_outreach')
      expect(p.bodyHtml).toContain('<div data-signature>')
      expect(p.bodyHtml).toMatch(/15 minutes this week|send it/)
      expect(p.bodyHtml).toMatch(/>https:\/\/launchyournextchapter\.com\/network\/company\/acme<\/a>/)
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

describe('the sweep for smaller layoffs', async () => {
  const { sweepWhere, OUTREACH_MIN_EMPLOYEES, OUTREACH_MIN_AGE_HOURS } = await import('@/lib/warn/outreach/sweep')
  it('takes US layoffs of 50+ jobs filed 3 hours to 5 days ago, once, and leaves held alerts to the alert path', () => {
    const now = new Date('2026-11-13T12:00:00Z')
    const w = sweepWhere(now) as unknown as { employees: unknown; outreachCheckedAt: unknown; dismissedAt: unknown; fetchedAt: { lte: Date; gte: Date }; OR: unknown; NOT: unknown }
    expect(OUTREACH_MIN_EMPLOYEES).toBe(50)
    expect(w.employees).toEqual({ gte: 50 })
    expect(w.outreachCheckedAt).toBeNull()
    expect(w.dismissedAt).toBeNull()
    expect(w.fetchedAt.lte.getTime()).toBe(now.getTime() - OUTREACH_MIN_AGE_HOURS * 3_600_000)
    expect(w.fetchedAt.gte.getTime()).toBe(now.getTime() - 5 * 86_400_000)
    expect(w.OR).toEqual([{ country: null }, { country: 'US' }])
    expect(w.NOT).toEqual({ alertHeldAt: { not: null }, alertSentAt: null, alertGaveUpAt: null })
  })
})

describe('outreach copy v2', async () => {
  const { askArm, outreachCopy, taggedLink } = await import('@/lib/warn/outreach/copy')
  const base = { greet: 'Chelsea', link: 'https://launchyournextchapter.com/network/company/acme?x=1', picture, bls: '27.6% of unemployed Americans have been looking for 27 weeks or longer (BLS, October)', signOff: SIGN_OFF }
  it('splits the ask by a hash of the address, the same address always the same arm, Rapid Response always the call', () => {
    expect(askArm('A@b.com', 'hr')).toBe(askArm(' a@b.com ', 'hr'))
    const arms = new Set(Array.from({ length: 40 }, (_, i) => askArm(`p${i}@x.org`, 'job_center')))
    expect(arms).toEqual(new Set(['A', 'B']))
    expect(askArm('a@b.com', 'rapid_response')).toBe('B')
  })
  it('differs between the two arms only in the last line before the signature', () => {
    for (const audience of ['hr', 'job_center', 'workforce_board'] as const) {
      for (const mode of ['new', 'older'] as const) {
        const a = outreachCopy({ ...base, audience, mode, arm: 'A' })
        const b = outreachCopy({ ...base, audience, mode, arm: 'B' })
        expect(a.subject).toBe(b.subject)
        const strip = (s: string) => s.split('\n\n').slice(0, -2).join('\n\n')
        expect(strip(a.body)).toBe(strip(b.body))
        expect(a.body.split('\n\n').at(-2)).not.toBe(b.body.split('\n\n').at(-2))
        expect(b.body).toContain('Worth 15 minutes this week?')
        expect(a.body).toContain('Reply "send it"')
      }
    }
  })
  it('is short, has one link, and the older wording leads with the stage not "I saw that"', () => {
    const words = (s: string) => s.split('\n\n').slice(0, -1).join(' ').split(/\s+/).length
    for (const audience of ['hr', 'job_center', 'workforce_board', 'rapid_response'] as const) {
      for (const mode of ['new', 'older'] as const) {
        const m = outreachCopy({ ...base, audience, mode, arm: 'B' })
        expect(words(m.body)).toBeLessThan(110)
        expect(m.body.match(/https:\/\//g)?.length).toBe(1)
        expect(m.body).not.toMatch(/I saw that|I'm Justin Kulla|hope this/i)
      }
    }
    expect(outreachCopy({ ...base, audience: 'hr', mode: 'older', arm: 'B' }).body).toContain('a few weeks ago')
    expect(outreachCopy({ ...base, audience: 'hr', mode: 'new', arm: 'B' }).body).not.toContain('a few weeks')
  })
  it('only promises what the page does: each person adds their email, and 10 seats for HR only', () => {
    const hr = outreachCopy({ ...base, audience: 'hr', mode: 'new', arm: 'A' }).body
    expect(hr).toContain('each person adds their email')
    expect(hr).toContain('10 seats at no charge')
    expect(outreachCopy({ ...base, audience: 'job_center', mode: 'new', arm: 'A' }).body).not.toContain('seats')
  })
  it('tags the page link so a sign-up can be traced to the email, and keeps the link on the page that answers', () => {
    const u = new URL(taggedLink('https://launchyournextchapter.com/layoffs/company/acme', { audience: 'hr', arm: 'A', noticeId: 'n1' }))
    expect(u.pathname).toBe('/layoffs/company/acme')
    expect(Object.fromEntries(u.searchParams)).toEqual({ utm_source: 'layoff_outreach', utm_medium: 'email', utm_campaign: 'hr', utm_content: 'A', lo_n: 'n1' })
  })
  it('planOutreach uses v2 for HR and tags the link; economic development keeps the older note', () => {
    const plans = planOutreach([group('head_hr', [card()]), group('economic_development', [card({ name: 'Ed Dev', email: 'ed@chamber.org', greet: 'Ed', personId: undefined, title: null })])], ctx, { blocked: new Set(), noticeId: 'n9' })
    const hr = plans.find((p) => p.audience === 'outplacement')!
    expect(hr.bodyHtml).toContain('utm_source=layoff_outreach')
    expect(hr.bodyHtml).toContain('lo_n=n9')
    expect(plans.find((p) => p.audience === 'economic_development')!.bodyHtml).toContain('We sit alongside them')
  })
  it('reads the tags back on the landing page, and ignores any other visit', async () => {
    const { readOutreachTags } = await import('@/lib/outreach/landing-tags')
    expect(readOutreachTags('?utm_source=layoff_outreach&utm_medium=email&utm_campaign=hr&utm_content=A&lo_n=n1')).toEqual({ role: 'hr', audience: 'hr', arm: 'A', noticeId: 'n1' })
    expect(readOutreachTags('?utm_source=layoff_outreach&utm_campaign=rapid_response')?.role).toBe('partner')
    expect(readOutreachTags('?utm_source=google&utm_campaign=hr')).toBeNull()
    expect(readOutreachTags('')).toBeNull()
  })
})

describe('the backfill rules', async () => {
  const { modeForAge, releaseTime, NEW_DAYS } = await import('@/lib/warn/outreach/backfill-rules')
  it('gives layoffs 14 days old or less the standard email and older ones the continued-support wording', () => {
    const now = new Date('2026-11-13T12:00:00Z')
    expect(NEW_DAYS).toBe(14)
    expect(modeForAge(new Date('2026-11-13T00:00:00Z'), now)).toBe('new')
    expect(modeForAge(new Date('2026-10-30T12:00:00Z'), now)).toBe('new')
    expect(modeForAge(new Date('2026-10-29T12:00:00Z'), now)).toBe('older')
  })
  it('releases on the next Monday at 9:00 a.m. Eastern, in winter and summer time', () => {
    expect(releaseTime(new Date('2026-11-13T12:00:00Z')).toISOString()).toBe('2026-11-16T14:00:00.000Z')
    expect(releaseTime(new Date('2026-07-10T12:00:00Z')).toISOString()).toBe('2026-07-13T13:00:00.000Z')
    expect(releaseTime(new Date('2026-11-16T10:00:00Z')).toISOString()).toBe('2026-11-16T14:00:00.000Z')
    expect(releaseTime(new Date('2026-11-16T15:00:00Z')).toISOString()).toBe('2026-11-23T14:00:00.000Z')
  })
})
