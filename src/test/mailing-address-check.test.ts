import { describe, expect, it } from 'vitest'
import { addressVerdict } from '@/lib/mailing/address-check'

describe('addressVerdict', () => {
  it('sends to an address Hunter called deliverable, warm or cold', () => {
    for (const s of ['deliverable', 'valid', 'Deliverable ']) for (const cold of [true, false]) expect(addressVerdict(s, cold)).toBe('send')
  })
  it('never sends to an address Hunter called anything else', () => {
    for (const s of ['invalid', 'undeliverable', 'risky', 'disposable', 'accept_all', 'unknown']) for (const cold of [true, false]) expect(addressVerdict(s, cold)).toBe('skip')
  })
  it('checks a never-checked cold address first, and lets a never-checked warm one go', () => {
    expect(addressVerdict(null, true)).toBe('verify')
    expect(addressVerdict('', true)).toBe('verify')
    expect(addressVerdict(null, false)).toBe('send')
  })
})
