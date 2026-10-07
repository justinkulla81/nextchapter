// Fractional work and learning tracking: which platform an email is from,
// and which stage it proves.
import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
import { PLATFORM_DIRECTORY, platformsForSenderDomain } from '@/lib/platforms/directory'
import { readPlatformEmail, extractCompletedTitle, looksAutomated } from '@/lib/platforms/stages'
import { milestonesForStage, parsePlatformBadgeKey, platformBadgeKey, platformBadgeLabel } from '@/lib/platforms/badges'
import { platformStatus } from '@/lib/platforms/candidate-view'

describe('platform directory', () => {
  it('has unique keys', () => {
    const keys = PLATFORM_DIRECTORY.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('covers the categories asked for', () => {
    const cats = new Set(PLATFORM_DIRECTORY.map((p) => p.category))
    for (const c of ['OUTPLACEMENT', 'GOVERNMENT', 'COURSE_PLATFORM', 'CODING', 'AI_LEARNING', 'AI_TRAINING', 'EXPERT_NETWORK'] as const) {
      expect(cats.has(c)).toBe(true)
    }
    expect(PLATFORM_DIRECTORY.some((p) => p.key === 'linkedin-learning')).toBe(true)
  })

  it('matches subdomains to their platform', () => {
    expect(platformsForSenderDomain('mail.micro1.ai')[0]?.key).toBe('micro1')
    expect(platformsForSenderDomain('m.learn.coursera.org')[0]?.key).toBe('coursera')
    expect(platformsForSenderDomain('example.com')).toEqual([])
  })

  it('prefers the more specific domain', () => {
    expect(platformsForSenderDomain('bootcamp.edx.org')[0]?.key).toBe('edx-bootcamps')
  })

  it('matches state workforce .gov senders only through a gated entry', () => {
    const hits = platformsForSenderDomain('dol.ny.gov')
    expect(hits.map((p) => p.key)).toContain('state-workforce')
    expect(hits.every((p) => p.gate)).toBe(true)
  })

  it('gates every shared domain', () => {
    for (const d of ['linkedin.com', 'google.com', 'microsoft.com', 'amazon.com', 'mit.edu', 'harvard.edu']) {
      expect(platformsForSenderDomain(d).every((p) => !!p.gate)).toBe(true)
    }
  })
})

describe('readPlatformEmail — work', () => {
  const read = (subject: string, body = '') => readPlatformEmail('WORK', subject, body)
  it('reads sign-up mail', () => {
    expect(read('Welcome to micro1!').stage).toBe('SIGNED_UP')
    expect(read('Please verify your email').stage).toBe('SIGNED_UP')
  })
  it('reads vetting', () => {
    expect(read('Your AI interview is ready').stage).toBe('IN_VETTING')
    expect(read('Complete your assessment to continue').stage).toBe('IN_VETTING')
  })
  it('reads acceptance', () => {
    expect(read('Congratulations, you’ve been approved!').stage).toBe('ACCEPTED')
    expect(read('Your profile has been approved').stage).toBe('ACCEPTED')
  })
  it('reads project work', () => {
    expect(read("You've been matched with a client").stage).toBe('WORKING')
    expect(read('Updated invitation: Tegus Compensated Consulting Call @ Fri Sep 26, 2025').stage).toBe('WORKING')
    expect(read('B2B Wholesale Marketplaces - Tegus Research Call').stage).toBe('WORKING')
  })
  // Real subjects from expert networks and marketplaces: an invitation or
  // opportunity is not work (networks also invite people cold).
  it('does not read invitations as work', () => {
    expect(read('Consultation request: Healthcare payments').stage).toBeNull()
    expect(read('AlphaSights | Consulting Opportunity ($450/hour)').stage).toBeNull()
    expect(read('Dialectica new survey project request: POS Software Market').stage).toBeNull()
    expect(read('Third Bridge: Survey Request on Financial Analytics Software [70 USD, 15 minutes]', 'Answer 3 screening questions').stage).toBeNull()
  })
  it('reads members-only digests and onboarding as accepted', () => {
    expect(read('New projects available!').stage).toBe('ACCEPTED')
    expect(read('All Set: Your Tegus Onboarding is Complete!').stage).toBe('ACCEPTED')
    expect(read('Thank you for accepting the terms of engagement of Dialectica').stage).toBe('ACCEPTED')
  })
  it('does not read a higher honorarium offer as a payout', () => {
    expect(read('HONORARIUM INCREASE: Guidepoint - Accounting & Financial Services Survey - $65').stage).toBeNull()
  })
  it('reads payouts', () => {
    expect(read('TEGUS INC submitted a payment to you').stage).toBe('EARNING')
    expect(read('Tipalti payment processed successfully').stage).toBe('EARNING')
    expect(read('Your payment has been sent').stage).toBe('EARNING')
    expect(read("You've been paid $450").stage).toBe('EARNING')
  })
  it('reads rejections as a signal, not a stage', () => {
    expect(read('Update on your application: unfortunately…', 'Thanks for applying')).toEqual({ stage: null, signal: 'NOT_ACCEPTED' })
  })
  it('reads nudges as gone quiet', () => {
    expect(read('We miss you, Priya')).toEqual({ stage: null, signal: 'NUDGE' })
  })
  it('ignores unrelated mail', () => {
    expect(read('Our Q3 product update').stage).toBeNull()
  })
})

describe('readPlatformEmail — learning', () => {
  const read = (subject: string, body = '') => readPlatformEmail('LEARNING', subject, body)
  it('reads enrollment', () => {
    expect(read("You're enrolled in Google Data Analytics").stage).toBe('ENROLLED')
    expect(read('Registration confirmed: AI for Everyone').stage).toBe('ENROLLED')
  })
  it('reads progress', () => {
    expect(read('Your assignment has been graded').stage).toBe('LEARNING')
    expect(read("You've completed Module 2").stage).toBe('LEARNING')
    expect(read('You are 40% complete').stage).toBe('LEARNING')
  })
  it('does not read a module as the whole course', () => {
    expect(read("Congrats! You've completed week 3").stage).toBe('LEARNING')
  })
  it('reads exam bookings', () => {
    expect(read('Pearson VUE exam appointment confirmation').stage).toBe('EXAM_BOOKED')
  })
  it('reads completion', () => {
    expect(read("Congratulations, you've completed Google Project Management!").stage).toBe('COMPLETED')
    expect(read("You've earned a badge: AWS Cloud Practitioner").stage).toBe('COMPLETED')
    expect(read('Your certificate is ready').stage).toBe('COMPLETED')
  })
  it('reads falling behind', () => {
    expect(read("You're falling behind in Financial Markets").signal).toBe('FALLING_BEHIND')
  })
  it('does not read university marketing as enrollment', () => {
    expect(read('Explore value, truth and knowledge with this NEW course from MITx').stage).toBeNull()
    expect(read('Renowned "Justice" course is back').stage).toBeNull()
  })
  it('does not read marketing as completion', () => {
    expect(read('Earn a certificate of completion in 6 weeks').stage).toBeNull()
  })
})

describe('extractCompletedTitle', () => {
  it('pulls the course name from common subjects', () => {
    expect(extractCompletedTitle("Congratulations on completing Google Data Analytics!")).toBe('Google Data Analytics')
    expect(extractCompletedTitle("You've earned a badge: AWS Certified Cloud Practitioner")).toBe('AWS Certified Cloud Practitioner')
  })
  it('returns null when unsure', () => {
    expect(extractCompletedTitle('Your certificate is ready')).toBeNull()
    expect(extractCompletedTitle("You've completed module 2")).toBeNull()
  })
})

describe('looksAutomated', () => {
  it('treats no-reply and list mail as automated', () => {
    expect(looksAutomated('Coursera <no-reply@t.mail.coursera.org>', false)).toBe(true)
    expect(looksAutomated('Jane Doe <jane@mit.edu>', true)).toBe(true)
  })
  it('treats a person as not automated', () => {
    expect(looksAutomated('Jane Doe <jane.doe@mit.edu>', false)).toBe(false)
  })
})

describe('platform badges', () => {
  it('round-trips keys', () => {
    expect(parsePlatformBadgeKey(platformBadgeKey('micro1', 'ACCEPTED'))).toEqual({ platformKey: 'micro1', milestone: 'ACCEPTED' })
    expect(parsePlatformBadgeKey('CLEANED_UP')).toBeNull()
  })
  it('implies earlier work milestones', () => {
    expect(milestonesForStage('WORK', 'EARNING')).toEqual(['FIRST_STEP', 'ACCEPTED', 'FIRST_PROJECT', 'FIRST_PAYOUT'])
    expect(milestonesForStage('WORK', 'IN_VETTING')).toEqual(['FIRST_STEP'])
    expect(milestonesForStage('LEARNING', 'LEARNING')).toEqual(['FIRST_STEP'])
    expect(milestonesForStage('LEARNING', 'COMPLETED')).toEqual(['FIRST_STEP', 'COMPLETED'])
  })
  it('labels by platform name', () => {
    expect(platformBadgeLabel(platformBadgeKey('micro1', 'FIRST_STEP'))).toBe('Signed up on micro1')
    expect(platformBadgeLabel(platformBadgeKey('coursera', 'COMPLETED'))).toBe('Completed on Coursera')
  })
})

describe('platformStatus', () => {
  const now = new Date('2026-10-07T12:00:00Z')
  const base = { firstSeenAt: new Date('2026-09-01T00:00:00Z'), health: 'ACTIVE' as const }
  it('flags an accepted platform with no progress for 30+ days as gone quiet', () => {
    const s = platformStatus({ ...base, kind: 'WORK', stage: 'ACCEPTED', lastProgressAt: new Date('2026-08-20T00:00:00Z') }, now)
    expect(s).toEqual({ label: 'Accepted', tone: 'warning', healthLabel: 'Gone quiet' })
  })
  it('does not flag a recent one', () => {
    const s = platformStatus({ ...base, kind: 'LEARNING', stage: 'LEARNING', lastProgressAt: new Date('2026-10-01T00:00:00Z') }, now)
    expect(s.healthLabel).toBeNull()
  })
  it('never flags a completed course', () => {
    const s = platformStatus({ ...base, kind: 'LEARNING', stage: 'COMPLETED', lastProgressAt: new Date('2026-01-01T00:00:00Z') }, now)
    expect(s).toEqual({ label: 'Completed', tone: 'done', healthLabel: null })
  })
})
