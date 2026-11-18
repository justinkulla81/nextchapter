import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.MAILING_UNSUBSCRIBE_SECRET = 'test-secret'
  process.env.NEXT_PUBLIC_APP_URL = 'https://launchyournextchapter.com'
})

import { LEAD_COOKIE, emailFromLeadCookie, profileDestination } from '@/lib/leads/lifecycle/prefill'
import { makeUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { GET } from '@/app/api/lead-profile/[token]/route'
import { NextRequest } from 'next/server'

const call = (token: string, query = '') => GET(new NextRequest(`https://launchyournextchapter.com/api/lead-profile/${token}${query}`), { params: Promise.resolve({ token }) })

describe('profileDestination', () => {
  it('goes to the first question with the picked situation filled in, else the question as it is', () => {
    const params = new URLSearchParams('from=lead_email&utm_source=lead_email&utm_campaign=saved_job_nudge1')
    expect(profileDestination('laid-off', params)).toBe('/onboarding/desire?goal=market-reality&situation=just_laid_off&from=lead_email&utm_source=lead_email&utm_campaign=saved_job_nudge1')
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
    expect(res.headers.get('location')).toContain('/onboarding/desire?goal=market-reality&situation=just_laid_off&from=lead_email')
    expect(res.cookies.get(LEAD_COOKIE)?.value).toBe(token)
    // On the whole site, so the details step on the candidate host can read it.
    expect(res.headers.get('set-cookie')).toMatch(/Domain=launchyournextchapter\.com/i)
  })
  it('redirects without a cookie for a bad token', async () => {
    const res = await call('garbage')
    expect(res.headers.get('location')).toContain('/onboarding/desire')
    expect(res.cookies.get(LEAD_COOKIE)).toBeUndefined()
  })
})

describe('GET /api/lead-job/<token>', () => {
  const job = (token: string, query: string) =>
    import('@/app/api/lead-job/[token]/route').then(({ GET: jobGet }) =>
      jobGet(new NextRequest(`https://launchyournextchapter.com/api/lead-job/${token}${query}`, { headers: { 'user-agent': 'Mozilla/5.0' } }), { params: Promise.resolve({ token }) }),
    )
  it('opens the job page with the email attribution and remembers the address', async () => {
    const token = makeUnsubscribeToken('a@example.org', null)
    const res = await job(token, '?job=cmvpdmxyt006zkz081f6gvn3s&step=welcome&pos=2')
    const location = new URL(res.headers.get('location')!)
    expect(location.pathname).toBe('/jobs/cmvpdmxyt006zkz081f6gvn3s')
    expect(location.searchParams.get('utm_content')).toBe('similar_job')
    expect(res.cookies.get(LEAD_COOKIE)?.value).toBe(token)
  })
  it('tags a saved-job email click as such', async () => {
    const res = await job(makeUnsubscribeToken('a@example.org', null), '?job=cmvpdmxyt006zkz081f6gvn3s&step=welcome&v=saved_job&pos=1')
    expect(new URL(res.headers.get('location')!).searchParams.get('utm_campaign')).toBe('saved_job_welcome')
    const alert = await job(makeUnsubscribeToken('a@example.org', null), '?job=cmvpdmxyt006zkz081f6gvn3s&step=welcome&v=job_alert&pos=1')
    expect(new URL(alert.headers.get('location')!).searchParams.get('utm_campaign')).toBe('job_alert_welcome')
  })
  it('never redirects anywhere but a job page', async () => {
    const res = await job('garbage', '?job=https://evil.example')
    expect(new URL(res.headers.get('location')!).pathname).toBe('/jobs')
    expect(res.cookies.get(LEAD_COOKIE)).toBeUndefined()
  })
})

describe('GET /api/lead-report/<token>', () => {
  it('opens the edition with the email attribution, and the latest for an unknown slug', async () => {
    const { GET: reportGet } = await import('@/app/api/lead-report/[token]/route')
    const { latestReport } = await import('@/lib/reports')
    const token = makeUnsubscribeToken('a@example.org', null)
    const go = (q: string) => reportGet(new NextRequest(`https://launchyournextchapter.com/api/lead-report/${token}${q}`, { headers: { 'user-agent': 'Mozilla/5.0' } }), { params: Promise.resolve({ token }) })
    const res = await go('?r=white-collar-employment-report-september-2026&step=welcome')
    const to = new URL(res.headers.get('location')!)
    expect(to.pathname).toBe('/reports/white-collar-employment-report-september-2026')
    expect(to.searchParams.get('utm_content')).toBe('report')
    expect(res.cookies.get(LEAD_COOKIE)?.value).toBe(token)
    expect(new URL((await go('?r=https://evil.example')).headers.get('location')!).pathname).toBe(`/reports/${latestReport()!.slug}`)
    const week = new URL((await go('?r=layoffs-this-week&step=nudge1')).headers.get('location')!)
    expect(week.pathname).toBe('/layoffs/this-week')
    expect(week.searchParams.get('utm_campaign')).toBe('newsletter_nudge1')
  })
})
