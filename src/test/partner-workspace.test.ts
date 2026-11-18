import { describe, expect, it } from 'vitest'
import { ALL_TOKENS, DEMO_PERSONAS, getWorkspace, tabsFor, workspacesFor, type AccessToken } from '@/lib/higher-ed/workspaces'

const t = (...x: AccessToken[]) => new Set<AccessToken>(x)

describe('the partner workspace', () => {
  it('opens only for a person at a confirmed partner, on a workforce organization', () => {
    expect(workspacesFor(t('PARTNER'), undefined, {}, 'workforce')).toEqual(['partnerview'])
    expect(workspacesFor(t('PARTNER'), undefined, {}, 'college')).not.toContain('partnerview')
  })
  it('staff and member companies do not get it, and a partner gets no staff area', () => {
    expect(workspacesFor(t('INSTITUTION_ADMIN'), undefined, {}, 'workforce')).not.toContain('partnerview')
    expect(workspacesFor(t('EMPLOYER'), undefined, {}, 'workforce')).not.toContain('partnerview')
    const mine = workspacesFor(t('PARTNER'), undefined, {}, 'workforce')
    expect(mine).not.toContain('hub')
    expect(mine).not.toContain('admin')
  })
  it('has its pages (including the feed), and a demo can preview it', () => {
    expect(tabsFor(t('PARTNER'), 'partnerview', undefined, 'workforce').map((x) => x.key)).toEqual(['overview', 'shared', 'feed'])
    expect(getWorkspace('partnerview')?.homePath).toBe('partnerview')
    expect(ALL_TOKENS.has('PARTNER')).toBe(true)
    expect(DEMO_PERSONAS.some((p) => p.key === 'PARTNER')).toBe(true)
  })
})
