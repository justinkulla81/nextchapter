import { describe, expect, it } from 'vitest'
import { parseScope, scopeQ } from '@/lib/leads/alert-scope'
import { searchLabel } from '@/lib/leads/job-alerts'

describe('alert scope', () => {
  it('writes and reads a function scope like the others', () => {
    expect(scopeQ('function', ' Finance ')).toBe('function:Finance')
    expect(parseScope('function:finance')).toEqual({ kind: 'function', value: 'finance' })
  })
  it('keeps plain words and unknown prefixes as plain search words', () => {
    expect(parseScope('finance manager')).toBeNull()
    expect(parseScope('skill:python')).toBeNull()
  })
  it('labels a function alert as "<function> jobs"', () => {
    expect(searchLabel({ searchQ: 'function:finance', searchLoc: '', searchRemote: false })).toBe('finance jobs')
  })
})
