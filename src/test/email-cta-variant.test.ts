import { describe, expect, it } from 'vitest'
import { emailCtaLabel, emailCtaVariant } from '@/lib/ab/email-cta'
import { NAV_CTA_LABEL } from '@/lib/ab/nav-cta'
import { withEmailUtm } from '@/lib/email/utm'

describe('email CTA variant', () => {
  it('gives the same address the same arm regardless of case or spaces', () => {
    expect(emailCtaVariant(' Pat@Example.com ')).toBe(emailCtaVariant('pat@example.com'))
  })

  it('spreads addresses across all three arms', () => {
    const counts = { control: 0, hire_score: 0, resume_score: 0 }
    for (let i = 0; i < 3000; i++) counts[emailCtaVariant(`person${i}@example.com`)]++
    for (const n of Object.values(counts)) expect(n).toBeGreaterThan(800)
  })

  it('keeps the email own wording for control and swaps it for the other arms', () => {
    expect(emailCtaLabel(undefined, 'Get your free assessment')).toBe('Get your free assessment')
    expect(emailCtaLabel('control', 'Get your free assessment')).toBe('Get your free assessment')
    expect(emailCtaLabel('hire_score', 'x')).toBe(NAV_CTA_LABEL.hire_score)
    expect(emailCtaLabel('resume_score', 'x')).toBe('Score My Resume')
  })

  it('tags links with a campaign so the arm can ride along', () => {
    expect(withEmailUtm('https://launchyournextchapter.com/onboarding/desire', 'journey_plan')).toContain('utm_campaign=journey_plan')
  })
})
