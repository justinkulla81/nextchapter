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
    expect(c.paragraphs).toHaveLength(2)
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

  it('makes the last reminder a different ask: where they stand, in their situation or about the job they saved', () => {
    const j = leadEmailContent('job_alert', 'nudge2', { firstName: null, detail: null, journey: 'laid-off' })
    expect(j.headline).toBe('Before an employer does')
    expect(j.paragraphs.join(' ')).toMatch(/Market Reality Assessment/)
    const job = leadEmailContent('saved_job', 'nudge2', { firstName: null, detail: 'PM at Acme' })
    expect(job.subject).toBe('How well do you fit PM at Acme?')
    expect(leadEmailContent('newsletter', 'nudge2', { firstName: null, detail: null }).headline).toBe('Where do you stand?')
  })

  it('keeps the application follow-up, the application follow-up and business acknowledgements as they were', () => {
    expect(leadEmailContent('saved_job', 'nudge2', { firstName: null, detail: null, choices }).choices).toBeUndefined()
    expect(leadEmailContent('applied_job', 'nudge1', { firstName: null, detail: 'PM at Acme', choices }).headline).toBe('Time to follow up?')
    expect(leadEmailContent('waitlist_b2b', 'welcome', { firstName: null, detail: 'Employer', choices }).choices).toBeUndefined()
  })

  it('shows the generic welcome when no buttons were built', () => {
    const c = leadEmailContent('job_alert', 'welcome', { firstName: null, detail: null })
    expect(c.choices).toBeUndefined()
    expect(c.ctaLabel).toBe('Create my free profile')
  })

  it('leads the application welcome with three jobs like it and one profile button, no situation question', () => {
    const jobs = [1, 2, 3].map((i) => ({ title: `Job ${i}`, company: `Co ${i}`, place: 'Kansas City, MO', url: `https://x.test/api/lead-job/t?job=j${i}` }))
    const c = leadEmailContent('applied_job', 'welcome', { firstName: null, detail: 'PM at Acme', choices: [], jobs })
    expect(c.headline).toBe('Three more jobs like this one')
    expect(c.jobs).toHaveLength(3)
    expect(c.choices).toBeUndefined()
    expect(c.ctaLabel).toBe('Create my free profile')
    expect(leadEmailText(c, 'https://x.test/p')).toContain('- Job 1, Co 1, Kansas City, MO: https://x.test/api/lead-job/t?job=j1')
  })

  it('falls back to the situation question when fewer than three similar jobs were found', () => {
    const jobs = [{ title: 'Job 1', company: 'Co', place: null, url: 'https://x.test/j1' }]
    const c = leadEmailContent('applied_job', 'welcome', { firstName: null, detail: 'PM at Acme', choices, jobs })
    expect(c.jobs).toBeUndefined()
    expect(c.choices).toEqual(choices)
  })

  it('leads the saved-job welcome with three jobs like it too', () => {
    const jobs = [1, 2, 3].map((i) => ({ title: `Job ${i}`, company: `Co ${i}`, place: null, url: `https://x.test/j${i}` }))
    const c = leadEmailContent('saved_job', 'welcome', { firstName: null, detail: 'PM at Acme', choices: [], jobs })
    expect(c.headline).toBe('Three more jobs like this one')
    expect(c.paragraphs[1]).toBe('You saved PM at Acme. These are open now and look like it:')
    expect(c.choices).toBeUndefined()
  })

  it('leads the job-alert welcome with three jobs the search finds now', () => {
    const jobs = [1, 2, 3].map((i) => ({ title: `Job ${i}`, company: `Co ${i}`, place: 'Denver, CO', url: `https://x.test/j${i}` }))
    const c = leadEmailContent('job_alert', 'welcome', { firstName: null, detail: 'product manager in Denver', choices: [], jobs })
    expect(c.headline).toBe('Three jobs open now')
    expect(c.paragraphs[1]).toBe('Your alert for product manager in Denver is on. These match it today:')
    expect(c.choices).toBeUndefined()
    expect(c.ctaLabel).toBe('Create my free profile')
  })

  it('leads the newsletter welcome with the latest report and one profile button, no situation question', () => {
    const report = { month: 'October 2026', title: 'Hiring improved', dek: 'October added 165,000 jobs.', url: 'https://x.test/r' }
    const c = leadEmailContent('newsletter', 'welcome', { firstName: null, detail: null, choices: [], report })
    expect(c.feature).toMatchObject({ kicker: 'From our October 2026 report', title: 'Hiring improved', url: 'https://x.test/r' })
    expect(c.choices).toBeUndefined()
    expect(c.ctaLabel).toBe('Create my free profile')
    expect(leadEmailText(c, 'https://x.test/p')).toContain('Read the October 2026 White Collar Employment Report: https://x.test/r')
  })

  describe('reminders lead with jobs too', () => {
    const jobs = [1, 2, 3].map((i) => ({ title: `Job ${i}`, company: `Co ${i}`, place: null, url: `https://x.test/j${i}` }))

    it('keeps the application follow-up advice and swaps its benefits list for three more jobs', () => {
      const c = leadEmailContent('applied_job', 'nudge1', { firstName: null, detail: 'PM at Acme', jobs })
      expect(c.headline).toBe('Time to follow up?')
      expect(c.paragraphs.at(-1)).toBe('While you wait, three more like it are open now:')
      expect(c.jobs).toHaveLength(3)
      expect(c.benefits).toEqual([])
    })

    it('shows saved-job and job-alert reminders three new jobs instead of the question or the generic pitch', () => {
      const saved = leadEmailContent('saved_job', 'nudge1', { firstName: null, detail: 'PM at Acme', choices, jobs })
      expect(saved.headline).toBe('Three more like the one you saved')
      expect(saved.choices).toBeUndefined()
      const alert = leadEmailContent('job_alert', 'nudge2', { firstName: null, detail: 'product manager in Denver', jobs })
      expect(alert.subject).toBe('Three new jobs: product manager in Denver')
      expect(alert.afterJobs).toMatch(/This is our last note\.$/)
      expect(alert.footerNote).toBe('This is the last reminder.')
    })

    it('keeps the first-week plan and the last note for someone who picked a situation', () => {
      expect(leadEmailContent('saved_job', 'nudge1', { firstName: null, detail: null, journey: 'laid-off', jobs }).headline).toBe('Your first-week plan')
      expect(leadEmailContent('job_alert', 'nudge2', { firstName: null, detail: null, journey: 'laid-off', jobs }).headline).toBe('Before an employer does')
    })

    it('falls back to the old reminder without three jobs', () => {
      expect(leadEmailContent('saved_job', 'nudge2', { firstName: null, detail: 'PM at Acme' }).headline).toBe('How well do you fit?')
    })
  })

  it("leads the newsletter reminder with the week's layoffs, and falls back without them", () => {
    const layoffs = { notices: 42, workers: 5310, states: 14, top: [{ name: 'Acme', workers: 1200, state: 'Texas' }, { name: 'Beta', workers: 400, state: null }], url: 'https://x.test/w' }
    const c = leadEmailContent('newsletter', 'nudge1', { firstName: null, detail: null, layoffs })
    expect(c.subject).toBe('Layoffs this week: 5,310 workers')
    expect(c.feature).toMatchObject({ title: '42 notices, 5,310 workers, 14 states', body: 'The largest: Acme (1,200, Texas); Beta (400).', url: 'https://x.test/w' })
    expect(c.ctaLabel).toBe('Create my free profile')
    expect(leadEmailContent('newsletter', 'nudge1', { firstName: null, detail: null }).headline).toBe('Still looking?')
    expect(leadEmailContent('newsletter', 'nudge1', { firstName: null, detail: null, journey: 'laid-off', layoffs }).headline).toBe('Your first-week plan')
  })
})
