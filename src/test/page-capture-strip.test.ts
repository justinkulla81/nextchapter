import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/leads/actions', () => ({ submitJourneyLead: vi.fn(), submitSaveSearch: vi.fn() }))
vi.mock('@/lib/posthog/client', () => ({ posthog: { capture: vi.fn() }, usePostHog: () => null }))

const render = async (kind: 'ranking' | 'industry') => {
  const { PageCaptureTop } = await import('@/components/capture/PageCapture')
  return renderToStaticMarkup(createElement(PageCaptureTop, { capture: { kind, slug: 'rankings', label: 'professional' } }))
}

// One call to action per page: the navy box with the Market Reality button. The first-week-plan email sits behind "Not ready?".
describe('page capture top', () => {
  it.each(['ranking', 'industry'] as const)('renders one box with the assessment button and the email closed (%s)', async (kind) => {
    const html = await render(kind)
    expect(html).toContain('Applying and hearing nothing back?')
    expect(html).toContain('Get my Market Reality Assessment')
    expect(html).toContain('goal=market-reality')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('Question 1')
    expect(html).not.toContain('id="next-step-extras"')
  })
})
