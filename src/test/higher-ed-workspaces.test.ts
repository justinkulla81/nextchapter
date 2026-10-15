import { describe, expect, it } from 'vitest'
import {
  ALL_TOKENS,
  DEMO_PERSONAS,
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
    [['INSTITUTION_ADMIN'], ['alumni', 'development', 'career', 'teaching', 'execed', 'admin']],
    [['COACH'], ['career']],
    [['FACULTY'], ['teaching', 'execed']],
    [['EXEC_ED'], ['teaching', 'execed']],
    [['ALUMNI_RELATIONS'], ['alumni']],
    [['DEVELOPMENT'], ['development']],
    [['CAREER_SERVICES'], ['career']],
    [['EMPLOYER_RELATIONS'], ['career']],
    [['VIEWER:development'], ['development']],
    [['MEMBER'], ['candidate']],
    [['EMPLOYER'], ['employer']],
    [['MEMBER', 'ALUMNI_RELATIONS'], ['candidate', 'alumni']],
    [[], []],
  ] as [AccessToken[], string[]][])('%j → %j', (tokens, expected) => {
    expect(workspacesFor(set(...tokens))).toEqual(expected)
  })

  it('never opens a V2 workspace, even with every token', () => {
    expect(workspacesFor(ALL_TOKENS)).toEqual(['candidate', 'alumni', 'development', 'career', 'teaching', 'execed', 'employer', 'admin'])
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
  it('Institution adds Teaching and Exec Ed', () => {
    expect(workspacesFor(ALL_TOKENS, 'INSTITUTION')).toEqual(['candidate', 'alumni', 'development', 'career', 'teaching', 'execed', 'employer', 'admin'])
  })
  it('the Workforce board appears only when the college turns WIOA on', () => {
    expect(workspacesFor(set('INSTITUTION_ADMIN'), 'INSTITUTION')).not.toContain('workforce')
    expect(workspacesFor(set('INSTITUTION_ADMIN'), 'INSTITUTION', { wioa: true })).toContain('workforce')
    expect(workspacesFor(set('WORKFORCE_PARTNER'), 'INSTITUTION', { wioa: true })).toEqual(['workforce'])
    expect(workspacesFor(set('WORKFORCE_PARTNER'), 'INSTITUTION')).toEqual([])
  })
  it('admins see what a higher tier would add', () => {
    expect(lockedWorkspacesFor(set('INSTITUTION_ADMIN'), 'ADVANCEMENT').map((w) => w.key)).toEqual(['teaching', 'execed'])
  })
})

describe('read-only and tabs', () => {
  it('VIEWER alone is read-only; a real role is not', () => {
    expect(isReadOnlyIn(set('VIEWER:alumni'), 'alumni')).toBe(true)
    expect(isReadOnlyIn(set('VIEWER:alumni', 'ALUMNI_RELATIONS'), 'alumni')).toBe(false)
  })

  it('Career Services tabs follow the role', () => {
    expect(tabsFor(set('EMPLOYER_RELATIONS'), 'career').map((t) => t.key)).toEqual(['jobs', 'companies', 'region', 'employers'])
    expect(tabsFor(set('CAREER_SERVICES'), 'career').map((t) => t.key)).toEqual(['home', 'coaching', 'jobs', 'companies', 'outcomes', 'checkins', 'students', 'circles', 'region', 'employers'])
    // A college's coach sees the caseload, coaching and circles, not jobs or companies.
    expect(tabsFor(set('COACH'), 'career').map((t) => t.key)).toEqual(['home', 'coaching', 'circles', 'region', 'employers'])
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
