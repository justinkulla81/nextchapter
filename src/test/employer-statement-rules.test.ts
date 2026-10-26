import { describe, expect, it } from 'vitest'
import { STATEMENT_MAX, checkStatementText } from '@/lib/employer-statements/rules'

const good = 'We are sorry to the 120 colleagues affected. Everyone receives severance and 90 days of benefits.'

describe('checkStatementText', () => {
  it('accepts a plain statement and collapses whitespace', () => {
    expect(checkStatementText(`  ${good}\n\n`)).toEqual({ ok: true, text: good })
  })
  it('rejects text that is too short or too long', () => {
    expect(checkStatementText('Sorry.').ok).toBe(false)
    expect(checkStatementText('x'.repeat(STATEMENT_MAX + 1)).ok).toBe(false)
    expect(checkStatementText('x'.repeat(STATEMENT_MAX)).ok).toBe(true)
  })
  it('rejects links, email addresses and markup', () => {
    expect(checkStatementText(`${good} See https://example.com/more`).ok).toBe(false)
    expect(checkStatementText(`${good} Visit acme.com for help`).ok).toBe(false)
    expect(checkStatementText(`${good} Write to hr@acme.com`).ok).toBe(false)
    expect(checkStatementText(`${good} <b>bold</b>`).ok).toBe(false)
  })
})
