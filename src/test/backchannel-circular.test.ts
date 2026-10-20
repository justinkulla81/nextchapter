import { describe, it, expect } from 'vitest'
import { isCircularEmailMatch } from '@/lib/network/backchannel-circular'

describe('isCircularEmailMatch', () => {
  it('rejects an email-detected contact matched only by its domain guess to an email-detected application', () => {
    expect(isCircularEmailMatch({ jobSource: 'EMAIL_DETECTED', contactSource: 'EMAIL_DETECTED', matchedOnlyByInference: true })).toBe(true)
  })
  it('keeps a contact whose company was actually recorded', () => {
    expect(isCircularEmailMatch({ jobSource: 'EMAIL_DETECTED', contactSource: 'EMAIL_DETECTED', matchedOnlyByInference: false })).toBe(false)
  })
  it('keeps imported or hand-added contacts and hand-added applications', () => {
    expect(isCircularEmailMatch({ jobSource: 'EMAIL_DETECTED', contactSource: 'CSV_IMPORT', matchedOnlyByInference: true })).toBe(false)
    expect(isCircularEmailMatch({ jobSource: 'MANUAL', contactSource: 'EMAIL_DETECTED', matchedOnlyByInference: true })).toBe(false)
  })
})
