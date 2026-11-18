import { describe, expect, it } from 'vitest'
import {
  ALL_TOKENS,
  DEMO_PERSONAS,
  demoPersonasFor,
  employerCan,
  demoPersonaTokens,
  isReadOnlyIn,
  tabsFor,
  workspacesFor,
  lockedWorkspacesFor,
  WORKSPACES,
  type AccessToken,
} from '@/lib/higher-ed/workspaces'
import { readableTextOn, initials } from '@/lib/higher-ed/branding'

const set = (...t: AccessToken[]) => new Set<AccessToken>(t)

describe('workspacesFor (spec §2/§4: each role sees exactly its workspaces)', () => {
  it.each([
    [['INSTITUTION_ADMIN'], ['alumni', 'development', 'career', 'ventures', 'teaching', 'execed', 'academic', 'admin']],
    [['ACADEMIC_AFFAIRS'], ['academic']],
    [['VIEWER:academic'], ['academic']],
    [['COACH'], ['career']],
    [['FACULTY'], ['teaching', 'execed']],
    [['EXEC_ED'], ['ventures', 'teaching', 'execed']],
    [['ENTREPRENEURSHIP'], ['ventures']],
    [['ALUMNI_RELATIONS'], ['alumni', 'ventures']],
    [['DEVELOPMENT'], ['development', 'ventures']],
    [['CAREER_SERVICES'], ['career', 'ventures']],
    [['EMPLOYER_RELATIONS'], ['career']],
    [['VIEWER:development'], ['development']],
    [['MEMBER'], ['candidate']],
    [['EMPLOYER'], ['employer']],
    [['MEMBER', 'ALUMNI_RELATIONS'], ['candidate', 'alumni', 'ventures']],
    [[], []],
  ] as [AccessToken[], string[]][])('%j → %j', (tokens, expected) => {
    expect(workspacesFor(set(...tokens))).toEqual(expected)
  })

  it('never opens a V2 workspace, even with every token', () => {
    expect(workspacesFor(ALL_TOKENS)).toEqual(['candidate', 'alumni', 'development', 'career', 'ventures', 'teaching', 'execed', 'academic', 'employer', 'admin'])
  })

  it('opens Academic Affairs only on the Institution tier', () => {
    expect(workspacesFor(set('ACADEMIC_AFFAIRS'), 'ADVANCEMENT')).toEqual([])
    expect(workspacesFor(set('ACADEMIC_AFFAIRS'), 'INSTITUTION')).toEqual(['academic'])
  })

  it('a VIEWER seat for another workspace opens nothing', () => {
    expect(workspacesFor(set('VIEWER:settings' as AccessToken))).toEqual([])
  })
})

describe('license tiers (product design, Packaging)', () => {
  it('Career has no Development, Teaching or Exec Ed', () => {
    expect(workspacesFor(ALL_TOKENS, 'CAREER')).toEqual(['candidate', 'alumni', 'career', 'employer', 'admin'])
  })
  it('Advancement adds Development', () => {
    expect(workspacesFor(ALL_TOKENS, 'ADVANCEMENT')).toEqual(['candidate', 'alumni', 'development', 'career', 'employer', 'admin'])
  })
  it('Institution adds Teaching, Exec Ed and Academic Affairs', () => {
    expect(workspacesFor(ALL_TOKENS, 'INSTITUTION')).toEqual(['candidate', 'alumni', 'development', 'career', 'ventures', 'teaching', 'execed', 'academic', 'employer', 'admin'])
  })
  it('the Workforce board appears only when the college turns WIOA on', () => {
    expect(workspacesFor(set('INSTITUTION_ADMIN'), 'INSTITUTION')).not.toContain('workforce')
    expect(workspacesFor(set('INSTITUTION_ADMIN'), 'INSTITUTION', { wioa: true })).toContain('workforce')
    expect(workspacesFor(set('WORKFORCE_PARTNER'), 'INSTITUTION', { wioa: true })).toEqual(['workforce'])
    expect(workspacesFor(set('WORKFORCE_PARTNER'), 'INSTITUTION')).toEqual([])
  })
  it('admins see what a higher tier would add', () => {
    expect(lockedWorkspacesFor(set('INSTITUTION_ADMIN'), 'ADVANCEMENT').map((w) => w.key)).toEqual(['ventures', 'teaching', 'execed', 'academic'])
  })
})

describe('read-only and tabs', () => {
  it('VIEWER alone is read-only; a real role is not', () => {
    expect(isReadOnlyIn(set('VIEWER:alumni'), 'alumni')).toBe(true)
    expect(isReadOnlyIn(set('VIEWER:alumni', 'ALUMNI_RELATIONS'), 'alumni')).toBe(false)
  })

  it('Career Services tabs follow the role', () => {
    expect(tabsFor(set('EMPLOYER_RELATIONS'), 'career').map((t) => t.key)).toEqual(['jobs', 'companies', 'recruiting', 'region', 'employers'])
    expect(tabsFor(set('CAREER_SERVICES'), 'career').map((t) => t.key)).toEqual(['home', 'coaching', 'jobs', 'companies', 'recruiting', 'outcomes', 'bridge', 'checkins', 'students', 'internships', 'circles', 'region', 'employers'])
    // A college's coach sees the caseload, coaching and circles, not jobs or companies.
    expect(tabsFor(set('COACH'), 'career').map((t) => t.key)).toEqual(['home', 'coaching', 'internships', 'circles', 'region', 'employers'])
    // Alumni Relations can post alumni jobs but not manage target companies (permissions.ts).
    expect(tabsFor(set('ALUMNI_RELATIONS'), 'alumni').map((t) => t.key)).toContain('jobs')
    expect(tabsFor(set('VIEWER:alumni'), 'alumni').map((t) => t.key)).not.toContain('jobs')
  })
})

describe('demo personas', () => {
  it('each single-role persona maps to exactly that role', () => {
    for (const p of DEMO_PERSONAS.filter((p) => p.key !== 'all')) {
      expect([...demoPersonaTokens(p.key)]).toEqual([p.key])
    }
  })
  it('a workforce portal offers workforce roles, not college ones', () => {
    const keys = demoPersonasFor('workforce', 'INSTITUTION').map((p) => p.key)
    expect(keys).toEqual(['all', 'INSTITUTION_ADMIN', 'CAREER_SERVICES', 'EMPLOYER_RELATIONS', 'WORKFORCE_PARTNER', 'MEMBER', 'EMPLOYER', 'EMPLOYER:hiring', 'EMPLOYER:outplacement', 'EMPLOYER:learning', 'EMPLOYER:grants', 'EMPLOYER:workforce', 'EMPLOYER:colleges'])
    expect(keys).not.toContain('EXEC_ED')
    expect(keys).not.toContain('FACULTY')
    expect(demoPersonasFor('college', 'INSTITUTION').map((p) => p.key)).toContain('EXEC_ED')
    expect(demoPersonasFor('college', 'INSTITUTION').map((p) => p.key)).not.toContain('EMPLOYER:hiring')
  })
  it('a member company contact sees only the tabs for their role', () => {
    const tabs = (t: AccessToken[]) => tabsFor(new Set<AccessToken>(t), 'employer', undefined, 'workforce').map((x) => x.key)
    expect(tabs(['EMPLOYER'])).toEqual(['overview', 'home', 'page', 'support', 'training', 'grants', 'workforce', 'colleges'])
    expect(tabs(['EMPLOYER:workforce'])).toEqual(['overview', 'workforce'])
    expect(tabs(['EMPLOYER:colleges'])).toEqual(['overview', 'colleges'])
    expect(tabs(['EMPLOYER:learning'])).toEqual(['overview', 'training'])
    expect(tabs(['EMPLOYER:grants'])).toEqual(['overview', 'grants'])
    expect(tabs(['EMPLOYER:hiring'])).toEqual(['overview', 'home', 'page'])
    expect(tabs(['EMPLOYER:outplacement'])).toEqual(['overview', 'support'])
    expect(workspacesFor(new Set<AccessToken>(['EMPLOYER:outplacement']), undefined, {}, 'workforce')).toEqual(['employer'])
    expect(employerCan(new Set<AccessToken>(['EMPLOYER:outplacement']), 'hiring')).toBe(false)
    expect(employerCan(new Set<AccessToken>(['EMPLOYER']), 'hiring')).toBe(true)
  })
  it('an unknown persona falls back to everything', () => {
    expect(demoPersonaTokens('nope')).toEqual(demoPersonaTokens('all'))
  })
})

describe('config is data-driven (spec §13)', () => {
  it('has unique keys and V2 entries with no roles', () => {
    expect(new Set(WORKSPACES.map((w) => w.key)).size).toBe(WORKSPACES.length)
    for (const w of WORKSPACES.filter((w) => w.release === 'V2')) expect(w.requiredRoles).toEqual([])
  })
})

describe('branding', () => {
  it('picks readable text for the accent', () => {
    expect(readableTextOn('#1F4E79')).toBe('#ffffff')
    expect(readableTextOn('#F5D547')).toBe('#0a0a0a')
    expect(readableTextOn('not a color')).toBe('#ffffff')
  })
  it('makes a two-letter monogram', () => {
    expect(initials('Washington & Jefferson College')).toBe('WJ')
    expect(initials('Demo College')).toBe('DC')
  })
})
