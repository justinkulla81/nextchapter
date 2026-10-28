import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/jobs/public-job-page-server', () => ({ getPublicJob: async () => null }))
vi.mock('./send', () => ({}))

import { nextLifecycleStep } from '@/lib/leads/lifecycle/run'
import { LEAD_VARIANTS, NUDGE_DAYS, stepsFor, waitlistVariant } from '@/lib/leads/lifecycle/config'
import { leadEmailContent } from '@/lib/leads/lifecycle/content'

const DAY = 24 * 60 * 60 * 1000
const T0 = new Date('2026-10-27T12:00:00Z')
const at = (days: number) => new Date(T0.getTime() + days * DAY)

describe('nextLifecycleStep', () => {
  const base = { variant: 'saved_job' as const, capturedAt: T0, welcomeAt: null, nudge1At: null, nudge2At: null }

  it('welcomes someone who just signed up, but never the back catalogue', () => {
    expect(nextLifecycleStep({ ...base, now: at(0.1) })).toBe('welcome')
    expect(nextLifecycleStep({ ...base, now: at(5) })).toBeNull()
  })

  it('sends the reminders on the variant schedule, one at a time', () => {
    const welcomed = { ...base, welcomeAt: T0 }
    expect(nextLifecycleStep({ ...welcomed, now: at(2) })).toBeNull()
    expect(nextLifecycleStep({ ...welcomed, now: at(3) })).toBe('nudge1')
    const one = { ...welcomed, nudge1At: at(3) }
    expect(nextLifecycleStep({ ...one, now: at(9) })).toBeNull()
    expect(nextLifecycleStep({ ...one, now: at(10) })).toBe('nudge2')
    expect(nextLifecycleStep({ ...one, nudge2At: at(10), now: at(30) })).toBeNull()
  })

  it('keeps a gap between reminders even when the cron was late', () => {
    const late = { ...base, welcomeAt: T0, nudge1At: at(9) }
    expect(nextLifecycleStep({ ...late, now: at(10) })).toBeNull()
    expect(nextLifecycleStep({ ...late, now: at(12) })).toBe('nudge2')
  })

  it('stops after the welcome for a business acknowledgement and after one reminder for the newsletter', () => {
    expect(nextLifecycleStep({ ...base, variant: 'waitlist_b2b', welcomeAt: T0, now: at(40) })).toBeNull()
    const news = { ...base, variant: 'newsletter' as const, welcomeAt: T0 }
    expect(nextLifecycleStep({ ...news, now: at(7) })).toBe('nudge1')
    expect(nextLifecycleStep({ ...news, nudge1At: at(7), now: at(40) })).toBeNull()
  })
})

describe('applied job', () => {
  it('welcomes, then sends one follow-up reminder at day 3 and stops', () => {
    const base = { variant: 'applied_job' as const, capturedAt: T0, welcomeAt: T0, nudge1At: null, nudge2At: null }
    expect(nextLifecycleStep({ ...base, now: at(2) })).toBeNull()
    expect(nextLifecycleStep({ ...base, now: at(3) })).toBe('nudge1')
    expect(nextLifecycleStep({ ...base, nudge1At: at(3), now: at(40) })).toBeNull()
  })

  it('says follow up, names the job, and the welcome promises only the one reminder', () => {
    const ctx = { firstName: null, detail: 'Analyst at Example Co' }
    const welcome = leadEmailContent('applied_job', 'welcome', ctx)
    expect(welcome.paragraphs.join(' ')).toContain('Analyst at Example Co')
    expect(welcome.footerNote).toContain('one follow-up reminder')
    const nudge = leadEmailContent('applied_job', 'nudge1', ctx)
    expect(nudge.headline).toBe('Time to follow up?')
    expect(nudge.paragraphs.join(' ')).toContain('Analyst at Example Co')
  })
})

describe('waitlistVariant', () => {
  it('skips members mid-signup and someone else\'s address, acknowledges business audiences', () => {
    expect(waitlistVariant('onboarding_no_gmail')).toBeNull()
    expect(waitlistVariant('friend_referral')).toBeNull()
    expect(waitlistVariant('Employer')).toBe('waitlist_b2b')
    expect(waitlistVariant('general')).toBe('waitlist')
  })
})

describe('lead email copy', () => {
  it('has copy for every variant and step, and the footer matches how many reminders really follow', () => {
    for (const variant of LEAD_VARIANTS) {
      for (const step of stepsFor(variant)) {
        const c = leadEmailContent(variant, step, { firstName: 'Ann', detail: 'Example' })
        expect(c.subject.length).toBeGreaterThan(5)
        expect(c.paragraphs.length).toBeGreaterThan(0)
        expect(c.footerNote.length).toBeGreaterThan(5)
        if (variant !== 'waitlist_b2b') expect(c.ctaLabel).toBeTruthy()
      }
    }
    const welcome = leadEmailContent('saved_job', 'welcome', { firstName: null, detail: null })
    expect(NUDGE_DAYS.saved_job).toHaveLength(2)
    expect(welcome.footerNote).toContain('two short reminders')
    expect(leadEmailContent('newsletter', 'welcome', { firstName: null, detail: null }).footerNote).toContain('one short reminder')
  })

  it('never pitches a profile to a business waitlist signup', () => {
    const c = leadEmailContent('waitlist_b2b', 'welcome', { firstName: null, detail: 'Employer' })
    expect(c.ctaLabel).toBeNull()
    expect(c.benefits).toHaveLength(0)
    expect(c.paragraphs.join(' ')).toContain('as an employer')
  })
})

import { isRealOpen } from '@/lib/leads/lead-status'

describe('isRealOpen', () => {
  const sent = new Date('2026-10-27T12:00:00Z')
  it('ignores the pixel load a mail provider does on arrival, counts a later open', () => {
    expect(isRealOpen(sent, new Date(sent.getTime() + 2_000), 1)).toBe(false)
    expect(isRealOpen(sent, new Date(sent.getTime() + 5 * 60_000), 1)).toBe(true)
    expect(isRealOpen(sent, new Date(sent.getTime() + 2_000), 3)).toBe(true)
    expect(isRealOpen(sent, null, 0)).toBe(false)
  })
})
