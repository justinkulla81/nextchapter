import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/visitor-state/route'

const call = (h: Record<string, string>) => GET(new Request('http://x/api/visitor-state', { headers: h })).json()

describe('visitor state route', () => {
  it('returns a US state from the geolocation headers', async () => {
    expect(await call({ 'x-vercel-ip-country': 'US', 'x-vercel-ip-country-region': 'oh' })).toEqual({ state: 'OH' })
  })
  it('returns null outside the US, for a non-state region, or with no headers', async () => {
    expect(await call({ 'x-vercel-ip-country': 'CA', 'x-vercel-ip-country-region': 'ON' })).toEqual({ state: null })
    expect(await call({ 'x-vercel-ip-country': 'US', 'x-vercel-ip-country-region': 'ZZ' })).toEqual({ state: null })
    expect(await call({})).toEqual({ state: null })
  })
})
