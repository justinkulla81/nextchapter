import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'
import { decryptToken, encryptToken, isEncryptedToken } from '@/lib/security/token-crypto'

const KEY_A = randomBytes(32).toString('base64')
const KEY_B = randomBytes(32).toString('hex')

describe('token-crypto', () => {
  const saved = { k: process.env.TOKEN_ENCRYPTION_KEY, p: process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS }
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY_A
    delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS
  })
  afterEach(() => {
    if (saved.k === undefined) delete process.env.TOKEN_ENCRYPTION_KEY
    else process.env.TOKEN_ENCRYPTION_KEY = saved.k
    if (saved.p === undefined) delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS
    else process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = saved.p
  })

  it('round-trips and never stores plaintext', () => {
    const enc = encryptToken('1//refresh-token-value')
    expect(isEncryptedToken(enc)).toBe(true)
    expect(enc).not.toContain('refresh-token-value')
    expect(decryptToken(enc)).toBe('1//refresh-token-value')
  })
  it('uses a fresh IV per encryption', () => {
    expect(encryptToken('same')).not.toBe(encryptToken('same'))
  })
  it('passes legacy plaintext through on read and is idempotent on write', () => {
    expect(decryptToken('ya29.legacy')).toBe('ya29.legacy')
    const enc = encryptToken('x')
    expect(encryptToken(enc)).toBe(enc)
  })
  it('writes plaintext (not a crash) when no key is configured', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY
    expect(encryptToken('abc')).toBe('abc')
  })
  it('throws rather than leaking ciphertext when the key is missing or wrong', () => {
    const enc = encryptToken('secret')
    delete process.env.TOKEN_ENCRYPTION_KEY
    expect(() => decryptToken(enc)).toThrow()
    process.env.TOKEN_ENCRYPTION_KEY = KEY_B
    expect(() => decryptToken(enc)).toThrow()
  })
  it('detects tampering (GCM tag)', () => {
    const enc = encryptToken('secret')
    const tampered = enc.slice(0, -2) + (enc.endsWith('AA') ? 'BB' : 'AA')
    expect(() => decryptToken(tampered)).toThrow()
  })
  it('rotates via KEY_PREVIOUS', () => {
    const enc = encryptToken('secret')
    process.env.TOKEN_ENCRYPTION_KEY = KEY_B
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = KEY_A
    expect(decryptToken(enc)).toBe('secret')
    expect(decryptToken(encryptToken(decryptToken(enc)))).toBe('secret')
  })
})
