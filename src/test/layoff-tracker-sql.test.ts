import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { TRACKER_KEPT_CTES } from '@/lib/warn/public-tracker'

describe('the layoff tracker rows (TRACKER_KEPT_CTES)', () => {
  const sql = TRACKER_KEPT_CTES.sql.replace(/--[^\n]*/g, '')

  it('finds same-employer notices within 45 days with one join, not a scan of the CTE per notice', () => {
    expect(sql).toMatch(/near AS \(\s*SELECT b\.id, bool_or\(o\.reported\) AS has_reported, bool_or\(NOT o\.reported\) AS has_filing/)
    expect(sql).not.toMatch(/SELECT 1 FROM base/) // a correlated EXISTS over the CTE: ~16M comparisons, 4-6 s a call (2026-11-17)
  })

  it('keeps the rules: a reported layoff only with no filing nearby, and a filing marked when a report or story agrees', () => {
    expect(sql).toContain('WHERE NOT b.reported OR NOT COALESCE(n.has_filing, false)')
    expect(sql).toContain('(NOT b.reported AND (COALESCE(n.has_reported, false) OR EXISTS (')
    expect(sql).toContain('FROM "LayoffNewsMention" m')
  })
})
