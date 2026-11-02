import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.MAILING_UNSUBSCRIBE_SECRET = 'test-secret'
})

import { LEAD_COOKIE, emailFromLeadCookie, profileDestination } from '@/lib/leads/lifecycle/prefill'
import { makeUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { GET } from '@/app/api/lead-profile/[token]/route'
import { NextRequest } from 'next/server'

const call = (token: string, query = '') => GET(new NextRequest(`https://launchyournextchapter.com/api/lead-profile/${token}${query}`), { params: Promise.resolve({ token }) })

describe('profileDestination', () => {
  it('goes to the journey page when the journey is real, else the situation question', () => {
    const params = new URLSearchParams('from=lead_email&utm_source=lead_email&utm_campaign=saved_job_nudge1')
    expect(profileDestination('laid-off', params)).toBe('/start/laid-off?from=lead_email&utm_source=lead_email&utm_campaign=saved_job_nudge1')
    expect(profileDestination('not-a-journey', params).startsWith('/onboarding/desire?')).toBe(true)
    expect(profileDestination(null, new URLSearchParams())).toBe('/onboarding/desire')
  })
  it('never passes through anything but the three tracking parameters', () => {
    expect(profileDestination(null, new URLSearchParams('next=https://evil.example&from=x'))).toBe('/onboarding/desire?from=x')
  })
})

describe('emailFromLeadCookie', () => {
  it('reads a token we signed and rejects anything else', () => {
    expect(emailFromLeadCookie(makeUnsubscribeToken('A@Example.org', null))).toBe('a@example.org')
    expect(emailFromLeadCookie('a@example.org')).toBeNull()
    expect(emailFromLeadCookie(`${makeUnsubscribeToken('a@example.org', null).slice(0, -2)}xx`)).toBeNull()
    expect(emailFromLeadCookie(undefined)).toBeNull()
  })
})

describe('GET /api/lead-profile/<token>', () => {
  it('sets the cookie for a signed token and redirects to the journey page', async () => {
    const token = makeUnsubscribeToken('a@example.org', null)
    const res = await call(token, '?j=laid-off&from=lead_email')
    expect(res.headers.get('location')).toContain('/start/laid-off?from=lead_email')
    expect(res.cookies.get(LEAD_COOKIE)?.value).toBe(token)
  })
  it('redirects without a cookie for a bad token', async () => {
    const res = await call('garbage')
    expect(res.headers.get('location')).toContain('/onboarding/desire')
    expect(res.cookies.get(LEAD_COOKIE)).toBeUndefined()
  })
})
