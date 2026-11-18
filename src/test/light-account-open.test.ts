import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const redirect = vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`) })
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }))
const update = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { candidateProfile: { update: (...a: unknown[]) => update(...a) } } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
const signIn = vi.fn()
vi.mock('@/lib/auth/verified-email-session', () => ({ signInVerifiedEmail: (...a: unknown[]) => signIn(...a) }))
const profileFor = vi.fn()
vi.mock('@/lib/profile', () => ({ getOrCreateCandidateProfile: (...a: unknown[]) => profileFor(...a) }))
const existing = vi.fn()
vi.mock('@/lib/onboarding/duplicate-check', () => ({ findExistingRegisteredAccount: (...a: unknown[]) => existing(...a) }))
const claim = vi.fn()
vi.mock('@/lib/leads/claim-saved-jobs', () => ({ claimSavedJobs: (...a: unknown[]) => claim(...a) }))
const crm = vi.fn()
vi.mock('@/lib/crm/candidate-sync', () => ({ syncCandidateToCrm: (...a: unknown[]) => crm(...a) }))
const capture = vi.fn()
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: (...a: unknown[]) => capture(...a) }))
const readToken = vi.fn()
vi.mock('@/lib/leads/light-account', () => ({ readAccountToken: (...a: unknown[]) => readToken(...a) }))

import { openLightAccount } from '@/app/onboarding/account-ready/actions'

const form = (fields: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}
const good = { t: 'tok', firstName: ' Dana ', lastName: 'Lee' }

describe('openLightAccount', () => {
  beforeEach(() => {
    for (const m of [redirect, update, signIn, profileFor, existing, claim, crm, capture, readToken]) m.mockReset()
    redirect.mockImplementation((to: string) => { throw new Error(`REDIRECT:${to}`) })
    readToken.mockReturnValue('dana@example.org')
    existing.mockResolvedValue(null)
    signIn.mockResolvedValue({ ok: true, userId: 'u1', isNew: true })
    profileFor.mockResolvedValue({ id: 'c1', registrationCompletedAt: null, lightAccountAt: null })
    claim.mockResolvedValue(2)
    crm.mockResolvedValue(null)
  })

  it('refuses an expired or foreign link before touching any account', async () => {
    readToken.mockReturnValue(null)
    expect((await openLightAccount(undefined, form(good)))?.error).toMatch(/expired/)
    expect(signIn).not.toHaveBeenCalled()
  })

  it('asks for both names', async () => {
    expect((await openLightAccount(undefined, form({ ...good, lastName: ' ' })))?.error).toMatch(/first and last name/)
    expect(signIn).not.toHaveBeenCalled()
  })

  it('sends a full member to sign in instead of opening a second account', async () => {
    existing.mockResolvedValue({ id: 'c9', passwordSetAt: new Date() })
    expect((await openLightAccount(undefined, form(good)))?.error).toMatch(/Sign in instead/)
    expect(signIn).not.toHaveBeenCalled()
  })

  it('never enters an account that is still waiting for its own confirmation', async () => {
    signIn.mockResolvedValue({ ok: false, reason: 'unconfirmed_account' })
    expect((await openLightAccount(undefined, form(good)))?.error).toMatch(/waiting to be confirmed/)
    expect(update).not.toHaveBeenCalled()
  })

  it('opens the account: name and email stored, saved jobs moved in, CRM linked, then their jobs page', async () => {
    await expect(openLightAccount(undefined, form(good))).rejects.toThrow('REDIRECT:/onboarding/your-jobs')
    expect(update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: expect.objectContaining({ firstName: 'Dana', lastName: 'Lee', email: 'dana@example.org', lightAccountAt: expect.any(Date) }) })
    expect(claim).toHaveBeenCalledWith('c1', 'dana@example.org')
    expect(crm).toHaveBeenCalledWith('c1')
    expect(capture).toHaveBeenCalledWith('dana@example.org', 'light_account_opened', expect.objectContaining({ candidateId: 'c1', savedJobs: 2 }))
  })
})
