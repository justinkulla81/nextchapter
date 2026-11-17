import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/db/heavy', () => ({ sharedLoad: vi.fn() }))

import { isExpansionLead } from '@/lib/workforce/business-leads'

describe('expansion leads from headlines', () => {
  it('keeps openings, expansions and headquarters moves', () => {
    expect(isExpansionLead('Manufacturing company ABB announces second expansion in Selmer, pledges 227 new jobs')).toBe(true)
    expect(isExpansionLead('Fintech heavyweight Plaid to open Seattle office, with plans to grow')).toBe(true)
    expect(isExpansionLead('FM to move global HQ to downtown Providence, closing Johnston corporate campus')).toBe(true)
  })
  it('drops layoffs, closures and unrelated stories', () => {
    expect(isExpansionLead('Acme lays off 300 workers')).toBe(false)
    expect(isExpansionLead('Retailer closing 40 stores')).toBe(false)
    expect(isExpansionLead('MS Now’s Rachel Maddow wraps up book tour in Westbury')).toBe(false)
  })
})
