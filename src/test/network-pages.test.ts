import { describe, expect, it } from 'vitest'
import {
  NETWORK_PARTS,
  coachingIntro,
  communityIntro,
  contactsIntro,
  followUpActionLabel,
  followUpWhy,
  followUpsIntro,
  groupsIntro,
  recruiterRequestsIntro,
  referenceStatusText,
  referencesIntro,
  supportersIntro,
  thisWeekIntro,
} from '@/lib/redesign/network-pages'

describe('network page copy', () => {
  it('lists the circle pages closest first', () => {
    expect(NETWORK_PARTS.map((p) => p.key)).toEqual(['close', 'know', 'alumni', 'industry', 'recruiters'])
  })
  it('explains an empty contact list as a benefit', () => {
    expect(contactsIntro(0)).toMatch(/tell you who to write to first/)
    expect(contactsIntro(1)).toBe('1 person you know. Most jobs come through someone like them, so each one is worth a note.')
  })
  it('pluralises this week and follow-ups', () => {
    expect(thisWeekIntro(1)).toMatch(/^1 conversation worth/)
    expect(thisWeekIntro(5)).toMatch(/^5 conversations/)
    expect(followUpsIntro(1)).toMatch(/^1 item is waiting/)
    expect(followUpsIntro(3)).toMatch(/^3 items are waiting/)
    expect(followUpsIntro(0)).toMatch(/Nothing is waiting/)
  })
  it('gives every follow-up kind a reason and an action', () => {
    for (const k of ['starred-contact', 'needs-follow-up', 'unanswered-application', 'stale-contact'] as const) {
      expect(followUpWhy(k).length).toBeGreaterThan(20)
      expect(followUpActionLabel(k)).toBeTruthy()
    }
  })
  it('tracks references toward three', () => {
    expect(referencesIntro(0, 3)).toMatch(/Ask the first person/)
    expect(referencesIntro(2, 3)).toMatch(/^2 of 3/)
    expect(referencesIntro(3, 3)).toMatch(/vouched/)
  })
  it('says reference status as what happens next', () => {
    expect(referenceStatusText('REQUESTED')).toMatch(/Waiting/)
    expect(referenceStatusText('DECLINED')).not.toMatch(/fail|declined/i)
  })
  it('handles empty and filled recruiter and group intros', () => {
    expect(recruiterRequestsIntro(0)).toMatch(/You decide/)
    expect(recruiterRequestsIntro(3)).toMatch(/^3 recruiters asked/)
    expect(groupsIntro(0)).toMatch(/warm doors/)
    expect(groupsIntro(1)).toMatch(/^1 group\./)
  })
  it('picks coaching, supporter and community copy by state', () => {
    expect(coachingIntro(true, true)).toMatch(/Your coach/)
    expect(coachingIntro(true, false)).toMatch(/match you/)
    expect(coachingIntro(false, false)).toMatch(/code/)
    expect(supportersIntro(0)).toMatch(/You choose who/)
    expect(supportersIntro(2)).toMatch(/one short note a week/)
    expect(communityIntro('messages')).toMatch(/one place/)
    expect(communityIntro('community')).toMatch(/your field/)
  })
})
