import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { __internals } from '@/lib/security/token-crypto-extension'
import { isEncryptedToken } from '@/lib/security/token-crypto'

const { encryptArgs, decryptDeep, mayReachTokens } = __internals

describe('token-crypto extension internals', () => {
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  })

  it('encrypts token fields in create/update/upsert and { set } forms, leaving the rest', () => {
    const out = encryptArgs({
      where: { candidateId: 'c1' },
      create: { candidateId: 'c1', accessToken: 'a', refreshToken: 'r', expiresAt: 1 },
      update: { accessToken: { set: 'a2' }, lastSyncAt: 2 },
    }) as any
    expect(out.where).toEqual({ candidateId: 'c1' })
    expect(isEncryptedToken(out.create.accessToken)).toBe(true)
    expect(isEncryptedToken(out.create.refreshToken)).toBe(true)
    expect(out.create.candidateId).toBe('c1')
    expect(isEncryptedToken(out.update.accessToken.set)).toBe(true)
    expect(out.update.lastSyncAt).toBe(2)
  })

  it('encrypts createMany arrays', () => {
    const out = encryptArgs({ data: [{ accessToken: 'a' }, { accessToken: 'b' }] }) as any
    expect(out.data.every((d: any) => isEncryptedToken(d.accessToken))).toBe(true)
  })

  it('decrypts nested relation results and leaves bearer-style tokens alone', () => {
    const enc = (encryptArgs({ data: { refreshToken: 'secret-r', accessToken: 'secret-a' } }) as any).data
    const rows = [{ id: 'm1', connection: { ...enc, id: 'x' } }, { id: 'm2', connection: null }]
    decryptDeep(rows)
    expect(rows[0].connection.refreshToken).toBe('secret-r')
    expect(rows[0].connection.accessToken).toBe('secret-a')
    const coach = { accessToken: 'cjld2cjxh0000qzrmn831i7rn' }
    decryptDeep(coach)
    expect(coach.accessToken).toBe('cjld2cjxh0000qzrmn831i7rn')
  })

  it('only walks results that can contain tokens', () => {
    expect(mayReachTokens('EmailConnection', {})).toBe(true)
    expect(mayReachTokens('EmailMessage', { include: { connection: true } })).toBe(true)
    expect(mayReachTokens('EmailMessage', { select: { id: true, connection: { select: { refreshToken: true } } } })).toBe(true)
    expect(mayReachTokens('JobPosting', { select: { id: true, title: true } })).toBe(false)
    expect(mayReachTokens('JobPosting', {})).toBe(false)
  })
})
