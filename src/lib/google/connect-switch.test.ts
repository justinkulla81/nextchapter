import { describe, expect, it } from 'vitest'
import { isGoogleConnectOn } from './connect-switch'

describe('isGoogleConnectOn', () => {
  it('is off unless explicitly on', () => {
    expect(isGoogleConnectOn({})).toBe(false)
    expect(isGoogleConnectOn({ GOOGLE_CONNECT_ENABLED: '' })).toBe(false)
    expect(isGoogleConnectOn({ GOOGLE_CONNECT_ENABLED: 'off' })).toBe(false)
    expect(isGoogleConnectOn({ GOOGLE_CONNECT_ENABLED: 'true' })).toBe(false)
  })
  it('is on for "on" in any case, with spaces', () => {
    expect(isGoogleConnectOn({ GOOGLE_CONNECT_ENABLED: 'on' })).toBe(true)
    expect(isGoogleConnectOn({ GOOGLE_CONNECT_ENABLED: ' ON ' })).toBe(true)
  })
})
