import { describe, expect, it } from 'vitest'
import { APPLY_ROLES, OTHER_ROLE, splitName, validateApplication } from '@/lib/careers/application'

const base = { fullName: 'Ada Lovelace', email: 'ada@example.org', roleSlug: 'editorial-lead', note: '' }

describe('validateApplication', () => {
  it('accepts a listed role and fills in its title', () => {
    expect(validateApplication(base)).toEqual({
      ok: { fullName: 'Ada Lovelace', email: 'ada@example.org', roleSlug: 'editorial-lead', roleTitle: 'Editorial lead', note: null },
    })
  })

  it('trims, and drops a note on a listed role', () => {
    const r = validateApplication({ ...base, fullName: '  Ada  ', email: ' ada@example.org ', note: 'ignored' })
    expect('ok' in r && r.ok.fullName).toBe('Ada')
    expect('ok' in r && r.ok.note).toBeNull()
  })

  it('needs a name and a plausible email', () => {
    expect(validateApplication({ ...base, fullName: ' ' })).toEqual({ error: 'Enter your name.' })
    expect(validateApplication({ ...base, email: 'nope' })).toEqual({ error: 'Enter a valid email.' })
  })

  it('rejects a role that is not on the list, and the platform listings', () => {
    expect('error' in validateApplication({ ...base, roleSlug: 'ceo' })).toBe(true)
    expect('error' in validateApplication({ ...base, roleSlug: 'coach' })).toBe(true)
    expect('error' in validateApplication({ ...base, roleSlug: '' })).toBe(true)
  })

  it('asks what the person would do when the role is not listed', () => {
    expect(validateApplication({ ...base, roleSlug: OTHER_ROLE })).toEqual({ error: 'Tell us what you would do at NextChapter.' })
    const r = validateApplication({ ...base, roleSlug: OTHER_ROLE, note: ' Run events ' })
    expect(r).toEqual({ ok: { fullName: 'Ada Lovelace', email: 'ada@example.org', roleSlug: null, roleTitle: 'Not listed', note: 'Run events' } })
  })

  it('lists only jobs to apply to', () => {
    expect(APPLY_ROLES.length).toBeGreaterThan(0)
    expect(APPLY_ROLES.every((r) => r.kind !== 'platform')).toBe(true)
  })
})

describe('splitName', () => {
  it('splits first and last', () => {
    expect(splitName('Ada Lovelace')).toEqual({ first: 'Ada', last: 'Lovelace' })
    expect(splitName('Ada King Lovelace')).toEqual({ first: 'Ada', last: 'King Lovelace' })
    expect(splitName('Ada')).toEqual({ first: 'Ada', last: '' })
  })
})
