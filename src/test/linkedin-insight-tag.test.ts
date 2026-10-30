import { describe, expect, it } from 'vitest'
import { isLinkedInTagPath } from '@/components/analytics/LinkedInInsightTag'

describe('LinkedIn Insight Tag page allowlist', () => {
  it('tags public marketing and SEO pages', () => {
    for (const p of ['/', '/pricing', '/for-organizations', '/for-rapid-response', '/demo', '/demo/workforce', '/layoffs/by-state/ca', '/employers/acme', '/places/texas']) {
      expect(isLinkedInTagPath(p), p).toBe(true)
    }
  })

  it('never tags signed-in workspaces, forms or unlisted routes', () => {
    for (const p of [
      '/dashboard',
      '/dashboard/profile',
      '/onboarding',
      '/support/admin/crm',
      '/recruiters/search',
      '/talent/dashboard',
      '/auth/callback',
      '/api/health',
      '/for-managers/give-a-reference',
      '/submit-resume',
      '/claim',
      '/prepared/abc',
    ]) {
      expect(isLinkedInTagPath(p), p).toBe(false)
    }
  })

  it('does not match a path that only shares a prefix', () => {
    expect(isLinkedInTagPath('/pricingfoo')).toBe(false)
    expect(isLinkedInTagPath('/about-admin')).toBe(false)
  })
})
