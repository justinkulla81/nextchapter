import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/posthog/client', () => ({ posthog: { capture: vi.fn() } }))

async function load(label: string | undefined) {
  vi.resetModules()
  if (label) vi.stubEnv('NEXT_PUBLIC_ADS_LEAD_CONVERSION', label)
  else vi.stubEnv('NEXT_PUBLIC_ADS_LEAD_CONVERSION', '')
  const gtag = vi.fn()
  vi.stubGlobal('window', { gtag })
  const { adsEvent } = await import('@/lib/analytics/ads-events')
  return { adsEvent, gtag }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Google Ads lead conversion', () => {
  it('counts a lead from an /lp page', async () => {
    const { adsEvent, gtag } = await load('AW-1/abc')
    adsEvent('contact_form_sent', { source: 'lp-workforce' })
    expect(gtag).toHaveBeenCalledWith('event', 'conversion', { send_to: 'AW-1/abc' })
  })
  it('does not count the general Contact form or other events', async () => {
    const { adsEvent, gtag } = await load('AW-1/abc')
    adsEvent('contact_form_sent', { source: 'contact' })
    adsEvent('plan_started', { source: 'lp-workforce' })
    expect(gtag).not.toHaveBeenCalledWith('event', 'conversion', expect.anything())
  })
  it('sends nothing extra when the label is not set', async () => {
    const { adsEvent, gtag } = await load(undefined)
    adsEvent('contact_form_sent', { source: 'lp-workforce' })
    expect(gtag).not.toHaveBeenCalledWith('event', 'conversion', expect.anything())
  })
})
