import { describe, expect, it } from 'vitest'
import { auditPortalOf, getWorkspace } from '@/lib/higher-ed/workspaces'
import { describeAuditAction } from '@/lib/partners/audit-labels'

describe('activity log for colleges and workforce organizations', () => {
  it('keeps colleges and workforce organizations in their own trail', () => {
    expect(auditPortalOf('COLLEGE')).toBe('HIGHER_ED')
    expect(auditPortalOf(null)).toBe('HIGHER_ED')
    expect(auditPortalOf('WORKFORCE_BOARD')).toBe('WORKFORCE')
    expect(auditPortalOf('CHAMBER')).toBe('WORKFORCE')
  })
  it('names every action the portal records in plain words', () => {
    for (const a of ['team.invited', 'team.removed', 'team.invite_resent', 'brand.updated', 'export.updates', 'export.suppression', 'export.etpl', 'export.wioa', 'export.member_data']) {
      expect(describeAuditAction(a)).not.toMatch(/^[A-Z][a-z]+: /)
    }
  })
  it('puts Activity in Admin next to Staff', () => {
    const keys = getWorkspace('admin')!.tabs.map((t) => t.key)
    expect(keys.indexOf('activity')).toBe(keys.indexOf('users') + 1)
  })
})
