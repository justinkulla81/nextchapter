import { describe, expect, it } from 'vitest'
import { parseUtm, segmentLabel, splitCampaign } from '@/lib/marketing/campaign-tag'

describe('parseUtm', () => {
  it('reads source, medium and campaign off a landing path', () => {
    expect(parseUtm('/layoffs?utm_source=google&utm_medium=cpc&utm_campaign=laid-off-recent-google')).toEqual({
      source: 'google',
      medium: 'cpc',
      campaign: 'laid-off-recent-google',
    })
  })

  it('lowercases and decodes values and ignores a fragment', () => {
    expect(parseUtm('/?utm_campaign=Career%20Change-Meta#top')).toEqual({ source: null, medium: null, campaign: 'career change-meta' })
  })

  it('is null without a query or without any utm parameter', () => {
    expect(parseUtm('/jobs')).toBeNull()
    expect(parseUtm('/jobs?q=cfo')).toBeNull()
    expect(parseUtm(null)).toBeNull()
  })
})

describe('splitCampaign', () => {
  it('splits a segment-then-channel campaign', () => {
    expect(splitCampaign('laid-off-recent-google')).toEqual({ segment: 'laid-off-recent', channel: 'google' })
    expect(splitCampaign('laid-off-long-linkedin-post')).toEqual({ segment: 'laid-off-long', channel: 'linkedin-post' })
    expect(splitCampaign('ai-retraining')).toEqual({ segment: 'ai-retraining', channel: '' })
  })

  it('does not mistake one laid-off segment for the other', () => {
    expect(splitCampaign('laid-off-long-reddit').segment).toBe('laid-off-long')
    expect(splitCampaign('laid-off-recent-reddit').segment).toBe('laid-off-recent')
  })

  it('reports an unknown or missing campaign as untagged and keeps the text', () => {
    expect(splitCampaign('weekly-layoffs')).toEqual({ segment: 'untagged', channel: 'weekly-layoffs' })
    expect(splitCampaign(null)).toEqual({ segment: 'untagged', channel: '' })
    expect(segmentLabel('untagged')).toBe('Untagged')
  })
})
