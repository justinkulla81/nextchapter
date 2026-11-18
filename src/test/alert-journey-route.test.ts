import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const update = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { homepageLead: { findUnique: (...a: unknown[]) => findUnique(...a), update: (...a: unknown[]) => update(...a) } } }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

beforeAll(() => {
  process.env.MAILING_UNSUBSCRIBE_SECRET = 'test-secret'
  process.env.NEXT_PUBLIC_APP_URL = 'https://launchyournextchapter.com'
})

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/job-alerts/journey/[token]/route'
import { LEAD_COOKIE } from '@/lib/leads/lifecycle/prefill'

const go = (q: string) => GET(new NextRequest(`https://launchyournextchapter.com/api/job-alerts/journey/tok${q}`), { params: Promise.resolve({ token: 'tok' }) })

describe('GET /api/job-alerts/journey/<token>', () => {
  beforeEach(() => {
    update.mockReset()
    findUnique.mockReset().mockResolvedValue({ id: 'l1', email: 'a@example.org', kind: 'job_alert', journeySlug: null })
  })

  it('a tap on a page is their answer: saved, and onboarding opens with it filled in and sent on', async () => {
    const to = new URL((await go('?p=laid-off')).headers.get('location')!)
    expect(to.pathname).toBe('/onboarding/desire')
    expect(to.searchParams.get('situation')).toBe('just_laid_off')
    expect(to.searchParams.get('from')).toBe('alert_pick')
    expect(update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { journeySlug: 'laid-off' } })
  })

  it("an email button is our guess: filled in to confirm, never saved over their own answer", async () => {
    findUnique.mockResolvedValue({ id: 'l1', email: 'a@example.org', kind: 'job_alert', journeySlug: 'career-change' })
    const res = await go('?p=laid-off&via=email')
    expect(new URL(res.headers.get('location')!).searchParams.get('from')).toBe('job_alert')
    expect(update).not.toHaveBeenCalled()
    expect(res.cookies.get(LEAD_COOKIE)?.value).toBeTruthy()
  })

  it('an email button that matches the answer they gave counts as theirs', async () => {
    findUnique.mockResolvedValue({ id: 'l1', email: 'a@example.org', kind: 'job_alert', journeySlug: 'laid-off' })
    expect(new URL((await go('?p=laid-off&via=email')).headers.get('location')!).searchParams.get('from')).toBe('alert_pick')
  })
})
