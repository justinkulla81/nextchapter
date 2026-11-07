import { describe, expect, it } from 'vitest'
import { campaignOfPath, classifyPaidChannel } from '@/lib/admin/paid-channels'

describe('classifyPaidChannel', () => {
  it('reads Google and Bing click ids', () => {
    expect(classifyPaidChannel('/jobs?gclid=abc')).toBe('google')
    expect(classifyPaidChannel('/?utm_source=x&wbraid=1')).toBe('google')
    expect(classifyPaidChannel('/jobs?msclkid=abc')).toBe('bing')
  })
  it('reads paid-tagged links per network', () => {
    expect(classifyPaidChannel('/?utm_source=google&utm_medium=cpc&utm_campaign=laid-off-recent-google')).toBe('google')
    expect(classifyPaidChannel('/?utm_source=linkedin&utm_medium=paid_social')).toBe('linkedin')
    expect(classifyPaidChannel('/?utm_source=facebook&utm_medium=paid_social')).toBe('facebook')
    expect(classifyPaidChannel('/?utm_source=instagram&utm_medium=paid_social')).toBe('facebook')
    expect(classifyPaidChannel('/?utm_source=reddit&utm_medium=paid_social')).toBe('reddit')
    expect(classifyPaidChannel('/?utm_source=bing&utm_medium=cpc')).toBe('bing')
  })
  it('counts a paid-search click with no source as Google, as before', () => {
    expect(classifyPaidChannel('/?utm_medium=cpc')).toBe('google')
  })
  it('ignores organic posts, including Facebook and LinkedIn click ids and organic social tags', () => {
    expect(classifyPaidChannel('/?fbclid=abc')).toBeNull()
    expect(classifyPaidChannel('/?utm_source=linkedin&utm_medium=social')).toBeNull()
    expect(classifyPaidChannel('/?utm_source=reddit&utm_medium=social')).toBeNull()
    expect(classifyPaidChannel('/?utm_medium=paid_social')).toBeNull()
    expect(classifyPaidChannel('/jobs')).toBeNull()
    expect(classifyPaidChannel(null)).toBeNull()
  })
})

describe('campaignOfPath', () => {
  it('reads the campaign and ignores the hash', () => {
    expect(campaignOfPath('/x?utm_campaign=b2b-employers-google#top')).toBe('b2b-employers-google')
    expect(campaignOfPath('/x')).toBeNull()
  })
})
