import { describe, it, expect } from 'vitest'
import { speakerFit } from '@/lib/speaking/relevance'
import { parseSpeakingLeads, leadRef } from '@/lib/speaking/sync'
import { kindFromConferenceType } from '@/lib/speaking/kinds'

describe('speakerFit', () => {
  it('skips events unrelated to workforce, talent or higher ed', () => {
    expect(speakerFit({ name: 'National Roofing Expo', industries: ['Construction'] })).toBeNull()
  })
  it('rates a flagship workforce + AI event as best fit', () => {
    const r = speakerFit({ name: 'Future of Work Summit', whyAttend: 'AI and talent leaders', importance: 1 })
    expect(r?.fit).toBe(1)
  })
  it('does not accept a lone startup or AI mention', () => {
    expect(speakerFit({ name: 'AI Dev Day', whyAttend: 'machine learning engineers' })).toBeNull()
  })
})

describe('parseSpeakingLeads', () => {
  it('keeps valid leads and reports bad ones', () => {
    const { leads, errors } = parseSpeakingLeads({ leads: [
      { kind: 'PANEL', title: 'SHRM panel', url: 'https://shrm.org/x', deadline: '2026-12-01', fit: 1 },
      { kind: 'BOGUS', title: 'x' },
      { kind: 'DEMO_DAY', title: 'y', url: 'javascript:alert(1)' },
    ] })
    expect(leads).toHaveLength(1)
    expect(leads[0].deadline?.toISOString().slice(0, 10)).toBe('2026-12-01')
    expect(errors).toHaveLength(2)
  })
  it('keys a lead on its link without www or trailing slash', () => {
    expect(leadRef({ url: 'https://www.Example.com/Apply/', title: 'a' })).toBe('web:example.com/apply')
  })
})

describe('kindFromConferenceType', () => {
  it('maps speaker calls to panels and unknown types to null', () => {
    expect(kindFromConferenceType('CALL_FOR_SPEAKERS')).toBe('PANEL')
    expect(kindFromConferenceType('REPORT')).toBeNull()
  })
})
