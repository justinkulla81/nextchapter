import { describe, it, expect } from 'vitest'
import { classifyTrafficSource } from '@/lib/marketing/classify-traffic-source'

describe('classifyTrafficSource', () => {
  it('returns Direct when there is no referrer and no utm_source', () => {
    expect(classifyTrafficSource('/pricing', null)).toBe('Direct')
  })

  it('classifies known search/social/video referrer domains', () => {
    expect(classifyTrafficSource('/', 'https://www.google.com/search?q=nextchapter')).toBe('Google')
    expect(classifyTrafficSource('/', 'https://www.youtube.com/watch?v=abc')).toBe('YouTube')
    expect(classifyTrafficSource('/', 'https://chat.openai.com/')).toBe('ChatGPT')
    expect(classifyTrafficSource('/', 'https://chatgpt.com/')).toBe('ChatGPT')
    expect(classifyTrafficSource('/', 'https://www.facebook.com/')).toBe('Facebook')
    expect(classifyTrafficSource('/', 'https://www.linkedin.com/feed/')).toBe('LinkedIn')
    expect(classifyTrafficSource('/', 'https://lnkd.in/abc123')).toBe('LinkedIn')
    expect(classifyTrafficSource('/', 'https://www.bing.com/search?q=x')).toBe('Bing')
  })

  it('classifies web-based mail clients as Email', () => {
    expect(classifyTrafficSource('/', 'https://mail.google.com/mail/u/0/')).toBe('Email')
    expect(classifyTrafficSource('/', 'https://outlook.live.com/mail/0/inbox')).toBe('Email')
  })

  it('classifies an unrecognized referrer domain as Other, showing the hostname', () => {
    expect(classifyTrafficSource('/', 'https://www.somenewsblog.example/article')).toBe('Other (www.somenewsblog.example)')
  })

  it('classifies the site\'s own domain as Internal, not a real external source', () => {
    expect(classifyTrafficSource('/pricing', 'https://launchyournextchapter.com/dashboard')).toBe('Internal')
  })

  it('an explicit utm_source query param overrides the referrer entirely', () => {
    expect(classifyTrafficSource('/?utm_source=chatgpt', 'https://www.google.com/')).toBe('ChatGPT')
    expect(classifyTrafficSource('/?utm_source=email', null)).toBe('Email')
  })

  it('title-cases an unrecognized utm_source value rather than dropping it', () => {
    expect(classifyTrafficSource('/?utm_source=podcast', null)).toBe('Podcast')
  })

  it('falls back to Direct for a malformed referrer URL', () => {
    expect(classifyTrafficSource('/', 'not-a-real-url')).toBe('Direct')
  })
})

import { trafficSourceGroup } from '@/lib/marketing/classify-traffic-source'

describe('AI and search sources', () => {
  it('labels Gemini, Claude, Perplexity and DuckDuckGo referrers', () => {
    expect(classifyTrafficSource('/', 'https://gemini.google.com/')).toBe('Gemini')
    expect(classifyTrafficSource('/', 'https://claude.ai/')).toBe('Claude')
    expect(classifyTrafficSource('/', 'https://www.perplexity.ai/search')).toBe('Perplexity')
    expect(classifyTrafficSource('/', 'https://duckduckgo.com/')).toBe('DuckDuckGo')
  })
  it('reads the utm_source ChatGPT appends and the Google for Jobs tag', () => {
    expect(classifyTrafficSource('/jobs/abc?utm_source=chatgpt.com', null)).toBe('ChatGPT')
    expect(classifyTrafficSource('/jobs/abc?utm_source=google_jobs_apply&utm_campaign=x', 'https://www.google.com/')).toBe('Google for Jobs')
  })
  it('rolls labels into groups', () => {
    expect(trafficSourceGroup('Gemini')).toBe('AI assistants')
    expect(trafficSourceGroup('Google')).toBe('Search engines')
    expect(trafficSourceGroup('Google for Jobs')).toBe('Google for Jobs')
    expect(trafficSourceGroup('Other (jooble.org)')).toBe('Other sites')
  })
})
