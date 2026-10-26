import { describe, expect, it } from 'vitest'
import { withPoolLimits } from '@/lib/db-pool-url'

describe('withPoolLimits', () => {
  it('adds the pool size and wait when the URL has none', () => {
    expect(withPoolLimits('postgresql://u:p%40ss@host:6543/db?pgbouncer=true')).toBe('postgresql://u:p%40ss@host:6543/db?pgbouncer=true&connection_limit=12&pool_timeout=20')
  })
  it('starts the query string when there is none', () => {
    expect(withPoolLimits('postgresql://u:p@host/db')).toBe('postgresql://u:p@host/db?connection_limit=12&pool_timeout=20')
  })
  it('raises a smaller limit and keeps a larger one', () => {
    expect(withPoolLimits('postgresql://h/db?connection_limit=5&pool_timeout=10')).toBe('postgresql://h/db?connection_limit=12&pool_timeout=20')
    expect(withPoolLimits('postgresql://h/db?connection_limit=30&pool_timeout=60')).toBe('postgresql://h/db?connection_limit=30&pool_timeout=60')
  })
  it('leaves the password untouched and returns undefined for no URL', () => {
    expect(withPoolLimits('postgresql://u:a%2Fb%3Dc@h/db')).toContain('u:a%2Fb%3Dc@h')
    expect(withPoolLimits(undefined)).toBeUndefined()
  })
})
