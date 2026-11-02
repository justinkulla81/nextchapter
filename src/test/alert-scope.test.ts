import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/email/resend-client', () => ({ createResend: vi.fn(), isUndeliverableAddress: () => false }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@/lib/jobs/public-board', () => ({ searchPublicBoard: vi.fn() }))

import { parseScope, scopeQ } from '@/lib/leads/alert-scope'
import { searchLabel } from '@/lib/leads/job-alerts'
import { industryRawValues } from '@/lib/seo/topics'

describe('alert scope', () => {
  it('round-trips company, title and industry', () => {
    expect(parseScope(scopeQ('company', 'Acme Corp'))).toEqual({ kind: 'company', value: 'Acme Corp' })
    expect(parseScope(scopeQ('industry', 'Healthcare & Hospital Systems'))?.kind).toBe('industry')
  })
  it('leaves plain search words alone', () => {
    expect(parseScope('marketing manager')).toBeNull()
    expect(parseScope('company:')).toBeNull()
  })
  it('labels a scoped alert in plain words', () => {
    expect(searchLabel({ searchQ: 'company:Acme', searchLoc: '', searchRemote: false })).toBe('jobs at Acme')
    expect(searchLabel({ searchQ: 'title:data analyst', searchLoc: '', searchRemote: false })).toBe('data analyst jobs')
  })
  it('finds the crawler codes behind an industry bucket', () => {
    expect(industryRawValues('Healthcare & Hospital Systems')).toContain('healthcare')
  })
})
