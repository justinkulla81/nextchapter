import { describe, expect, it, vi } from 'vitest'

vi.mock('@prisma/client', () => ({ PrismaClient: class { $extends() { return this } } }))
vi.mock('@/lib/security/token-crypto-extension', () => ({ tokenCryptoExtension: {} }))
vi.mock('@/lib/security/token-defaults-extension', () => ({ tokenDefaultsExtension: {} }))

import { BUILD_POOL_SIZE, withPoolSettings } from '@/lib/prisma'

describe('withPoolSettings', () => {
  it('adds a larger pool and a longer wait to the pooled URL, keeping pgbouncer', () => {
    const out = withPoolSettings('postgresql://u:p@host:6543/postgres?pgbouncer=true')!
    expect(out).toContain('pgbouncer=true')
    expect(out).toContain('connection_limit=15')
    expect(out).toContain('pool_timeout=30')
  })
  it('keeps values already in the URL', () => {
    const out = withPoolSettings('postgresql://u:p@host:6543/postgres?pgbouncer=true&connection_limit=3&pool_timeout=5')!
    expect(out).toContain('connection_limit=3')
    expect(out).toContain('pool_timeout=5')
  })
  it('uses a small pool with a long wait during a production build', () => {
    const out = withPoolSettings('postgresql://u:p@host:6543/postgres?pgbouncer=true', true)!
    expect(out).toContain('pgbouncer=true')
    expect(out).toContain(`connection_limit=${BUILD_POOL_SIZE}`)
    expect(out).toContain('pool_timeout=120')
    expect(BUILD_POOL_SIZE).toBeLessThan(15)
  })
  it('keeps the runtime pool when not building', () => {
    expect(withPoolSettings('postgresql://u:p@host:6543/postgres?pgbouncer=true', false)!).toContain('connection_limit=15')
  })
  it('passes a missing URL through', () => {
    expect(withPoolSettings(undefined)).toBeUndefined()
  })
})
