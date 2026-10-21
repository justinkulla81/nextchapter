import { describe, expect, it } from 'vitest'
import { APPLY_ROLES, OTHER_ROLE, validateApplication } from '@/lib/careers/application'

const base = { email: 'ada@example.org', roleSlug: 'editorial-lead', note: '' }

describe('validateApplication', () => {
  it('accepts a listed role and fills in its title', () => {
    expect(validateApplication(base)).toEqual({
      ok: { email: 'ada@example.org', roleSlug: 'editorial-lead', roleTitle: 'Editorial lead', note: null },
    })
  })

  it('trims, and drops a note on a listed role', () => {
    const r = validateApplication({ ...base, email: ' ada@example.org ', note: 'ignored' })
    expect('ok' in r && r.ok.email).toBe('ada@example.org')
    expect('ok' in r && r.ok.note).toBeNull()
  })

  it('needs a plausible email', () => {
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
    expect(r).toEqual({ ok: { email: 'ada@example.org', roleSlug: null, roleTitle: 'Not listed', note: 'Run events' } })
  })

  it('lists only jobs to apply to', () => {
    expect(APPLY_ROLES.length).toBeGreaterThan(0)
    expect(APPLY_ROLES.every((r) => r.kind !== 'platform')).toBe(true)
  })
})
