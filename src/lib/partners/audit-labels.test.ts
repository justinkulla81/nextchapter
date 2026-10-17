import { describe, expect, it } from 'vitest'
import { describeAuditAction } from './audit-labels'

describe('describeAuditAction', () => {
  it('names known actions in plain words', () => {
    expect(describeAuditAction('export.roster')).toBe('Downloaded the roster')
    expect(describeAuditAction('brand.updated')).toMatch(/brand/)
  })
  it('still reads sensibly for an unknown action', () => {
    expect(describeAuditAction('export.some_new_thing')).toBe('Export: some new thing')
    expect(describeAuditAction('plain')).toBe('plain')
  })
})
