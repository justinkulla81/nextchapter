import { describe, expect, it } from 'vitest'
import { BOT_SIGNATURES, classifyUserAgent } from '@/lib/http/user-agent'

const LINUX_CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'

describe('classifyUserAgent', () => {
  it('counts the Linux Chrome crawler seen on 2026-10-26 as a bot', () => {
    expect(classifyUserAgent(LINUX_CHROME)).toBe('bot')
    expect(classifyUserAgent(LINUX_CHROME.replace('155', '156'))).toBe('bot')
  })

  it('still counts ordinary visitors as human', () => {
    expect(classifyUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36')).toBe('human')
    expect(classifyUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0.1 Safari/605.1.15')).toBe('human')
    expect(classifyUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1')).toBe('human')
    expect(classifyUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36')).toBe('human')
    expect(classifyUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0')).toBe('human')
  })

  it('keeps an empty user agent unknown, not bot', () => {
    expect(classifyUserAgent(null)).toBe('unknown')
  })

  it('keeps every signature safe for the SQL ILIKE and Prisma contains filters that share the list', () => {
    // % and a backslash change what an ILIKE pattern means. An underscore only matches one more character, so it is fine.
    for (const s of BOT_SIGNATURES) expect(s).not.toMatch(/[%\\]/)
  })
})
