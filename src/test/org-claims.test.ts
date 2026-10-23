import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  orgClaim: { count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
  crmOrganization: { findUnique: vi.fn() },
  crmPerson: { update: vi.fn() },
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const capture = vi.hoisted(() => vi.fn())
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: capture }))
const mail = vi.hoisted(() => ({ link: vi.fn(async (_p: { to: string; verifyUrl: string }) => true), admin: vi.fn(async (_p: Record<string, unknown>) => true) }))
vi.mock('@/lib/email/send-org-claim-email', () => ({ sendOrgClaimLinkEmail: mail.link, sendOrgClaimAdminEmail: mail.admin }))
const crm = vi.hoisted(() => ({ addContactToCrm: vi.fn(async (_c: Record<string, unknown>) => ({ outcome: 'added', personId: 'p1' })) }))
vi.mock('@/lib/crm/add-contact', () => crm)

import { checkClaimEmail, domainMatches } from '@/lib/org-claims/rules'
import { hashClaimToken, newClaimToken, tokenState, hashIp, CLAIM_TOKEN_DAYS } from '@/lib/org-claims/token'
import { communityStatCards, communityStatSentence, formatWindow, sourceLine } from '@/lib/org-claims/format'
import type { CommunityStats } from '@/lib/org-claims/community-stats'
import { claimUrlFor } from '@/lib/org-claims/urls'
import { confirmOrgClaim, onClaimVerified, requestOrgClaim } from '@/lib/org-claims/claim'
import { applyMergeTags, renderEmail } from '@/lib/mailing/render'

describe('email domain rules', () => {
  it('blocks personal providers, even when the organization has no domain', () => {
    expect(checkClaimEmail('me@gmail.com', 'college.edu')).toMatchObject({ ok: false, reason: 'consumer' })
    expect(checkClaimEmail('me@Yahoo.com', null)).toMatchObject({ ok: false, reason: 'consumer' })
    expect(checkClaimEmail('me@ymail.com', null)).toMatchObject({ ok: false, reason: 'consumer' })
  })
  it('blocks a work email at a different domain than the organization', () => {
    const r = checkClaimEmail('me@other.org', 'college.edu')
    expect(r).toMatchObject({ ok: false, reason: 'mismatch' })
    expect(r.ok === false && r.message).toContain('college.edu')
  })
  it('does not accept look-alike domains', () => {
    expect(domainMatches('notcollege.edu', 'college.edu')).toBe(false)
    expect(domainMatches('college.edu.evil.com', 'college.edu')).toBe(false)
  })
  it('accepts the exact domain and subdomains, with no review needed', () => {
    expect(checkClaimEmail(' Pat@College.edu ', 'college.edu')).toEqual({ ok: true, email: 'pat@college.edu', domain: 'college.edu', needsReview: false })
    expect(checkClaimEmail('pat@mail.college.edu', 'www.College.edu')).toMatchObject({ ok: true, needsReview: false })
  })
  it('accepts any work domain when the organization has none, but marks it for review', () => {
    expect(checkClaimEmail('pat@board.org', null)).toMatchObject({ ok: true, needsReview: true })
    expect(checkClaimEmail('pat@board.org', '')).toMatchObject({ ok: true, needsReview: true })
  })
  it('rejects malformed addresses', () => {
    for (const bad of ['', 'nope', 'a@b', 'a@@b.org', 'a b@c.org']) expect(checkClaimEmail(bad, null)).toMatchObject({ ok: false, reason: 'invalid' })
  })
})

describe('claim tokens', () => {
  it('stores a hash that is not the token, and expires in 7 days', () => {
    const now = new Date('2026-10-23T12:00:00Z')
    const t = newClaimToken(now)
    expect(t.tokenHash).toBe(hashClaimToken(t.token))
    expect(t.tokenHash).not.toContain(t.token)
    expect(t.token.length).toBeGreaterThanOrEqual(40)
    expect(CLAIM_TOKEN_DAYS).toBe(7)
    expect(t.expiresAt.toISOString()).toBe('2026-10-30T12:00:00.000Z')
    expect(newClaimToken().token).not.toBe(t.token)
  })
  it('is ok before expiry, expired after, and used once verified', () => {
    const exp = new Date('2026-10-30T12:00:00Z')
    expect(tokenState({ expiresAt: exp, verifiedAt: null }, new Date('2026-10-29T12:00:00Z'))).toBe('ok')
    expect(tokenState({ expiresAt: exp, verifiedAt: null }, exp)).toBe('expired')
    expect(tokenState({ expiresAt: exp, verifiedAt: new Date() }, new Date('2026-10-24T00:00:00Z'))).toBe('used')
  })
  it('hashes an IP without keeping it', () => {
    expect(hashIp('1.2.3.4', 's')).not.toContain('1.2.3.4')
    expect(hashIp('1.2.3.4', 's')).toBe(hashIp('1.2.3.4', 's'))
    expect(hashIp('1.2.3.4', 's')).not.toBe(hashIp('1.2.3.5', 's'))
  })
})

const stats = (over: Partial<CommunityStats> = {}): CommunityStats => ({
  orgId: 'o1', orgName: 'Example College', slug: 'example-college',
  place: { state: 'KY', stateName: 'Kentucky', countyName: 'Jefferson County', city: 'Louisville', basis: 'college' },
  scope: 'county', window: { days: 180, from: new Date('2026-04-26T00:00:00Z'), to: new Date('2026-10-23T00:00:00Z') },
  source: 'State WARN Act layoff filings', warn: { notices: 12, workers: 1840, employers: 11 }, ...over,
})

describe('community stat formatting', () => {
  it('writes one factual sentence for a county', () => {
    expect(communityStatSentence(stats())).toBe('In Jefferson County, KY, 12 layoff notices covering 1,840 workers were filed in the last six months (state WARN filings).')
  })
  it('names the state when the figures are statewide, and handles singulars', () => {
    expect(communityStatSentence(stats({ scope: 'state', warn: { notices: 1, workers: 1, employers: 1 } }))).toBe('In Kentucky, 1 layoff notice covering 1 worker was filed in the last six months (state WARN filings).')
  })
  it('is empty, never zero or invented, when there is no figure', () => {
    expect(communityStatSentence(null)).toBe('')
    expect(communityStatSentence(stats({ warn: null }))).toBe('')
    expect(communityStatSentence(stats({ warn: { notices: 0, workers: 0, employers: 0 } }))).toBe('')
    expect(communityStatCards(null)).toEqual([])
    expect(communityStatCards(stats({ warn: null }))).toEqual([])
  })
  it('gives every card a reason, and says when the state stands in for a county', () => {
    const cards = communityStatCards(stats({ scope: 'state' }))
    expect(cards).toHaveLength(3)
    expect(cards.every((c) => c.note.startsWith('Why it is here'))).toBe(true)
    expect(cards[0].note).toContain('no notices we could place in Jefferson County')
    expect(cards[0].value).toBe('12')
  })
  it('names the source and the dates', () => {
    expect(formatWindow(stats().window)).toBe('Apr 26, 2026 to Oct 23, 2026')
    expect(sourceLine(stats())).toBe('Source: State WARN Act layoff filings, Apr 26, 2026 to Oct 23, 2026 (the last six months).')
  })
})

describe('merge fields', () => {
  const base = { firstName: 'Pat', orgName: 'Example College', reportUrl: null }
  it('fills {{claimUrl}} and {{communityStat}}', () => {
    const out = applyMergeTags('<p>{{communityStat}}</p><a href="{{claimUrl}}">page</a>', { ...base, claimUrl: 'https://launchyournextchapter.com/prepared/example-college', communityStat: 'In KY, 1 notice & more.' })
    expect(out).toContain('In KY, 1 notice &amp; more.')
    expect(out).toContain('href="https://launchyournextchapter.com/prepared/example-college"')
  })
  it('leaves existing templates alone and empties the new fields when absent', () => {
    expect(applyMergeTags('Hi {{firstName}} at {{orgName}}', base)).toBe('Hi Pat at Example College')
    expect(applyMergeTags('[{{claimUrl}}][{{communityStat}}]', base)).toBe('[][]')
  })
  it('keeps a {{claimUrl}} link through sanitizing and drops the empty paragraph when there is no figure', () => {
    const r = renderEmail({
      bodyHtml: '<p>Hi {{firstName}},</p><p>{{communityStat}}</p><p><a href="{{claimUrl}}">Your page</a></p>', merge: { ...base, claimUrl: 'https://launchyournextchapter.com/prepared/x', communityStat: '' },
      footerText: 'Reply to unsubscribe. {{postalAddress}}', postalAddress: '1 Main St', unsubscribeUrl: 'https://launchyournextchapter.com/u',
    })
    expect(r.html).toContain('href="https://launchyournextchapter.com/prepared/x"')
    expect(r.html).not.toMatch(/<p[^>]*>\s*<\/p>/)
    expect(r.text).toContain('Hi Pat,')
  })
  it('builds the page url only for names that make a safe slug', () => {
    expect(claimUrlFor('example college')).toBe('https://launchyournextchapter.com/prepared/example-college')
    expect(claimUrlFor('a&b partners')).toBeNull()
  })
})

const org = { id: 'o1', name: 'Example College', canonicalNameNormalized: 'example college', emailDomain: 'college.edu' as string | null, orgTypes: ['UNIVERSITY'] }

describe('requestOrgClaim', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.crmOrganization.findUnique.mockResolvedValue(org)
    db.orgClaim.count.mockResolvedValue(0)
    db.orgClaim.create.mockResolvedValue({ id: 'c1' })
    db.orgClaim.updateMany.mockResolvedValue({ count: 0 })
  })
  const input = { slug: 'example-college', name: 'Pat Lee', title: 'Director', email: 'pat@college.edu', ip: '9.9.9.9' }

  it('stores only a hash of the token and emails the link to that address', async () => {
    const r = await requestOrgClaim(input)
    expect(r).toEqual({ ok: true, email: 'pat@college.edu', needsReview: false })
    const data = db.orgClaim.create.mock.calls[0][0].data
    expect(data).toMatchObject({ email: 'pat@college.edu', emailDomain: 'college.edu', needsReview: false })
    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(data.ipHash).not.toContain('9.9.9.9')
    const sent = mail.link.mock.calls[0][0]
    expect(sent.to).toBe('pat@college.edu')
    const token = sent.verifyUrl.split('/verify/')[1]
    expect(hashClaimToken(token)).toBe(data.tokenHash)
    expect(sent.verifyUrl.startsWith('https://launchyournextchapter.com/prepared/example-college/verify/')).toBe(true)
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(6.9 * 86_400_000)
  })
  it('refuses consumer and mismatched domains before storing or sending anything', async () => {
    expect(await requestOrgClaim({ ...input, email: 'pat@gmail.com' })).toMatchObject({ ok: false })
    expect(await requestOrgClaim({ ...input, email: 'pat@other.org' })).toMatchObject({ ok: false })
    expect(db.orgClaim.create).not.toHaveBeenCalled()
    expect(mail.link).not.toHaveBeenCalled()
  })
  it('marks a claim for review when the organization has no known domain', async () => {
    db.crmOrganization.findUnique.mockResolvedValue({ ...org, emailDomain: null })
    expect(await requestOrgClaim({ ...input, email: 'pat@board.org' })).toMatchObject({ ok: true, needsReview: true })
    expect(db.orgClaim.create.mock.calls[0][0].data.needsReview).toBe(true)
  })
  it('rate-limits by IP and by email', async () => {
    db.orgClaim.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0)
    expect(await requestOrgClaim(input)).toMatchObject({ ok: false, error: expect.stringContaining('Too many') })
    db.orgClaim.count.mockResolvedValueOnce(0).mockResolvedValueOnce(3)
    expect(await requestOrgClaim(input)).toMatchObject({ ok: false, error: expect.stringContaining('Too many') })
    expect(db.orgClaim.create).not.toHaveBeenCalled()
  })
  it('needs a full name and a title, and an organization that exists', async () => {
    expect(await requestOrgClaim({ ...input, name: 'Pat' })).toMatchObject({ ok: false })
    expect(await requestOrgClaim({ ...input, title: ' ' })).toMatchObject({ ok: false })
    db.crmOrganization.findUnique.mockResolvedValue(null)
    expect(await requestOrgClaim(input)).toMatchObject({ ok: false, error: expect.stringContaining('no longer available') })
  })
  it('does not resolve the hand-built prospects or slugs that do not round-trip', async () => {
    expect(await requestOrgClaim({ ...input, slug: 'live-in-lou' })).toMatchObject({ ok: false })
    expect(await requestOrgClaim({ ...input, slug: 'Bad--Slug' })).toMatchObject({ ok: false })
    expect(db.orgClaim.create).not.toHaveBeenCalled()
  })
})

describe('confirmOrgClaim', () => {
  const token = newClaimToken().token
  const row = (over = {}) => ({
    id: 'c1', crmOrganizationId: 'o1', name: 'Pat Lee', title: 'Director', email: 'pat@college.edu', emailDomain: 'college.edu', needsReview: false,
    expiresAt: new Date(Date.now() + 86_400_000), verifiedAt: null as Date | null,
    crmOrganization: { name: 'Example College', canonicalNameNormalized: 'example college', orgTypes: ['UNIVERSITY'] }, ...over,
  })
  beforeEach(() => {
    vi.clearAllMocks()
    db.orgClaim.updateMany.mockResolvedValue({ count: 1 })
    db.crmPerson.update.mockResolvedValue({})
  })

  it('verifies once: looks up by hash, records the claimant, notifies the team', async () => {
    db.orgClaim.findUnique.mockResolvedValue(row())
    expect(await confirmOrgClaim(token)).toEqual({ status: 'verified', orgName: 'Example College', slug: 'example-college' })
    expect(db.orgClaim.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashClaimToken(token) })
    expect(db.orgClaim.updateMany.mock.calls[0][0].where).toMatchObject({ id: 'c1', verifiedAt: null })
    expect(crm.addContactToCrm).toHaveBeenCalledOnce()
    expect(crm.addContactToCrm.mock.calls[0][0]).toMatchObject({ email: 'pat@college.edu', orgId: 'o1', priority: 'P0', roles: ['BD_PARTNER'] })
    expect(mail.admin).toHaveBeenCalledOnce()
    expect(capture).toHaveBeenCalledWith('org-claim:o1', 'org_claim_verified', expect.objectContaining({ orgId: 'o1', claimId: 'c1' }))
  })
  it('a second use of the link does nothing', async () => {
    db.orgClaim.findUnique.mockResolvedValue(row({ verifiedAt: new Date() }))
    expect(await confirmOrgClaim(token)).toMatchObject({ status: 'already' })
    expect(db.orgClaim.updateMany).not.toHaveBeenCalled()
    expect(crm.addContactToCrm).not.toHaveBeenCalled()
  })
  it('loses a race cleanly: the conditional update matched nothing, so the hook does not run', async () => {
    db.orgClaim.findUnique.mockResolvedValue(row())
    db.orgClaim.updateMany.mockResolvedValue({ count: 0 })
    expect(await confirmOrgClaim(token)).toMatchObject({ status: 'already' })
    expect(crm.addContactToCrm).not.toHaveBeenCalled()
  })
  it('refuses an expired link, an unknown link and a malformed one', async () => {
    db.orgClaim.findUnique.mockResolvedValue(row({ expiresAt: new Date(Date.now() - 1000) }))
    expect(await confirmOrgClaim(token)).toEqual({ status: 'expired' })
    db.orgClaim.findUnique.mockResolvedValue(null)
    expect(await confirmOrgClaim(token)).toEqual({ status: 'invalid' })
    expect(await confirmOrgClaim('short')).toEqual({ status: 'invalid' })
    expect(crm.addContactToCrm).not.toHaveBeenCalled()
  })
  it('stays verified even if the hook throws', async () => {
    db.orgClaim.findUnique.mockResolvedValue(row())
    crm.addContactToCrm.mockRejectedValueOnce(new Error('crm down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await confirmOrgClaim(token)).toMatchObject({ status: 'verified' })
  })
})

describe('onClaimVerified hook', () => {
  const claim = { id: 'c1', crmOrganizationId: 'o1', orgName: 'Example College', orgTypes: ['EMPLOYER'], slug: 'example-college', name: 'Pat Lee', title: 'Director', email: 'pat@college.edu', emailDomain: 'college.edu', needsReview: true, verifiedAt: new Date() }
  beforeEach(() => { vi.clearAllMocks(); db.crmPerson.update.mockResolvedValue({}) })

  it('only records and notifies: CRM contact, follow-up, admin email, and flags review', async () => {
    await onClaimVerified(claim)
    expect(crm.addContactToCrm.mock.calls[0][0]).toMatchObject({ roles: ['HIRING_MANAGER', 'OUTPLACEMENT_BUYER'], orgId: 'o1' })
    expect(crm.addContactToCrm.mock.calls[0][0].note).toContain('needs a person')
    expect(db.crmPerson.update).toHaveBeenCalledOnce()
    expect(mail.admin).toHaveBeenCalledWith(expect.objectContaining({ needsReview: true, pageUrl: 'https://launchyournextchapter.com/prepared/example-college' }))
    expect(Object.keys(db)).not.toContain('institution')
  })
})
