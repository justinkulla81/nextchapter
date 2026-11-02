import { describe, expect, it } from 'vitest'
import { emailCampaign, withEmailUtm } from '@/lib/email/utm'

describe('withEmailUtm', () => {
  it('tags a link to our site and keeps its path and query', () => {
    const out = new URL(withEmailUtm('https://launchyournextchapter.com/dashboard?tab=jobs', 'FINISH_LINE'))
    expect(out.pathname).toBe('/dashboard')
    expect(out.searchParams.get('tab')).toBe('jobs')
    expect(out.searchParams.get('utm_source')).toBe('email')
    expect(out.searchParams.get('utm_medium')).toBe('email')
    expect(out.searchParams.get('utm_campaign')).toBe('finish_line')
  })

  it('leaves a link that already has a utm_source alone', () => {
    const href = 'https://launchyournextchapter.com/onboarding/desire?utm_source=lead_email&utm_campaign=x'
    expect(withEmailUtm(href, 'anything')).toBe(href)
  })

  it('leaves other sites alone', () => {
    const href = 'https://example.com/article'
    expect(withEmailUtm(href, 'digest')).toBe(href)
  })

  it('leaves sign-in, confirmation and unsubscribe links exactly as built', () => {
    for (const href of [
      'https://launchyournextchapter.com/auth/callback?code=abc',
      'https://launchyournextchapter.com/join?token=abc',
      'https://launchyournextchapter.com/unsubscribe/xyz',
      'https://launchyournextchapter.com/api/e/go?c=1&k=A&u=eA&t=sig',
    ]) {
      expect(withEmailUtm(href, 'x')).toBe(href)
    }
  })

  it('returns text that is not a URL unchanged', () => {
    expect(withEmailUtm('not a url', 'x')).toBe('not a url')
    expect(withEmailUtm('mailto:a@b.com', 'x')).toBe('mailto:a@b.com')
  })

  it('tags a host passed in as ours (for a preview or staging origin)', () => {
    expect(withEmailUtm('https://staging.launchyournextchapter.com/dashboard', 'x', ['staging.launchyournextchapter.com'])).toContain('utm_medium=email')
  })
})

describe('emailCampaign', () => {
  it('lowercases and joins words with underscores', () => {
    expect(emailCampaign('Job Search Daily')).toBe('job_search_daily')
    expect(emailCampaign('MIDWEEK_CHECKIN')).toBe('midweek_checkin')
  })
  it('falls back when nothing usable is left', () => {
    expect(emailCampaign('---')).toBe('unlabeled')
  })
})
