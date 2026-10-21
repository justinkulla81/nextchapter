import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/skills/ai-market-trend-server', () => ({
  loadAiShareTrend: async () => null,
}))
vi.mock('@/lib/skills/ai-market-live', () => ({
  loadAiMarket: async () => null,
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
