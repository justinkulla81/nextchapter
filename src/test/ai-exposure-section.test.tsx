import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/posthog/client', () => ({ usePostHog: () => null, posthog: null }))

const split = {
  measured: 6100,
  total: 10000,
  coverage: 0.61,
  counts: { high: 2013, some: 1769, little: 2318 },
  shares: { high: 0.33, some: 0.29, little: 0.38 },
}

async function render(data: { split: typeof split | null; occupations: number }, withCta = true) {
  const { AiExposureSectionView } = await import('@/components/marketing/AiExposureSection')
  return renderToStaticMarkup(
    <AiExposureSectionView page="home" split={data.split} occupations={data.occupations} cta={withCta ? { event: 'homepage_cta_clicked', properties: { cta: 'ai_exposure_assessment' }, className: 'x' } : undefined} />,
  )
}

const FORBIDDEN = /\b(safe|safer|risk|risky|replace|replaced|replaces|only|first|no other|unlike)\b/i

describe('AI exposure public section', () => {
  it('states the three points, the meaning, coverage and the credit', async () => {
    const html = await render({ split, occupations: 756 })
    expect(html).toContain('See where AI is already changing the jobs you are looking at')
    expect(html).toContain('Every opening shows how much AI use is observed in its occupation')
    expect(html).toContain('pay and the AI exposure side by side')
    expect(html).toContain('matches your role’s exposure and what postings ask for')
    expect(html).toContain('It is not a forecast')
    expect(html).toContain('a low number means no use seen yet')
    expect(html).toContain('756 occupations')
    expect(html).toContain('openings we could place in an occupation')
    expect(html).toContain('Anthropic Economic Index')
    expect(html).toContain('https://www.anthropic.com/research/labor-market-impacts')
    expect(html).toContain('March 2026')
    expect(html).toContain('Get your Market Reality Assessment')
  })

  it('uses no forbidden word and makes no only or first claim', async () => {
    for (const data of [{ split, occupations: 756 }, { split: null, occupations: 0 }]) {
      const html = await render(data)
      const text = html.replace(/<[^>]+>/g, ' ')
      expect(text).not.toMatch(FORBIDDEN)
      expect(text).not.toMatch(/will (replace|take|eliminate)/i)
    }
  })

  it('hides the split and keeps the credit when the live numbers fail', async () => {
    const html = await render({ split: null, occupations: 0 }, false)
    expect(html).not.toContain('openings we could place')
    expect(html).toContain('Anthropic Economic Index')
    expect(html).toContain('What exposure means')
    expect(html).not.toContain('Get your Market Reality Assessment')
  })
})
