import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { aggregateCulture, type CultureResponseRow } from '@/lib/companies/culture-aggregate'
import { cleanCultureAnswers, cleanCulturePreferences, CULTURE_DIMENSIONS, CULTURE_MIN_RESPONDENTS } from '@/lib/companies/culture-survey'
import { matchJobToCandidate, compareInsiderCulture, type MatchCandidate, type MatchJob } from '@/lib/jobs/job-match'

const row = (candidateId: string, answers: Record<string, number | null>, excluded = false): CultureResponseRow => ({ candidateId, answers, excluded })

describe('culture aggregation — privacy floor', () => {
  it('shows nothing below 3 respondents, but reports the count for "N of 3"', () => {
    const p = aggregateCulture('co', [row('a', { pace: 3 }), row('b', { pace: 3 })], null)
    expect(CULTURE_MIN_RESPONDENTS).toBe(3)
    expect(p.shown).toBe(false)
    expect(p.respondentCount).toBe(2)
    expect(p.dimensions).toEqual([])
  })

  it('shows shares at 3 respondents', () => {
    const p = aggregateCulture('co', [row('a', { pace: 3 }), row('b', { pace: 3 }), row('c', { pace: 1 })], null)
    expect(p.shown).toBe(true)
    expect(p.respondentCount).toBe(3)
    expect(p.dimensions).toHaveLength(1)
    expect(p.dimensions[0]).toMatchObject({ key: 'pace', answered: 3, shares: [33, 0, 67], typical: 3 })
  })

  it("drops the viewer's own answer, so a respondent can't subtract theirs to read the others", () => {
    const rows = [row('a', { pace: 3 }), row('b', { pace: 3 }), row('viewer', { pace: 1 })]
    const forViewer = aggregateCulture('co', rows, 'viewer')
    expect(forViewer.shown).toBe(false)
    expect(forViewer.respondentCount).toBe(2)
    expect(aggregateCulture('co', rows, 'someone-else').shown).toBe(true)
  })

  it('never counts excluded members (Confidential Search Mode / STEALTH / system / sample)', () => {
    const p = aggregateCulture('co', [row('a', { pace: 1 }), row('b', { pace: 1 }), row('stealth', { pace: 3 }, true)], null)
    expect(p.shown).toBe(false)
    expect(p.respondentCount).toBe(2)
  })

  it('leaves out a question fewer than 3 people answered, even when the profile is shown', () => {
    const p = aggregateCulture('co', [row('a', { pace: 1, growth: 1 }), row('b', { pace: 2 }), row('c', { pace: 2 })], null)
    expect(p.shown).toBe(true)
    expect(p.dimensions.map((d) => d.key)).toEqual(['pace'])
  })

  it('carries no respondent ids or per-person answers in its output', () => {
    const p = aggregateCulture('co', [row('alice', { pace: 1, decisions: 1 }), row('bob', { pace: 2, decisions: 1 }), row('carol', { pace: 3, decisions: 3 })], null)
    const json = JSON.stringify(p)
    for (const id of ['alice', 'bob', 'carol']) expect(json).not.toContain(id)
    for (const d of p.dimensions) expect(Object.keys(d).sort()).toEqual(['answered', 'key', 'mean', 'shares', 'typical'])
  })

  it('ignores invalid values and empty responses', () => {
    const p = aggregateCulture('co', [row('a', { pace: 9 }), row('b', {}), row('c', { pace: 2 }), row('d', { pace: 2 })], null)
    expect(p.respondentCount).toBe(2)
    expect(cleanCultureAnswers({ pace: 2, structure: 0, bogus: 1, growth: '3' })).toEqual({ pace: 2 })
    expect(cleanCulturePreferences({ pace: 0, remoteReality: 1, mission: 3 })).toEqual({ pace: 0, mission: 3 })
  })

  it('marks a split question as having no typical answer', () => {
    const p = aggregateCulture('co', [row('a', { pace: 1 }), row('b', { pace: 2 }), row('c', { pace: 3 })], null)
    expect(p.dimensions[0].typical).toBeNull()
    expect(p.dimensions[0].shares.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('every question has 3 options (adjacent buttons)', () => {
    for (const d of CULTURE_DIMENSIONS) {
      expect(d.options).toHaveLength(3)
      if (d.prefOptions) expect(d.prefOptions).toHaveLength(3)
    }
  })
})

describe('culture in the per-job match', () => {
  const blank = {
    resumeKeywords: [], confirmedSkillsHave: [], certifications: [], yearsExperience: null, hasJD: false, hasMD: false, hasDO: false,
    isPeopleManager: null, teamSizeManaged: null, targetCompanySize: null, targetCompanyStage: null, priorityMission: null,
    priorityWorkLife: null, priorityJobSecurity: null, priorityBrandName: null, equityImportant: false, targetCompMin: 150_000,
    compFlexible: false, lastSalary: null, targetRoleType: 'Director of Operations', targetFunction: null, primaryFunction: 'Operations',
    secondaryFunction: null, targetIndustries: [], industryContext: null, isPivoting: false, highestLevelReached: 'Director',
    levelRankScore: null, willingToStartLower: false, remotePreference: null, currentCity: null, currentState: null,
    openToRelocation: false, travelWillingness: false, interimConsultingInterest: false,
  } satisfies MatchCandidate
  const job: MatchJob = {
    title: 'Director of Operations', description: 'Lead operations.', skills: [], location: null, level: 'DIRECTOR', industry: null,
    salaryMin: 160_000, salaryMax: 190_000, marketPayLow: null, marketPayMid: null, marketPayHigh: null, targetFunction: null,
    targetLevel: null, targetRemotePolicy: null,
  }
  const intense = aggregateCulture(
    'co',
    [row('a', { pace: 3, decisions: 1 }), row('b', { pace: 3, decisions: 1 }), row('c', { pace: 3, decisions: 1 }), row('d', { pace: 2, decisions: 2 })],
    null
  )

  it('compares preferences with what insiders said, with counts and a constructive gap', () => {
    const m = matchJobToCandidate({ ...blank, culturePrefs: { pace: 1, decisions: 3 } }, { ...job, insiderCulture: intense })
    expect(m.dimensions.culture.status).toBe('gap')
    expect(m.dimensions.culture.evidence[0]).toMatch(/^4 members who worked here describe (the pace as intense; you prefer steady|decisions as top-down; you prefer collaborative decisions)$/)
    expect(m.gaps.some((g) => g.includes('describe decisions as top-down') && g.includes('ask how this team makes decisions'))).toBe(true)
  })

  it('reads a fit as a fit', () => {
    const m = matchJobToCandidate({ ...blank, culturePrefs: { pace: 3, decisions: 1 } }, { ...job, insiderCulture: intense })
    expect(m.dimensions.culture.status).toBe('strong')
    expect(m.dimensions.culture.evidence[0]).toContain('which fits what you want')
  })

  it('treats "no preference" (0) as not compared', () => {
    expect(compareInsiderCulture({ ...blank, culturePrefs: { pace: 0, decisions: 0 } }, intense)).toBeNull()
  })

  it('uses the profile remote preference against where work really happens', () => {
    const office = aggregateCulture('co', ['a', 'b', 'c'].map((id) => row(id, { remoteReality: 3 })), null)
    const cmp = compareInsiderCulture({ ...blank, remotePreference: 'remote' }, office)
    expect(cmp?.evidence[0]).toBe('3 members who worked here describe where work really happens as mostly in the office; you prefer remote')
    // atMost: an on-site person at a remote company is not a gap
    const remote = aggregateCulture('co', ['a', 'b', 'c'].map((id) => row(id, { remoteReality: 1 })), null)
    expect(compareInsiderCulture({ ...blank, remotePreference: 'onsite' }, remote)?.score).toBe(100)
  })

  it('falls back to posting signals below the privacy floor', () => {
    const thin = aggregateCulture('co', [row('a', { pace: 3 }), row('b', { pace: 3 })], null)
    const m = matchJobToCandidate({ ...blank, culturePrefs: { pace: 1 } }, { ...job, insiderCulture: thin })
    expect(m.dimensions.culture.evidence.join(' ')).not.toContain('members who worked here')
  })

  it('without preferences, summarizes insiders and links to add preferences', () => {
    const m = matchJobToCandidate(blank, { ...job, insiderCulture: intense })
    expect(m.dimensions.culture.evidence[0]).toContain('4 members who worked here describe it as: pace intense')
    expect(m.dimensions.culture.profilePrompt?.href).toBe('/dashboard/search-strategy#culture-preferences')
  })

  it('weights culture more when it rests on insider data', () => {
    // Same culture score, different evidence source: the insider-based one moves the overall more.
    const prefs = { pace: 1 as const, decisions: 3 as const }
    const withInsiders = matchJobToCandidate({ ...blank, culturePrefs: prefs }, { ...job, insiderCulture: intense })
    const without = matchJobToCandidate({ ...blank, culturePrefs: prefs }, job)
    expect(without.dimensions.culture.score).toBeNull()
    expect(withInsiders.overallScore!).toBeLessThan(
      matchJobToCandidate({ ...blank, culturePrefs: { pace: 3, decisions: 1 } }, { ...job, insiderCulture: intense }).overallScore!
    )
  })

  it('coach-only fields stay out of the culture match', () => {
    const src = readFileSync(join(__dirname, '..', 'lib', 'jobs', 'job-match.ts'), 'utf8')
    for (const f of ['dealBreakers', 'motivations', 'changePacePreference']) expect(src).not.toContain(f)
  })
})

describe('CompanyCultureResponse is read only through the aggregate', () => {
  const ROOT = join(__dirname, '..', '..')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name)
      if (name === 'node_modules' || name.startsWith('.')) return []
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : []
    })
  it('only culture-profile.ts touches prisma.companyCultureResponse', () => {
    const offenders = walk(join(ROOT, 'src'))
      .filter((f) => /\.companyCultureResponse\b/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f))
      .filter((f) => f !== 'src/lib/companies/culture-profile.ts' && !f.startsWith('src/test/'))
    expect(offenders).toEqual([])
  })
})
