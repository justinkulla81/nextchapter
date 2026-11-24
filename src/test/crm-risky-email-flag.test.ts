import { describe, expect, it } from 'vitest'
import { isUnsendable } from '@/components/admin/CrmEmailRiskFlag'

describe('risky addresses are kept but never emailed (owner, 2026-11-24)', () => {
  it('flags every verdict that is not deliverable', () => {
    for (const s of ['risky', 'accept_all', 'unknown', 'invalid', 'undeliverable', 'Risky']) expect(isUnsendable(s), s).toBe(true)
  })
  it('does not flag deliverable or never-checked addresses', () => {
    for (const s of ['deliverable', 'valid', null, undefined, '']) expect(isUnsendable(s), String(s)).toBe(false)
  })
})
