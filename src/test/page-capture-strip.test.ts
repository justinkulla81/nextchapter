import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/leads/actions', () => ({ submitJourneyLead: vi.fn(), submitSaveSearch: vi.fn() }))
vi.mock('@/lib/posthog/client', () => ({ posthog: { capture: vi.fn() } }))

const render = async (kind: 'ranking' | 'industry') => {
  const { PageCaptureTop } = await import('@/components/capture/PageCapture')
  return renderToStaticMarkup(createElement(PageCaptureTop, { capture: { kind, slug: 'rankings', label: 'professional' } }))
}

describe('page capture top', () => {
  it('shows ranking pages as a one-line strip with the question closed', async () => {
    const html = await render('ranking')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('Where are you right now?')
    expect(html).not.toContain('Question 1')
    expect(html).not.toContain('id="capture-panel"')
  })
  it('keeps the open question on every other page kind', async () => {
    const html = await render('industry')
    expect(html).toContain('Question 1')
    expect(html).not.toContain('aria-expanded')
  })
})
