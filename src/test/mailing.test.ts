import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { detectReportEdition, editionFromBody, editionFromFilename, monthKeyFrom } from '@/lib/mailing/edition-parser'
import { computeRoster, rosterCounts, type RosterMember, type RosterRow } from '@/lib/mailing/roster'
import { canAddToList, normalizeListEmail } from '@/lib/mailing/rules'
import { verifyResendSignature } from '@/lib/mailing/webhook-signature'
import { makeUnsubscribeToken, readUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { isUnsubscribeReply, baseSubject } from '@/lib/mailing/replies'
import { renderEmail, sanitizeBodyHtml } from '@/lib/mailing/render'
import { suggestListKeys } from '@/lib/mailing/suggest'

describe('edition parser', () => {
  it('reads YYYY-MM from report attachment filenames', () => {
    expect(editionFromFilename('displacement-report-2026-09.pdf')).toBe('2026-09')
    expect(editionFromFilename('NextChapter-Displacement-Report-2026-10.pdf')).toBe('2026-10')
    expect(editionFromFilename('displacement-report-2026-09-brief.pdf')).toBe('2026-09')
    expect(editionFromFilename('DISPLACEMENT-REPORT-2026-11.PDF')).toBe('2026-11')
  })
  it('reads a month name and year too', () => {
    expect(editionFromFilename('displacement-report-september-2026.html')).toBe('2026-09')
    expect(monthKeyFrom('october-2026')).toBe('2026-10')
  })
  it('ignores files that are not the report, and impossible months', () => {
    expect(editionFromFilename('resume-2026-09.pdf')).toBeNull()
    expect(editionFromFilename('my-displacement-report-2026-09.pdf')).toBeNull()
    expect(editionFromFilename('displacement-report-2026-13.pdf')).toBeNull()
    expect(editionFromFilename('displacement-report-final.pdf')).toBeNull()
  })
  it('reads report links in the body', () => {
    expect(editionFromBody('Here it is: https://launchyournextchapter.com/reports/displacement-report-september-2026 — enjoy')).toBe('2026-09')
    expect(editionFromBody('see launchyournextchapter.com/reports/files/monthly-2026-10')).toBe('2026-10')
    expect(editionFromBody('<https://www.launchyournextchapter.com/reports/2026-08/summary>')).toBe('2026-08')
  })
  it('ignores other links and report links without a month', () => {
    expect(editionFromBody('https://example.com/reports/2026-09')).toBeNull()
    expect(editionFromBody('https://launchyournextchapter.com/news/2026-09-jobs')).toBeNull()
    expect(editionFromBody('https://launchyournextchapter.com/reports/latest')).toBeNull()
    expect(editionFromBody(null)).toBeNull()
  })
  it('prefers the attachment over the body', () => {
    expect(detectReportEdition({ attachmentNames: ['notes.txt', 'displacement-report-2026-09.pdf'], body: 'launchyournextchapter.com/reports/2026-10' })).toBe('2026-09')
    expect(detectReportEdition({ attachmentNames: ['notes.txt'], body: 'launchyournextchapter.com/reports/2026-10' })).toBe('2026-10')
    expect(detectReportEdition({})).toBeNull()
  })
})

describe('roster math', () => {
  const m = (email: string, listKey: string, status: RosterMember['status'] = 'ACTIVE', personId: string | null = null): RosterMember => ({ email, listKey, status, personId })
  const base = { existing: [] as RosterRow[], suppressed: new Set<string>(), manualSends: new Map<string, Date>() }

  it('sends once to someone on two targeted lists', () => {
    const rows = computeRoster({ ...base, members: [m('a@x.com', 'customers', 'ACTIVE', 'p1'), m('a@x.com', 'ecosystem', 'ACTIVE', 'p1'), m('b@x.com', 'ecosystem')] })
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.email === 'a@x.com')!.fromListKeys).toEqual(['customers', 'ecosystem'])
    expect(rosterCounts(rows)).toEqual({ base: 2, excluded: 0, added: 0, total: 2 })
  })

  it('is base − excluded + added', () => {
    const members = ['a', 'b', 'c', 'd', 'e'].map((x) => m(`${x}@x.com`, 'monthly_update'))
    const first = computeRoster({ ...base, members })
    const edited: RosterRow[] = first.map((r) => (r.email === 'a@x.com' || r.email === 'b@x.com' ? { ...r, excluded: true, excludedReason: 'unchecked' } : r))
    edited.push({ email: 'z@x.com', personId: 'pz', source: 'ADDED_THIS_EDITION', excluded: false, excludedReason: null, fromListKeys: [], alsoAddToListIds: [], status: 'PENDING' })
    const rows = computeRoster({ ...base, members, existing: edited })
    expect(rosterCounts(rows)).toEqual({ base: 5, excluded: 2, added: 1, total: 4 })
    expect(rows.filter((r) => !r.excluded).map((r) => r.email).sort()).toEqual(['c@x.com', 'd@x.com', 'e@x.com', 'z@x.com'])
  })

  it('leaves out unsubscribed, bounced and suppressed addresses', () => {
    const rows = computeRoster({
      ...base,
      suppressed: new Set(['s@x.com']),
      members: [m('a@x.com', 'monthly_update'), m('u@x.com', 'monthly_update', 'UNSUBSCRIBED'), m('b@x.com', 'monthly_update', 'BOUNCED'), m('s@x.com', 'monthly_update')],
    })
    expect(rows.map((r) => r.email)).toEqual(['a@x.com'])
  })

  it('drops someone who unsubscribed from the next roster, but keeps their other list', () => {
    const first = computeRoster({ ...base, members: [m('a@x.com', 'investors'), m('a@x.com', 'monthly_update')] })
    expect(first[0].fromListKeys).toEqual(['investors', 'monthly_update'])
    const next = computeRoster({ ...base, existing: first, members: [m('a@x.com', 'investors', 'UNSUBSCRIBED'), m('a@x.com', 'monthly_update')] })
    expect(next[0].fromListKeys).toEqual(['monthly_update'])
    const gone = computeRoster({ ...base, existing: first, members: [m('a@x.com', 'monthly_update', 'UNSUBSCRIBED')] })
    expect(gone).toHaveLength(0)
  })

  it('starts people who already got it by hand unchecked', () => {
    const rows = computeRoster({ ...base, manualSends: new Map([['p1', new Date('2026-10-02')]]), members: [m('a@x.com', 'monthly_update', 'ACTIVE', 'p1'), m('b@x.com', 'monthly_update', 'ACTIVE', 'p2')] })
    const a = rows.find((r) => r.email === 'a@x.com')!
    expect(a.excluded).toBe(true)
    expect(a.excludedReason).toBe('already_sent_manually')
    expect(rosterCounts(rows).total).toBe(1)
    // Re-checking them in the composer sticks across a refresh.
    const rechecked = rows.map((r) => ({ ...r, excluded: false, excludedReason: null }))
    expect(computeRoster({ ...base, manualSends: new Map([['p1', new Date()]]), existing: rechecked, members: [m('a@x.com', 'monthly_update', 'ACTIVE', 'p1')] })[0].excluded).toBe(false)
  })

  it('starts people another version already reached unchecked', () => {
    const rows = computeRoster({ ...base, versionSends: new Map([['a@x.com', new Date('2026-10-08')]]), members: [m('a@x.com', 'monthly_update', 'ACTIVE', 'p1'), m('b@x.com', 'monthly_update', 'ACTIVE', 'p2')] })
    expect(rows.find((r) => r.email === 'a@x.com')).toMatchObject({ excluded: true, excludedReason: 'already_got_version' })
    expect(rows.find((r) => r.email === 'b@x.com')!.excluded).toBe(false)
  })

  it('keeps sent rows as history even after they leave the list', () => {
    const sent: RosterRow = { email: 'a@x.com', personId: null, source: 'BASE', excluded: false, excludedReason: null, fromListKeys: ['monthly_update'], alsoAddToListIds: [], status: 'SENT' }
    expect(computeRoster({ ...base, existing: [sent], members: [] })).toHaveLength(1)
  })
})

describe('never re-add', () => {
  it('refuses unsubscribed and complained members on that list', () => {
    expect(canAddToList('UNSUBSCRIBED', null)).toEqual({ ok: false, reason: 'unsubscribed' })
    expect(canAddToList('COMPLAINED', null)).toEqual({ ok: false, reason: 'complained' })
  })
  it('refuses everything for someone marked Do not email', () => {
    expect(canAddToList(null, 'DO_NOT_EMAIL')).toEqual({ ok: false, reason: 'do_not_email' })
    expect(canAddToList('ACTIVE', 'DO_NOT_EMAIL')).toEqual({ ok: false, reason: 'do_not_email' })
  })
  it('refuses every list after a complaint or bounce', () => {
    expect(canAddToList(null, 'COMPLAINED')).toEqual({ ok: false, reason: 'complained' })
    expect(canAddToList(null, 'BOUNCED')).toEqual({ ok: false, reason: 'bounced' })
  })
  it('allows a new list, and reports an existing active membership', () => {
    expect(canAddToList(null, null)).toEqual({ ok: true, action: 'create' })
    expect(canAddToList('ACTIVE', null)).toEqual({ ok: false, reason: 'already_active' })
  })
  it('normalizes addresses', () => {
    expect(normalizeListEmail('  Jane@Example.COM ')).toBe('jane@example.com')
    expect(normalizeListEmail('not an email')).toBeNull()
  })
})

describe('webhook signature', () => {
  const secretBytes = Buffer.from('test-secret-key-for-mailing-hooks')
  const secret = `whsec_${secretBytes.toString('base64')}`
  const sign = (id: string, ts: string, body: string) => createHmac('sha256', secretBytes).update(`${id}.${ts}.${body}`).digest('base64')
  const now = 1_790_000_000_000
  const ts = String(now / 1000)
  const body = JSON.stringify({ type: 'email.opened', data: { email_id: 'abc' } })

  it('accepts a correctly signed event', () => {
    expect(verifyResendSignature(body, { id: 'msg_1', timestamp: ts, signature: `v1,${sign('msg_1', ts, body)}` }, secret, now)).toBe(true)
  })
  it('accepts when one of several signatures matches (key rotation)', () => {
    expect(verifyResendSignature(body, { id: 'msg_1', timestamp: ts, signature: `v1,AAAA v1,${sign('msg_1', ts, body)}` }, secret, now)).toBe(true)
  })
  it('rejects a tampered body, a wrong secret, and missing headers', () => {
    const sig = `v1,${sign('msg_1', ts, body)}`
    expect(verifyResendSignature(body.replace('opened', 'clicked'), { id: 'msg_1', timestamp: ts, signature: sig }, secret, now)).toBe(false)
    expect(verifyResendSignature(body, { id: 'msg_1', timestamp: ts, signature: sig }, `whsec_${Buffer.from('other').toString('base64')}`, now)).toBe(false)
    expect(verifyResendSignature(body, { id: null, timestamp: ts, signature: sig }, secret, now)).toBe(false)
  })
  it('rejects an old timestamp (replay)', () => {
    const sig = `v1,${sign('msg_1', ts, body)}`
    expect(verifyResendSignature(body, { id: 'msg_1', timestamp: ts, signature: sig }, secret, now + 10 * 60_000)).toBe(false)
  })
})

describe('unsubscribe tokens', () => {
  it('round-trips and rejects tampering', () => {
    const t = makeUnsubscribeToken('Jane@X.com', 'ed_1', 'k')
    expect(readUnsubscribeToken(t, 'k')).toEqual({ email: 'jane@x.com', editionId: 'ed_1' })
    expect(readUnsubscribeToken(t, 'other-key')).toBeNull()
    const [, , sig] = t.split('.')
    const forged = `${Buffer.from('boss@x.com').toString('base64url')}..${sig}`
    expect(readUnsubscribeToken(forged, 'k')).toBeNull()
    expect(readUnsubscribeToken(makeUnsubscribeToken('a@x.com', null, 'k'), 'k')).toEqual({ email: 'a@x.com', editionId: null })
  })
})

describe('unsubscribe replies', () => {
  it('spots a bare unsubscribe or remove', () => {
    expect(isUnsubscribeReply('Re: October update', 'Unsubscribe On Tue, Oct 7, 2026 at 9:00 AM Justin Kulla wrote: Hi there')).toBe(true)
    expect(isUnsubscribeReply('Re: October update', 'remove me please')).toBe(true)
    expect(isUnsubscribeReply('unsubscribe', '')).toBe(true)
  })
  it('does not fire on real replies that mention it', () => {
    expect(isUnsubscribeReply('Re: October update', 'Great report. I almost hit unsubscribe on the last one but this was useful')).toBe(false)
    expect(isUnsubscribeReply('Re: October update', 'Thanks Justin!')).toBe(false)
  })
  it('matches reply subjects to the original', () => {
    expect(baseSubject('RE: Fwd: Re:  The October   report')).toBe('the october report')
  })
})

describe('rendering', () => {
  it('keeps bold, underline, bullets and links; strips everything else', () => {
    const out = sanitizeBodyHtml('<p style="color:red" onclick="x()">Hi <b>there</b> <u>u</u></p><ul><li>one</li></ul><a href="javascript:alert(1)">bad</a><a href="https://ok.com" target="_blank">ok</a><script>alert(1)</script><img src=x>')
    expect(out).toBe('<p>Hi <b>there</b> <u>u</u></p><ul><li>one</li></ul><a>bad</a><a href="https://ok.com">ok</a>')
  })
  it('fills merge tags, signs it, and adds the footer with the unsubscribe link', () => {
    const { html, text } = renderEmail({
      bodyHtml: '<p>Hi {{firstName}},</p><p>The report is out.</p>', reportUrl: 'https://launchyournextchapter.com/reports/files/monthly-2026-10',
      merge: { firstName: 'Jane', orgName: null, reportUrl: null },
      footerText: "Reply 'unsubscribe' or [click here] to remove yourself from future emails. NextChapter · {{postalAddress}}",
      postalAddress: '1 Main St, Boston MA', unsubscribeUrl: 'https://launchyournextchapter.com/updates/unsubscribe/t',
    })
    expect(html).toContain('Hi Jane,')
    expect(html).toContain('<p style="margin:0 0 12px 0">Justin</p>')
    expect(html).toContain('href="https://launchyournextchapter.com/updates/unsubscribe/t"')
    expect(html).toContain('1 Main St, Boston MA')
    expect(html).toContain('href="https://launchyournextchapter.com/reports/files/monthly-2026-10"')
    expect(text).toContain('click here (https://launchyournextchapter.com/updates/unsubscribe/t)')
    expect(html).not.toMatch(/<img|logo/i)
  })
  it('falls back to "there" and does not double-sign', () => {
    const { html } = renderEmail({
      bodyHtml: '<p>Hi {{firstName}},</p><p>Best,<br>Justin</p>', merge: { firstName: null, orgName: null, reportUrl: null },
      footerText: '[Unsubscribe]', postalAddress: 'x', unsubscribeUrl: 'u',
    })
    expect(html).toContain('Hi there,')
    expect(html.match(/Justin/g)).toHaveLength(1)
  })
  it('drops blank paragraphs and inlines bullet and spacing styles for email clients', () => {
    expect(sanitizeBodyHtml('<p>One</p><p><br></p><p>&nbsp;</p><p></p><div><br></div><p>Two</p>')).toBe('<p>One</p><p>Two</p>')
    const { html } = renderEmail({
      bodyHtml: '<p>Hi</p><ul><li>a</li><li>b</li></ul><ol><li>c</li></ol>', merge: { firstName: null, orgName: null, reportUrl: null },
      footerText: '[Unsubscribe]', postalAddress: 'x', unsubscribeUrl: 'u',
    })
    expect(html).toContain('<ul style="list-style-type:disc;padding-left:24px;margin:0 0 12px 0"><li style="margin:0 0 6px 0">a</li>')
    expect(html).toContain('<ol style="list-style-type:decimal;')
    expect(html).not.toMatch(/<(p|ul|ol|li)>/)
  })
})

describe('list suggestions', () => {
  it('maps roles, pipelines and customers; always suggests the Monthly Update', () => {
    expect(suggestListKeys({ roles: [], pipelineKeys: [], isCustomer: false })).toEqual(['monthly_update'])
    expect(suggestListKeys({ roles: ['INVESTOR_ANGEL', 'COACH_PROSPECT'], pipelineKeys: ['outplacement'], isCustomer: true }).sort())
      .toEqual(['customers', 'ecosystem', 'investors', 'leads', 'monthly_update'])
    expect(suggestListKeys({ roles: ['PRESS'], pipelineKeys: ['hiring_managers'], isCustomer: false })).toEqual(['monthly_update'])
  })
})

import { audienceWhere, describeAudience, isEmptyAudience, EMPTY_AUDIENCE } from '@/lib/mailing/audience'

describe('group filter', () => {
  it('is empty until something is chosen', () => {
    expect(isEmptyAudience(EMPTY_AUDIENCE)).toBe(true)
    expect(isEmptyAudience({ ...EMPTY_AUDIENCE, orgs: ' , ' })).toBe(true)
    expect(isEmptyAudience({ ...EMPTY_AUDIENCE, priorities: ['P0'] })).toBe(false)
  })
  it('ORs within a field and ANDs across fields', () => {
    const w = audienceWhere({ roles: ['INVESTOR_VC', 'INVESTOR_ANGEL'], priorities: ['P0', 'P1'], orgs: 'Google, Microsoft', titles: '', history: 'any' })
    expect(w.deletedAt).toBeNull()
    const and = w.AND as object[]
    expect(and).toHaveLength(4)
    expect(and[0]).toEqual({ email: { not: null } })
    expect(and[1]).toEqual({ roles: { hasSome: ['INVESTOR_VC', 'INVESTOR_ANGEL'] } })
    expect(and[2]).toEqual({ priority: { in: ['P0', 'P1'] } })
    expect(JSON.stringify(and[3])).toContain('"Google"')
    expect(JSON.stringify(and[3])).toContain('"Microsoft"')
  })
  it('only counts people with an email, leaves out Do not email, and reads email history', () => {
    const w = audienceWhere({ ...EMPTY_AUDIENCE, history: 'exchanged' }, ['dne1'])
    const and = w.AND as object[]
    expect(and).toContainEqual({ email: { not: null } })
    expect(and).toContainEqual({ id: { notIn: ['dne1'] } })
    expect(JSON.stringify(and)).toContain('"OUTBOUND"')
    expect(JSON.stringify(and)).toContain('"INBOUND"')
    expect(isEmptyAudience({ ...EMPTY_AUDIENCE, history: 'never' })).toBe(false)
  })
  it('describes the group in words', () => {
    expect(describeAudience({ roles: ['PRESS'], priorities: ['P0'], orgs: 'NYT', titles: 'editor', history: 'exchanged' }, (r) => r.toLowerCase())).toBe('press · P0 · at NYT · titled editor · we’ve emailed both ways')
  })
})

import { matchesAudience, audienceFacets } from '@/lib/mailing/audience'

describe('option counts', () => {
  const people = [
    { roles: ['INVESTOR_VC'], priority: 'P0', orgs: ['Acme Ventures'], titles: ['Partner'], sent: 2, received: 1, emailCount: 3 },
    { roles: ['INVESTOR_VC', 'ADVISOR'], priority: 'P2', orgs: ['Beta'], titles: ['Director'], sent: 1, received: 0, emailCount: 1 },
    { roles: ['JOB_SEEKER'], priority: null, orgs: [], titles: [], sent: 0, received: 0, emailCount: 0 },
  ] as Parameters<typeof matchesAudience>[0][]
  it('matches the way the database filter does', () => {
    expect(people.filter((p) => matchesAudience(p, { ...EMPTY_AUDIENCE, history: 'exchanged' }))).toHaveLength(1)
    expect(people.filter((p) => matchesAudience(p, { ...EMPTY_AUDIENCE, history: 'emailed' }))).toHaveLength(2)
    expect(people.filter((p) => matchesAudience(p, { ...EMPTY_AUDIENCE, history: 'never' }))).toHaveLength(1)
    expect(people.filter((p) => matchesAudience(p, { ...EMPTY_AUDIENCE, orgs: 'acme, gamma' }))).toHaveLength(1)
  })
  it('counts each option with the other choices kept', () => {
    const f = audienceFacets(people, { ...EMPTY_AUDIENCE, roles: ['INVESTOR_VC'] }, ['INVESTOR_VC', 'JOB_SEEKER'], ['P0', 'P1', 'P2'])
    expect(f.roles).toEqual({ INVESTOR_VC: 2, JOB_SEEKER: 1 })
    expect(f.priorities).toEqual({ P0: 1, P1: 0, P2: 1 })
    expect(f.history).toEqual({ any: 2, emailed: 2, exchanged: 1, never: 0 })
  })
})
