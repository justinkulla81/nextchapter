import { describe, it, expect } from 'vitest'
import { classifyDevice, classifyBrowser, classifyOs } from '@/lib/http/device'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'

describe('classifyDevice', () => {
  it('buckets phones, tablets and desktops', () => {
    expect(classifyDevice(IPHONE)).toBe('Mobile')
    expect(classifyDevice(ANDROID_PHONE)).toBe('Mobile')
    expect(classifyDevice(IPAD)).toBe('Tablet')
    expect(classifyDevice(ANDROID_TABLET)).toBe('Tablet')
    expect(classifyDevice(MAC_CHROME)).toBe('Desktop')
    expect(classifyDevice(WIN_EDGE)).toBe('Desktop')
  })
  it('returns Unknown for a missing or unrecognized user agent', () => {
    expect(classifyDevice(null)).toBe('Unknown')
    expect(classifyDevice('something-odd/1.0')).toBe('Unknown')
  })
})

describe('classifyBrowser and classifyOs', () => {
  it('reads Edge as Edge, not Chrome', () => {
    expect(classifyBrowser(WIN_EDGE)).toBe('Edge')
    expect(classifyBrowser(MAC_CHROME)).toBe('Chrome')
    expect(classifyBrowser(IPHONE)).toBe('Safari')
  })
  it('detects the operating system', () => {
    expect(classifyOs(IPHONE)).toBe('iOS')
    expect(classifyOs(ANDROID_PHONE)).toBe('Android')
    expect(classifyOs(MAC_CHROME)).toBe('macOS')
    expect(classifyOs(WIN_EDGE)).toBe('Windows')
  })
})
