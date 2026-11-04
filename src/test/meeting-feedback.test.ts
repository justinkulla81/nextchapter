import { describe, expect, it } from 'vitest'
import { feedbackSourceFor, keepVerbatim, suggestionRef } from '@/lib/crm/meeting-feedback'

const notes = `Platform usability and technical feedback
Andrew Cantle recommended adding time estimates, progress trackers, and visual icons to improve onboarding.
The system experiences connectivity errors when users operate behind active VPNs.`

describe('keepVerbatim', () => {
  it('keeps a quote that is in the notes, ignoring case and spacing', () => {
    const out = keepVerbatim([{ theme: 'VPN errors', quote: 'the system experiences  connectivity errors when users operate behind active VPNs.' }], notes)
    expect(out).toHaveLength(1)
  })
  it('drops a reworded quote, a repeat and a too-short one', () => {
    const out = keepVerbatim([
      { theme: 'a', quote: 'Andrew wants progress trackers in onboarding.' },
      { theme: 'b', quote: 'The system experiences connectivity errors when users operate behind active VPNs.' },
      { theme: 'c', quote: 'The system experiences connectivity errors when users operate behind active VPNs.' },
      { theme: 'd', quote: 'VPNs' },
    ], notes)
    expect(out.map((i) => i.theme)).toEqual(['b'])
  })
})

describe('feedbackSourceFor', () => {
  it('calls a job seeker a candidate even with other roles', () => {
    expect(feedbackSourceFor(['ADVISOR', 'JOB_SEEKER'])).toBe('CANDIDATE')
  })
  it('maps other roles and falls back to other', () => {
    expect(feedbackSourceFor(['INVESTOR_VC'])).toBe('INVESTOR')
    expect(feedbackSourceFor(['CHRO'])).toBe('EMPLOYER')
    expect(feedbackSourceFor([])).toBe('OTHER')
  })
})

it('keys a suggestion by event, person and position', () => {
  expect(suggestionRef('ev1', 'p1', 2)).toBe('ev1:p1:2')
})
