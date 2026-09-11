import { describe, it, expect } from 'vitest'
import {
  normalizeEmail, displayNameFrom, isAutomatedAddress, classifyParticipant,
  snippetOf, directionOf, type SweepContext,
} from '@/lib/crm/sync-matching'

const ctx: SweepContext = {
  selfEmails: new Set(['justin@nextchapter.com']),
  internalEmails: new Set(['acandidate@gmail.com', 'coach@coaching.com']),
  crmByEmail: new Map([['caribou@sempervirens.vc', 'per_1']]),
}

describe('normalizeEmail', () => {
  it('reads a bare address and a display-name form alike', () => {
    expect(normalizeEmail('Jane Doe <Jane@Example.com>')).toBe('jane@example.com')
    expect(normalizeEmail('  BOB@x.io ')).toBe('bob@x.io')
  })
  it('rejects anything that is not an address', () => {
    expect(normalizeEmail('not an email')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
  })
})

describe('displayNameFrom', () => {
  it('extracts a quoted or unquoted name', () => {
    expect(displayNameFrom('"Caribou Honig" <c@x.com>')).toBe('Caribou Honig')
    expect(displayNameFrom('Rick Robinson <r@aarp.org>')).toBe('Rick Robinson')
  })
  it('returns null when there is only an address', () => {
    expect(displayNameFrom('r@aarp.org')).toBeNull()
  })
})

describe('isAutomatedAddress', () => {
  it('catches machinery by local-part, prefix and domain', () => {
    for (const a of [
      'no-reply@anything.com', 'notifications@x.org', 'bounce-9931@x.com',
      'reply+abc123@x.com', 'billing@y.co', 'hi@mailchimp.com',
      'a3f9c1d2e4b6a8c0@x.com',
    ]) expect(isAutomatedAddress(a)).toBe(true)
  })
  it('leaves real people alone', () => {
    for (const a of ['caribou@sempervirens.vc', 'rick.robinson@aarp.org', 'yigal@jff.org'])
      expect(isAutomatedAddress(a)).toBe(false)
  })
})

describe('classifyParticipant', () => {
  it('never treats a candidate as a business contact', () => {
    // The safeguard that makes a full-mailbox sweep acceptable: candidate,
    // coach and recruiter mail is excluded from logging AND from suggestion.
    expect(classifyParticipant('acandidate@gmail.com', ctx)).toEqual({ kind: 'internal' })
    expect(classifyParticipant('coach@coaching.com', ctx)).toEqual({ kind: 'internal' })
  })
  it('recognises your own address', () => {
    expect(classifyParticipant('justin@nextchapter.com', ctx)).toEqual({ kind: 'self' })
  })
  it('matches a CRM person', () => {
    expect(classifyParticipant('caribou@sempervirens.vc', ctx)).toEqual({ kind: 'crm', personId: 'per_1' })
  })
  it('marks an unknown human as a suggestion candidate, not a contact', () => {
    expect(classifyParticipant('someone@newfund.vc', ctx)).toEqual({ kind: 'unknown' })
  })
  it('puts automated mail ahead of "unknown" so it is never suggested', () => {
    expect(classifyParticipant('no-reply@newfund.vc', ctx)).toEqual({ kind: 'automated' })
  })
})

describe('snippetOf', () => {
  it('collapses whitespace and truncates at 200 characters', () => {
    expect(snippetOf('  hello   there  ')).toBe('hello there')
    const long = snippetOf('x'.repeat(400))
    expect(long).toHaveLength(200)
    expect(long?.endsWith('…')).toBe(true)
  })
  it('returns null for empty content rather than an empty string', () => {
    expect(snippetOf('   ')).toBeNull()
    expect(snippetOf(null)).toBeNull()
  })
})

describe('directionOf', () => {
  it('is outbound only when you sent it', () => {
    expect(directionOf('justin@nextchapter.com', ctx)).toBe('OUTBOUND')
    expect(directionOf('caribou@sempervirens.vc', ctx)).toBe('INBOUND')
    expect(directionOf(null, ctx)).toBe('INBOUND')
  })
})

describe('canonicalGmail', () => {
  it('collapses dots and plus-aliases on gmail only', async () => {
    const { canonicalGmail } = await import('@/lib/crm/sync-matching')
    expect(canonicalGmail('justin.kulla+3@gmail.com')).toBe('justinkulla@gmail.com')
    expect(canonicalGmail('justinkulla@gmail.com')).toBe('justinkulla@gmail.com')
    expect(canonicalGmail('a.b@googlemail.com')).toBe('ab@gmail.com')
  })
  it('leaves other providers alone, where dots are significant', async () => {
    const { canonicalGmail } = await import('@/lib/crm/sync-matching')
    expect(canonicalGmail('first.last@company.com')).toBe('first.last@company.com')
  })
})

describe('self-detection with gmail aliasing', () => {
  it('treats a plus-alias of your own address as you', async () => {
    const { directionOf, classifyParticipant } = await import('@/lib/crm/sync-matching')
    const g = { selfEmails: new Set(['justin.kulla@gmail.com']), internalEmails: new Set<string>(), crmByEmail: new Map<string, string>() }
    // Getting this wrong flips a sent message to INBOUND and corrupts reply detection.
    expect(directionOf('justinkulla+notes@gmail.com', g)).toBe('OUTBOUND')
    expect(classifyParticipant('justin.kulla@gmail.com', g)).toEqual({ kind: 'self' })
  })
})
