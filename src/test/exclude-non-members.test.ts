import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { EXCLUDE_NON_MEMBERS, EXCLUDE_SYSTEM_ACCOUNT } from '@/lib/admin/system-account-filter'

// The demo generators create hundreds of fictional profiles at once (538 in Oct-Nov 2026 against 78 real members).
// Every member count spreads this filter, so it must keep both exclusions.
describe('member count filter', () => {
  it('excludes the system account and sample data', () => {
    expect(EXCLUDE_NON_MEMBERS).toEqual({ isSystemAccount: false, isSampleData: false })
  })
  it('keeps the older name pointing at the same filter', () => {
    expect(EXCLUDE_SYSTEM_ACCOUNT).toBe(EXCLUDE_NON_MEMBERS)
  })
})
