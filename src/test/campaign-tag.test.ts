import { describe, expect, it } from 'vitest'
import { DEFAULT_LANDING, LANDING_PAGES, SEGMENTS, buildTaggedLink, parseUtm, segmentLabel, slugify, splitCampaign } from '@/lib/marketing/campaign-tag'

describe('buildTaggedLink', () => {
  it('builds a Google Search link with the keyword placeholder', () => {
    expect(buildTaggedLink({ segment: 'laid-off-recent', channel: 'google', landing: '/layoffs' })).toBe(
      'https://launchyournextchapter.com/layoffs?utm_source=google&utm_medium=cpc&utm_campaign=laid-off-recent-google&utm_term={keyword}',
    )
  })

  it('builds a LinkedIn ads link for a B2B audience', () => {
    expect(buildTaggedLink({ segment: 'b2b-boards', channel: 'linkedin-ads', landing: '/workforce-boards' })).toBe(
      'https://launchyournextchapter.com/workforce-boards?utm_source=linkedin&utm_medium=paid_social&utm_campaign=b2b-boards-linkedin-ads',
    )
  })

  it('puts the partner name in the source and the campaign', () => {
    expect(buildTaggedLink({ segment: 'b2b-highered', channel: 'partner', landing: '/higher-education', name: ' NAWDP Weekly ' })).toBe(
      'https://launchyournextchapter.com/higher-education?utm_source=nawdp-weekly&utm_medium=referral&utm_campaign=b2b-highered-partner-nawdp-weekly',
    )
  })

  it('needs a name for partner, community and newsletter links, and a known segment and path', () => {
    expect(buildTaggedLink({ segment: 'senior', channel: 'partner', landing: '/how-it-works' })).toBeNull()
    expect(buildTaggedLink({ segment: 'nope', channel: 'google', landing: '/layoffs' })).toBeNull()
    expect(buildTaggedLink({ segment: 'senior', channel: 'google', landing: 'layoffs' })).toBeNull()
  })

  it('round-trips through the parser, so the funnel page reads back what the builder wrote', () => {
    const url = buildTaggedLink({ segment: 'ai-retraining', channel: 'facebook', landing: '/ai-training' })!
    const path = url.replace('https://launchyournextchapter.com', '')
    expect(splitCampaign(parseUtm(path)!.campaign)).toEqual({ segment: 'ai-retraining', channel: 'facebook' })
    const named = buildTaggedLink({ segment: 'laid-off-long', channel: 'community', landing: '/why-stuck', name: 'Laid Off Pros' })!
    expect(splitCampaign(parseUtm(named.replace('https://launchyournextchapter.com', ''))!.campaign)).toEqual({ segment: 'laid-off-long', channel: 'community-laid-off-pros' })
  })

  it('points every segment at a listed landing page', () => {
    const paths = new Set<string>(LANDING_PAGES.map((p) => p.path))
    for (const s of SEGMENTS) expect(paths.has(DEFAULT_LANDING[s.key])).toBe(true)
  })

  it('slugifies names', () => {
    expect(slugify('  Pennsylvania Workforce Dev. Assoc. ')).toBe('pennsylvania-workforce-dev-assoc')
  })

  it('reads the B2B tags instead of calling them untagged', () => {
    expect(splitCampaign('b2b-employers-linkedin-ads')).toEqual({ segment: 'b2b-employers', channel: 'linkedin-ads' })
    expect(segmentLabel('b2b-outplacement')).toBe('B2B: outplacement and career transition')
  })
})

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
