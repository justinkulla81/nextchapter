import { describe, expect, it } from 'vitest'
import { isSafeReturnPath } from './oauth-return-path'

describe('isSafeReturnPath', () => {
  it('allows the dashboard and the onboarding Google reveal, and nothing else', () => {
    expect(isSafeReturnPath('/dashboard/network')).toBe(true)
    expect(isSafeReturnPath('/onboarding/google')).toBe(true)
    expect(isSafeReturnPath('/onboarding/welcome')).toBe(false)
    expect(isSafeReturnPath('/onboarding/google/../x')).toBe(false)
    expect(isSafeReturnPath('https://evil.example/dashboard')).toBe(false)
    expect(isSafeReturnPath(null)).toBe(false)
  })
})
