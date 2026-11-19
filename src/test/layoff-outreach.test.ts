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
  it('writes each audience its own email, with the greeting as a merge tag and no link in the body', () => {
    const plans = planOutreach([
      group('head_hr', [card()]),
      group('rapid_response', [card({ name: 'Sam Roe', email: 'sam@state.gov', greet: 'Sam', personId: 'p2', title: 'Coordinator' })]),
    ], ctx, none)
    expect(plans.map((p) => p.audience).sort()).toEqual(['outplacement', 'rapid_response'])
    for (const p of plans) {
      expect(p.bodyHtml.startsWith('<p>Hi {{firstName}} -')).toBe(true)
      expect(p.bodyHtml).toContain('<div data-signature>')
      expect(p.bodyHtml).toMatch(/15 minutes this week|Want the link to pass along/)
      expect(p.bodyHtml).not.toContain('launchyournextchapter.com/network/company/acme')
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
    const w = sweepWhere(now) as unknown as { employees: unknown; outreachCheckedAt: unknown; dismissedAt: unknown; fetchedAt: { lte: Date; gte: Date }; AND: unknown[]; NOT: unknown }
    expect(OUTREACH_MIN_EMPLOYEES).toBe(50)
    expect(w.employees).toEqual({ gte: 50 })
    expect(w.outreachCheckedAt).toBeNull()
    expect(w.dismissedAt).toBeNull()
    expect(w.fetchedAt.lte.getTime()).toBe(now.getTime() - OUTREACH_MIN_AGE_HOURS * 3_600_000)
    expect(w.fetchedAt.gte.getTime()).toBe(now.getTime() - 5 * 86_400_000)
    expect(w.AND[0]).toEqual({ OR: [{ country: null }, { country: 'US' }] })
    // Filed in the last 30 days, not only loaded: a state's WARN archive loaded today is history (2026-11-17).
    expect(w.AND[1]).toEqual({ OR: [{ noticeDate: null }, { noticeDate: { gte: new Date(now.getTime() - 30 * 86_400_000) } }] })
    expect(w.NOT).toEqual({ alertHeldAt: { not: null }, alertSentAt: null, alertGaveUpAt: null })
  })
})

describe('outreach copy v3', async () => {
  const { askArm, outreachCopy, taggedLink, LINK_ASK, CALL_ASK } = await import('@/lib/warn/outreach/copy')
  const base = { greet: 'Chelsea', picture, bls: '27.6% of unemployed Americans have been looking for 27 weeks or longer (BLS, October)', signOff: SIGN_OFF }
  const all = ['hr', 'job_center', 'workforce_board', 'economic_development', 'rapid_response'] as const
  it('splits the ask by a hash of the address, the same address always the same arm, Rapid Response always the call', () => {
    expect(askArm('A@b.com', 'hr')).toBe(askArm(' a@b.com ', 'hr'))
    const arms = new Set(Array.from({ length: 40 }, (_, i) => askArm(`p${i}@x.org`, 'job_center')))
    expect(arms).toEqual(new Set(['A', 'B']))
    expect(askArm('a@b.com', 'rapid_response')).toBe('B')
  })
  it('differs between the two arms only in the ask, the line before the first-name sign-off', () => {
    for (const audience of ['hr', 'job_center', 'workforce_board', 'economic_development'] as const) {
      for (const mode of ['new', 'older'] as const) {
        const a = outreachCopy({ ...base, audience, mode, arm: 'A' })
        const b = outreachCopy({ ...base, audience, mode, arm: 'B' })
        expect(a.subject).toBe(b.subject)
        const parts = (s: string) => s.split('\n\n')
        expect(parts(a.body).slice(0, -3)).toEqual(parts(b.body).slice(0, -3))
        expect(parts(a.body).at(-3)).toBe(LINK_ASK)
        expect(parts(b.body).at(-3)).toBe(CALL_ASK)
        expect(parts(a.body).at(-2)).toBe('Justin')
      }
    }
  })
  it('is short, has no link and no statistic for HR, one offer, signs off with the first name', () => {
    const words = (s: string) => s.split('\n\n').slice(0, -1).join(' ').split(/\s+/).length
    for (const audience of all) {
      for (const mode of ['new', 'older'] as const) {
        const m = outreachCopy({ ...base, audience, mode, arm: 'B' })
        expect(words(m.body)).toBeLessThan(90)
        expect(m.body.split('\n\n').slice(0, -1).join(' ')).not.toMatch(/https?:\/\//)
        expect(m.body).not.toMatch(/I saw that|hope this|seats|Best,|'s's/i)
        expect(m.body).toContain('free job matching')
        expect(m.body).toMatch(/adds? their email/)
        expect(m.body.split('\n\n')[0]).toBe('Hi Chelsea -')
      }
    }
    expect(outreachCopy({ ...base, audience: 'hr', mode: 'older', arm: 'B' }).body).not.toContain('BLS')
    expect(outreachCopy({ ...base, audience: 'workforce_board', mode: 'older', arm: 'B' }).body).toContain('a few weeks since')
    expect(outreachCopy({ ...base, audience: 'hr', mode: 'new', arm: 'B' }).body).not.toContain('a few weeks')
  })
  it('writes subjects in sentence case from the employer, the headcount and the place only', () => {
    const subj = (audience: (typeof all)[number], mode: 'new' | 'older') => outreachCopy({ ...base, audience, mode, arm: 'A' }).subject
    expect(subj('hr', 'new')).toBe('Job matching for the 875 leaving Acme')
    expect(subj('hr', 'older')).toBe('Job matching for the 875 who left Acme')
    expect(subj('job_center', 'new')).toBe('If someone from Acme walks in')
    expect(subj('rapid_response', 'new')).toBe('Before your Acme meeting')
    for (const audience of all) for (const mode of ['new', 'older'] as const) {
      const s = subj(audience, mode)
      expect(s[0]).toBe(s[0].toUpperCase())
      expect(s).toContain('Acme')
      expect(s).not.toMatch(/\bfree\b|!|\$|guarantee|urgent|act now/i)
    }
  })
  it('tags the page link so a sign-up can be traced to the email, and keeps the link on the page that answers', () => {
    const u = new URL(taggedLink('https://launchyournextchapter.com/layoffs/company/acme', { audience: 'hr', arm: 'A', noticeId: 'n1' }))
    expect(u.pathname).toBe('/layoffs/company/acme')
    expect(Object.fromEntries(u.searchParams)).toEqual({ utm_source: 'layoff_outreach', utm_medium: 'email', utm_campaign: 'hr', utm_content: 'A', lo_n: 'n1' })
  })
  it('planOutreach uses v3 for every audience, merges the first name and renders the signature block', () => {
    const plans = planOutreach([group('head_hr', [card()]), group('economic_development', [card({ name: 'Ed Dev', email: 'ed@chamber.org', greet: 'Ed', personId: undefined, title: null })])], ctx, { blocked: new Set(), noticeId: 'n9' })
    const hr = plans.find((p) => p.audience === 'outplacement')!
    expect(hr.bodyHtml).not.toContain('https://launchyournextchapter.com/network')
    expect(hr.bodyHtml).toContain('<div data-signature>Justin Kulla')
    const ed = plans.find((p) => p.audience === 'economic_development')!
    expect(ed.bodyHtml).toContain('free job matching')
    expect(ed.bodyHtml).not.toContain('We sit alongside them')
    expect(ed.bodyHtml).toContain('Hi {{firstName}} -')
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

describe('the backfill week', async () => {
  const { assignDays, weekSendTimes, BACKFILL_HEADLINE, SUPPRESSION_MARK_BEFORE } = await import('@/lib/warn/outreach/backfill-rules')
  const { subjectFor } = await import('@/lib/warn/outreach/copy')
  const { headlineOf } = await import('@/lib/warn/outreach/stats')

  it('sends Monday to Thursday at 9 a.m. Eastern, across the daylight-saving change', () => {
    expect(weekSendTimes(new Date('2026-11-16T15:00:00Z')).map((d) => d.toISOString())).toEqual(['2026-11-16T14:00:00.000Z', '2026-11-17T14:00:00.000Z', '2026-11-18T14:00:00.000Z', '2026-11-19T14:00:00.000Z'])
    expect(weekSendTimes(new Date('2026-03-09T15:00:00Z'))[0].toISOString()).toBe('2026-03-09T13:00:00.000Z')
  })
  it('splits the editions across the days by recipients, biggest first, evenly', () => {
    const eds = Array.from({ length: 40 }, (_, i) => ({ id: `e${String(i).padStart(2, '0')}`, recipients: 1 + (i % 5) }))
    const day = assignDays(eds, 4)
    const load = [0, 0, 0, 0]
    for (const e of eds) load[day.get(e.id)!] += e.recipients
    expect(Math.max(...load) - Math.min(...load)).toBeLessThanOrEqual(5)
    expect(day.size).toBe(40)
  })
  it('gives every backfill email one subject, the audience line the live emails use, in sentence case', () => {
    expect(BACKFILL_HEADLINE).toBe('aud')
    const f = { org: 'Acme', employees: 1200, state: 'KY', county: 'Warren County', audience: 'job_center' as const, mode: 'new' as const }
    expect(subjectFor(f)).toBe('If someone from Acme walks in')
    expect(subjectFor({ ...f, audience: 'workforce_board' })).toBe('The Acme layoff in Warren County')
    expect(subjectFor({ ...f, audience: 'hr', employees: null, mode: 'older' })).toBe('Job matching for the people who left Acme')
  })
  it('reads the style and the day back from an edition title; the deploy-time marks are the only ones the backfill looks past', () => {
    expect(headlineOf('Acme · Job center · h:q1 · day 2')).toEqual({ code: 'q1', day: 2 })
    expect(headlineOf('Acme · Job center')).toBeNull()
    expect(SUPPRESSION_MARK_BEFORE.toISOString()).toBe('2026-11-13T03:08:00.000Z')
  })
})

describe('who is safe to email', async () => {
  const { addressQuality, isRoleAddress } = await import('@/lib/warn/outreach/quality')
  const now = new Date('2026-11-13T12:00:00Z')
  const base = { email: 'jane.doe@acme.com', personId: 'p1', hunterStatus: 'deliverable', hunterScore: 95, hunterAt: new Date('2026-10-20T00:00:00Z'), primaryMatches: true, warmth: 'UNKNOWN', replied: false, domainDelivered: 0, domainBounced: 0, mx: true, directory: null }
  it('sends only to a CRM contact Hunter marked deliverable, recently', () => {
    expect(addressQuality(base, now).ok).toBe(true)
    expect(addressQuality({ ...base, hunterStatus: 'valid' }, now).ok).toBe(true)
    for (const s of ['risky', 'invalid', 'undeliverable', null]) expect(addressQuality({ ...base, hunterStatus: s }, now).reason).toBe('not verified deliverable')
    expect(addressQuality({ ...base, hunterAt: new Date('2026-03-01T00:00:00Z') }, now).ok).toBe(false)
    expect(addressQuality({ ...base, primaryMatches: false }, now).ok).toBe(false)
  })
  it('never sends to a directory address with no contact behind it (the only two bounces so far), a role address, or a dead domain', () => {
    expect(addressQuality({ ...base, personId: null }, now).reason).toBe('no verified contact')
    for (const e of ['info@acme.com', 'jobs@acme.com', 'Careers@acme.com', 'hr@acme.com', 'contact.us@acme.com', 'no-reply@acme.com']) expect(isRoleAddress(e), e).toBe(true)
    expect(isRoleAddress('jane.doe@acme.com')).toBe(false)
    expect(addressQuality({ ...base, email: 'info@acme.com' }, now).reason).toBe('role address')
    expect(addressQuality({ ...base, mx: false }, now).reason).toBe('domain has no mail server')
    expect(addressQuality({ ...base, mx: null }, now).ok).toBe(true) // an inconclusive lookup is not held against it
    expect(addressQuality({ ...base, domainBounced: 1, domainDelivered: 0 }, now).reason).toBe('domain bounced before')
    expect(addressQuality({ ...base, domainBounced: 1, domainDelivered: 5 }, now).ok).toBe(true)
  })
  it('holds a domain that bounced us lately, however verified the address (the Baltimore bounces, 2026-11-13)', () => {
    const bounced = { domainDelivered: 12, domainBounced: 2, domainLastBounceAt: new Date('2026-11-13T10:00:00Z'), domainLastCleanAt: new Date('2026-11-01T00:00:00Z') }
    expect(addressQuality({ ...base, hunterScore: 100, ...bounced }, now).reason).toBe('domain bounced recently')
    expect(addressQuality({ ...base, ...bounced, domainLastCleanAt: new Date('2026-11-13T11:00:00Z') }, now).ok).toBe(true) // delivered cleanly since
    expect(addressQuality({ ...base, ...bounced, domainLastBounceAt: new Date('2026-09-01T00:00:00Z') }, now).ok).toBe(true) // an old bounce
    expect(addressQuality({ ...base, email: 'jane.doe@hotmail.com', ...bounced }, now).ok).toBe(true) // a shared provider is not one domain
  })
  it('trusts a Hunter check for 90 days', () => {
    expect(addressQuality({ ...base, hunterAt: new Date('2026-08-20T00:00:00Z') }, now).ok).toBe(true)
    expect(addressQuality({ ...base, hunterAt: new Date('2026-08-01T00:00:00Z') }, now).ok).toBe(false)
  })
  it('lets a contact who has replied through, and ranks the warm and proven first', () => {
    const replied = addressQuality({ ...base, hunterStatus: null, replied: true }, now)
    expect(replied.ok).toBe(true)
    expect(addressQuality({ ...base, warmth: 'HOT', replied: true, domainDelivered: 3 }, now).score).toBeGreaterThan(addressQuality(base, now).score)
  })
})

describe('layoff pacing', async () => {
  const r = await import('@/lib/mailing/layoff-pacing-rules')
  const { assignDaysByCap, sendDayTimes } = await import('@/lib/warn/outreach/backfill-rules')
  it('trickles: 2 a run, one run in four skipped, 2 a day to one domain, a slow ramp', () => {
    expect(r.LAYOFF_RUN_MAX).toBe(2)
    expect(r.LAYOFF_PER_DOMAIN_PER_DAY).toBe(2)
    expect([0, 1, 2, 3, 4, 9].map(r.layoffDailyCap)).toEqual([40, 60, 80, 100, 120, 120])
    expect(r.LAYOFF_RUN_MAX * 12 * 4).toBeGreaterThan(r.layoffDailyCap(0)) // a 4-hour window can reach the cap, never a burst
  })
  it('spaces emails to one domain and stops a domain that bounced today', () => {
    const now = new Date('2026-11-13T16:00:00Z')
    expect(r.domainMaySend(undefined, now)).toBe(true)
    expect(r.domainMaySend({ sent: 1, bounced: 0, lastSentAt: new Date('2026-11-13T15:59:59Z') }, now)).toBe(false)
    expect(r.domainMaySend({ sent: 1, bounced: 0, lastSentAt: new Date('2026-11-13T15:20:00Z') }, now)).toBe(true)
    expect(r.domainMaySend({ sent: 1, bounced: 1, lastSentAt: new Date('2026-11-13T10:00:00Z') }, now)).toBe(false)
    expect(r.domainMaySend({ sent: 2, bounced: 0, lastSentAt: new Date('2026-11-13T10:00:00Z') }, now)).toBe(false)
  })
  it('stops for a day when bounces reach 3% of at least 20, or on any spam complaint', () => {
    expect(r.layoffBreakerTripped(100, 2, 0)).toBe(false)
    expect(r.layoffBreakerTripped(100, 3, 0)).toBe(true)
    expect(r.layoffBreakerTripped(10, 5, 0)).toBe(false)
    expect(r.layoffBreakerTripped(10, 0, 1)).toBe(true)
  })
  it('fills the days in order against the ramp, best editions first', () => {
    const eds = Array.from({ length: 30 }, (_, i) => ({ id: `e${i}`, recipients: 5 }))
    const day = assignDaysByCap(eds, [40, 60, 80])
    expect([...day.values()].filter((d) => d === 0).length).toBe(8)
    expect([...day.values()].filter((d) => d === 1).length).toBe(12)
    expect(day.get('e0')).toBe(0)
    expect(day.get('e29')).toBe(2)
  })
  it('sends every day, weekends included, at 9 a.m. Eastern', () => {
    const t = sendDayTimes(new Date('2026-11-16T15:00:00Z'), 6).map((d) => d.toISOString())
    expect(t).toEqual(['2026-11-16T14:00:00.000Z', '2026-11-17T14:00:00.000Z', '2026-11-18T14:00:00.000Z', '2026-11-19T14:00:00.000Z', '2026-11-20T14:00:00.000Z', '2026-11-21T14:00:00.000Z'])
  })
  it('keeps spam words out of every subject', async () => {
    const { subjectFor } = await import('@/lib/warn/outreach/copy')
    for (const audience of ['hr', 'job_center', 'workforce_board', 'rapid_response', 'economic_development'] as const) for (const mode of ['new', 'older'] as const)
      expect(subjectFor({ org: 'Acme', employees: 120, state: 'KY', county: null, audience, mode }), `${audience} ${mode}`).not.toMatch(/\bfree\b|!|\$|guarantee|urgent|act now/i)
  })
})

describe('verifying directory addresses and cleaning names', async () => {
  const { addressQuality, needsVerification } = await import('@/lib/warn/outreach/quality')
  const { cleanEmployerName } = await import('@/lib/warn/outreach/employer-name')
  const now = new Date('2026-11-13T12:00:00Z')
  const dir = { email: 'sam.lee@workforce.org', personId: null as string | null, hunterStatus: null, hunterScore: null, hunterAt: null, primaryMatches: false, warmth: null, replied: false, domainDelivered: 0, domainBounced: 0, mx: true as boolean | null, directory: null as { status: string; score: number | null; at: Date } | null }
  it('emails a directory address only after Hunter called it deliverable with a high score, recently', () => {
    expect(addressQuality(dir, now).reason).toBe('no verified contact')
    expect(addressQuality({ ...dir, directory: { status: 'deliverable', score: 96, at: new Date('2026-11-12T00:00:00Z') } }, now).ok).toBe(true)
    expect(addressQuality({ ...dir, directory: { status: 'deliverable', score: 80, at: new Date('2026-11-12T00:00:00Z') } }, now).ok).toBe(false)
    for (const status of ['risky', 'invalid']) expect(addressQuality({ ...dir, directory: { status, score: 99, at: new Date('2026-11-12T00:00:00Z') } }, now).reason).toBe('not verified deliverable')
    expect(addressQuality({ ...dir, directory: { status: 'deliverable', score: 99, at: new Date('2026-01-01T00:00:00Z') } }, now).ok).toBe(false)
  })
  it('spends a credit only on an address that passes every other rule and has not been checked', () => {
    expect(needsVerification(dir, now)).toBe(true)
    expect(needsVerification({ ...dir, email: 'info@workforce.org' }, now)).toBe(false)
    expect(needsVerification({ ...dir, mx: false }, now)).toBe(false)
    expect(needsVerification({ ...dir, domainBounced: 2 }, now)).toBe(false)
    expect(needsVerification({ ...dir, domainBounced: 1, domainDelivered: 4, domainLastBounceAt: new Date('2026-11-12T00:00:00Z'), domainLastCleanAt: null }, now)).toBe(false)
    expect(needsVerification({ ...dir, directory: { status: 'invalid', score: 10, at: new Date('2026-11-12T00:00:00Z') } }, now)).toBe(false)
    expect(needsVerification({ ...dir, personId: 'p1', primaryMatches: true, hunterStatus: 'risky', hunterAt: new Date('2026-11-01T00:00:00Z') }, now)).toBe(false)
    expect(needsVerification({ ...dir, personId: 'p1', primaryMatches: true, hunterStatus: null }, now)).toBe(true)
  })
  it('writes the employer as a person would, with no filing address or plant name', () => {
    expect(cleanEmployerName('The Mosaic Company 5880 Manley Road FORT MEADE, FL, 33841')).toBe('The Mosaic Company')
    expect(cleanEmployerName('Excel Mining LLC - MC Mining Preparation Plant')).toBe('Excel Mining LLC')
    expect(cleanEmployerName('DHL Supply Chain (Formerly Exel)')).toBe('DHL Supply Chain')
    expect(cleanEmployerName('Acme Corp 100 Main Street Suite 4 Louisville KY 40202')).toBe('Acme Corp')
    for (const n of ['TomTom', 'Century Aluminum of Kentucky Hawesville', 'Laurel Grocery Company LLC', 'Jabil Inc', '3M', '7-Eleven, Inc.']) expect(cleanEmployerName(n)).toBe(n)
    expect(cleanEmployerName('A'.repeat(30) + ' ' + 'B'.repeat(40)).length).toBeLessThanOrEqual(60)
  })
})

describe('when Hunter cannot be asked', async () => {
  const { isVerifyBlocked } = await import('@/lib/warn/outreach/quality')
  it('stops waiting for an answer that cannot come, but keeps waiting when it only paused', () => {
    for (const s of ['floor', 'daily', 'hunter_error', 'not_configured']) expect(isVerifyBlocked(s), s).toBe(true)
    for (const s of ['done', 'cap', 'time']) expect(isVerifyBlocked(s), s).toBe(false)
  })
})

describe('board first (owner, 2026-11-17)', async () => {
  const { outreachCopy, listNames } = await import('@/lib/warn/outreach/copy')
  const board = group('workforce_board', [card({ name: 'Bo Ard', email: 'bo@board.org', greet: 'Bo', personId: 'b1', title: 'Director' })])
  const centers = group('job_centers', [card({ name: 'Center', email: 'c@center.org', greet: 'team', personId: undefined, title: null })])
  const edo = group('economic_development', [card({ name: 'Ed', email: 'ed@chamber.org', greet: 'Ed', personId: undefined, title: null })])
  const withPartners = { ...ctx, partners: ['One Louisville', 'Goodwill Kentucky', 'Louisville Urban League'] }

  it('emails the board and leaves the job centers and economic development to it', () => {
    const plans = planOutreach([board, centers, edo, group('head_hr', [card()])], withPartners, none)
    expect(plans.map((p) => p.audience).sort()).toEqual(['outplacement', 'workforce_board'])
  })
  it('still emails the job centers and economic development when there is no board address to email', () => {
    const plans = planOutreach([group('workforce_board', [card({ name: 'Guess', email: 'g@board.org', guessed: true })]), centers, edo], withPartners, none)
    expect(plans.map((p) => p.audience).sort()).toEqual(['economic_development', 'job_center'])
  })
  it('names the other organizations in the board note only, and keeps it short with no link', () => {
    const base = { greet: 'Bo', picture, bls: 'x', signOff: SIGN_OFF, mode: 'new' as const, arm: 'B' as const, partners: withPartners.partners }
    const b = outreachCopy({ ...base, audience: 'workforce_board' }).body
    expect(b).toContain('One Louisville, Goodwill Kentucky and Louisville Urban League serve them too, and it works for all of you.')
    expect(b.split('\n\n').slice(0, -1).join(' ').split(/\s+/).length).toBeLessThan(110)
    expect(b.split('\n\n').slice(0, -1).join(' ')).not.toMatch(/https:\/\//)
    expect(outreachCopy({ ...base, audience: 'job_center' }).body).not.toContain('serve them too')
    expect(outreachCopy({ ...base, audience: 'workforce_board', partners: [] }).body).not.toContain('serve them too')
    expect(listNames(['A'])).toBe('A')
    expect(listNames(['A', 'B'])).toBe('A and B')
    expect(outreachCopy({ ...base, audience: 'workforce_board', partners: ['Northeastern Nevada Regional Development Authority'] }).body).toContain('Northeastern Nevada Regional Development Authority serves them too')
    expect(outreachCopy({ ...base, audience: 'workforce_board', partners: ['Clallam County ADO (clallam.org)', 'X'] }).body).toContain('Clallam County ADO and X serve them too')
  })
})

describe('board directors and accept-all (owner, 2026-11-17)', async () => {
  const { addressQuality } = await import('@/lib/warn/outreach/quality')
  const now = new Date('2026-11-17T12:00:00Z')
  const checked = new Date('2026-11-16T00:00:00Z')
  const dir = { email: 'jdoe@maricopa.gov', personId: null, hunterStatus: null, hunterScore: null, hunterAt: null, primaryMatches: false, warmth: null, replied: false, domainDelivered: 0, domainBounced: 0, mx: true, directory: { status: 'risky', hunterStatus: 'accept_all', score: 80, at: checked } }
  it('emails a listed board director whose address Hunter calls accept-all', () => {
    expect(addressQuality({ ...dir, boardDirector: true }, now).ok).toBe(true)
  })
  it('still refuses accept-all for anyone who is not a listed board director, and any director address Hunter calls invalid or unknown', () => {
    expect(addressQuality({ ...dir, boardDirector: false }, now).ok).toBe(false)
    expect(addressQuality({ ...dir, boardDirector: true, directory: { ...dir.directory, status: 'invalid', hunterStatus: 'invalid' } }, now).ok).toBe(false)
    expect(addressQuality({ ...dir, boardDirector: true, directory: { ...dir.directory, hunterStatus: 'unknown' } }, now).ok).toBe(false)
  })
  it('keeps the hard stops for a director: a domain that bounced us recently, a role address', () => {
    expect(addressQuality({ ...dir, boardDirector: true, domainBounced: 1, domainLastBounceAt: new Date('2026-11-15T00:00:00Z') }, now).ok).toBe(false)
    expect(addressQuality({ ...dir, email: 'info@maricopa.gov', boardDirector: true }, now).ok).toBe(false)
  })
})
