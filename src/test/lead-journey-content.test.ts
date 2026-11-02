import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { leadEmailContent, leadEmailText } from '@/lib/leads/lifecycle/content'

const choices = [
  { label: 'Laid off', url: 'https://x.test/api/lead-journey/t?p=laid-off&step=welcome' },
  { label: 'Thinking about a move', url: 'https://x.test/api/lead-journey/t?p=thinking-about-a-move&step=welcome' },
]

describe('lifecycle email journey question', () => {
  it('asks which situation fits in the welcome until the journey is known, with the profile button demoted to a link', () => {
    const c = leadEmailContent('saved_job', 'welcome', { firstName: 'Sam', detail: 'PM at Acme', choices })
    expect(c.choices).toEqual(choices)
    expect(c.choicesPrompt).toMatch(/Which sounds most like you/)
    expect(c.benefits).toEqual([])
    expect(c.ctaLabel).toMatch(/skip ahead/i)
    expect(leadEmailText(c, 'https://x.test/p')).toContain('- Laid off: https://x.test/api/lead-journey/t?p=laid-off&step=welcome')
  })

  it('swaps the first reminder for the first-week plan once they picked a journey', () => {
    const c = leadEmailContent('newsletter', 'nudge1', { firstName: null, detail: null, journey: 'laid-off', choices: [] })
    expect(c.headline).toBe('Your first-week plan')
    expect(c.benefits.length).toBe(3)
    expect(c.choices).toBeUndefined()
    expect(c.ctaLabel).toMatch(/Save this plan/)
  })

  it('keeps the last reminder, the application follow-up and business acknowledgements as they were', () => {
    expect(leadEmailContent('saved_job', 'nudge2', { firstName: null, detail: null, choices }).choices).toBeUndefined()
    expect(leadEmailContent('applied_job', 'nudge1', { firstName: null, detail: 'PM at Acme', choices }).headline).toBe('Time to follow up?')
    expect(leadEmailContent('waitlist_b2b', 'welcome', { firstName: null, detail: 'Employer', choices }).choices).toBeUndefined()
  })

  it('shows the generic welcome when no buttons were built', () => {
    const c = leadEmailContent('job_alert', 'welcome', { firstName: null, detail: null })
    expect(c.choices).toBeUndefined()
    expect(c.ctaLabel).toBe('Create my free profile')
  })
})
