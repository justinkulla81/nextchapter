import { describe, expect, it } from 'vitest'
import { statusFromHunter } from '@/lib/mailing/verify-members'

describe('statusFromHunter', () => {
  it('reads Hunter verdicts the way the cold-outreach sender does', () => {
    expect(statusFromHunter('valid')).toBe('deliverable')
    expect(statusFromHunter('invalid')).toBe('invalid')
    expect(statusFromHunter('disposable')).toBe('invalid')
    expect(statusFromHunter('accept_all')).toBe('risky')
    expect(statusFromHunter('webmail')).toBe('risky')
    expect(statusFromHunter('unknown')).toBe('risky')
  })
})
