import { describe, expect, it } from 'vitest'
import { captureSource, ownerOffer, saveCopy, saveSource, type CaptureKind, type PageCaptureConfig } from '@/lib/capture/page-capture'

const JOURNEY_SOURCE = /^page:(state|county|city|industry|function|title|company|college):[a-z0-9-]{1,70}$/
const KINDS: CaptureKind[] = ['state', 'county', 'city', 'industry', 'function', 'title', 'company', 'college']

describe('page capture config', () => {
  it('builds a source the journey and owner-inquiry allowlists accept, for every kind', () => {
    for (const kind of KINDS) {
      expect(captureSource({ kind, slug: 'Ohio_Columbus (OH)' })).toMatch(JOURNEY_SOURCE)
    }
  })
  it('keeps long slugs inside the 100-character source limit', () => {
    expect(captureSource({ kind: 'college', slug: 'x'.repeat(300) }).length).toBeLessThanOrEqual(100)
  })
  it('saves places under page:place and everything else under its own page type the alert action accepts', () => {
    const accepted = /^page:(employer|title|salary|place|industry|function|college|company)$/
    for (const kind of KINDS) expect(saveSource(kind)).toMatch(accepted)
  })
  it('has owner and save copy for every kind', () => {
    for (const kind of KINDS) {
      const c: PageCaptureConfig = { kind, slug: 'x', label: 'Thing' }
      expect(ownerOffer(c).href.startsWith('/')).toBe(true)
      expect(saveCopy(c).cta.length).toBeGreaterThan(0)
    }
  })
  it('names the pain and the payoff on every page that has a follow box', () => {
    for (const kind of ['title', 'industry', 'function', 'company', 'state', 'ranking'] as CaptureKind[]) {
      const c = saveCopy({ kind, slug: 'x', label: 'Thing' })
      expect(c.heading.length).toBeGreaterThan(0)
      expect(c.follow.length).toBeGreaterThan(0)
      expect(c.cta).toBe('Email me new jobs')
    }
  })
})
