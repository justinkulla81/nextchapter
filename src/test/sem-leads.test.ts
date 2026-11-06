import { describe, expect, it } from 'vitest'
import { isB2bCampaign } from '@/lib/admin/sem-leads'

describe('isB2bCampaign', () => {
  it('reads B2B segments from the campaign tag', () => {
    expect(isB2bCampaign('b2b-employers-google')).toBe(true)
    expect(isB2bCampaign('b2b-boards-google')).toBe(true)
    expect(isB2bCampaign('b2b-highered-google')).toBe(true)
  })
  it('treats candidate segments, untagged and missing campaigns as B2C', () => {
    expect(isB2bCampaign('laid-off-recent-google')).toBe(false)
    expect(isB2bCampaign('something-else')).toBe(false)
    expect(isB2bCampaign(null)).toBe(false)
  })
  it('decodes a percent-encoded tag', () => {
    expect(isB2bCampaign('B2B-employers-google')).toBe(true)
  })
})
