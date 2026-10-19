import { describe, expect, it } from 'vitest'
import type { CandidateEmailKey } from '@prisma/client'
import { shouldSendRotationEmail } from '@/lib/email/notification-tier'
import { isUrgentContent } from '@/lib/job-search-daily/urgent'

const KEYS: CandidateEmailKey[] = ['MORNING_MOTIVATION', 'MARKET_UPDATE', 'DAILY_NUDGE', 'MIDWEEK_CHECKIN', 'GAP_NUDGE', 'SEARCH_CHECKIN', 'FINISH_LINE']

describe('shouldSendRotationEmail', () => {
  it('sends every rotation email to FULL', () => {
    expect(KEYS.every((k) => shouldSendRotationEmail('FULL', k))).toBe(true)
  })
  it('sends ESSENTIALS only the Monday plan and Thursday check-in', () => {
    expect(KEYS.filter((k) => shouldSendRotationEmail('ESSENTIALS', k))).toEqual(['MORNING_MOTIVATION', 'MIDWEEK_CHECKIN'])
  })
  it('sends MINIMAL none', () => {
    expect(KEYS.some((k) => shouldSendRotationEmail('MINIMAL', k))).toBe(false)
  })
})

describe('isUrgentContent', () => {
  it.each(['Reply today:', 'Today:', 'Tomorrow:', 'Overdue:', 'Waiting 5 days:', 'Friday:'])('treats "%s" as urgent', (lead) => {
    expect(isUrgentContent({ priorities: [{ lead }] })).toBe(true)
  })
  it.each(['Fresh role:', 'New for you:'])('does not treat "%s" as urgent', (lead) => {
    expect(isUrgentContent({ priorities: [{ lead }] })).toBe(false)
  })
  it('is not urgent with no priorities', () => {
    expect(isUrgentContent({ priorities: [] })).toBe(false)
  })
})
