import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/skills/ai-market-trend-server', () => ({
  loadAiShareTrend: async () => null,
}))
vi.mock('@/lib/skills/ai-market-live', () => ({
  loadAiMarket: async () => null,
}))
// The section is an async server component, which renderToStaticMarkup cannot render; its view is rendered with no live data.
vi.mock('@/components/marketing/AiExposureSection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/marketing/AiExposureSection')>()
  return {
    ...actual,
    AiExposureSection: (props: Parameters<typeof actual.AiExposureSection>[0]) => actual.AiExposureSectionView({ ...props, split: null, occupations: 0 }),
  }
})
vi.mock('@/lib/skills/ai-exposure-server', () => ({
  loadJobsByExposure: async () => null,
  loadExposureMap: async () => new Map(),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }), useSearchParams: () => new URLSearchParams() }))

describe('public AI pages render', () => {
  it('/ai-skills shows the table, the limits and no unsupported claim', async () => {
    const { default: Page } = await import('@/app/ai-skills/page')
    const html = renderToStaticMarkup(await Page())
    expect(html).toContain('By function')
    expect(html).toContain('Data &amp; Analytics')
    expect(html).toContain('The pay is what employers advertise')
    expect(html).toContain('A trend appears here after four weeks')
    expect(html).not.toMatch(/table stakes|every function/i)
    expect(html).toContain('/ai-training')
    expect(html).toContain('See where AI is already changing the jobs you are looking at')
    expect(html).toContain('Anthropic Economic Index')
  }, 60_000)

  it('/ai-skills shows industry, state and level tables when the snapshot has them', async () => {
    vi.resetModules()
    vi.doMock('@/lib/skills/ai-market-live', () => ({
      loadAiMarket: async () => ({
        asOf: '2026-10-21T00:00:00Z',
        counts: { live: 1000, aiSkill: 120, aiExposed: 150, fullText: 1000, twin: 0, excerpt: 0, unread: 0, aiSkillFullText: 120, aiExposedFullText: 150 },
        functions: {},
        dimensions: {
          industry: [{ key: 'Technology & Software', label: 'Technology & Software', n: 900, aiSkill: 300, sharePct: 33.3 }],
          state: [{ key: 'CA', label: 'CA', n: 600, aiSkill: 90, sharePct: 15 }],
          level: [{ key: 'mid', label: 'Mid-level', n: 700, aiSkill: 70, sharePct: 10 }],
        },
      }),
    }))
    const { default: Page } = await import('@/app/ai-skills/page')
    const html = renderToStaticMarkup(await Page())
    expect(html).toContain('By industry')
    expect(html).toContain('Technology &amp; Software')
    expect(html).toContain('By state')
    expect(html).toContain('>CA<')
    expect(html).toContain('Mid-level')
    vi.doUnmock('@/lib/skills/ai-market-live')
  }, 60_000)

  it('/ai-training names the models and shows no price', async () => {
    const { default: Page } = await import('@/app/ai-training/page')
    const html = renderToStaticMarkup(Page())
    expect(html).toContain('the leading job transition platform')
    expect(html).toContain('Course development')
    expect(html).toContain('Grant partner')
    expect(html).toContain('Cohort license')
    expect(html).not.toContain('promise')
    expect(html).not.toMatch(/\$\d/) // no price on the public page
  }, 60_000)
})

describe('/ai-skills lede', () => {
  it('states the real top and bottom of the table, not a fixed claim', async () => {
    vi.resetModules()
    const { default: Page } = await import('@/app/ai-skills/page')
    const html = renderToStaticMarkup(await Page())
    const { publicFunctionRows } = await import('@/lib/skills/ai-skills-public')
    const rows = publicFunctionRows()
    expect(html).toContain(`runs from`)
    expect(html).toContain(rows[rows.length - 1].label)
    expect(html).not.toContain('close to half')
  }, 60_000)
})
