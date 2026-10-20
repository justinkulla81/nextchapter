import { describe, expect, it } from 'vitest'
import {
  BASIS_WEIGHT,
  buildSnapshot,
  censusRegion,
  inferredAsks,
  matchAsks,
  occupationAsksFromPostings,
  postingAsks,
  shouldReplaceSnapshot,
  skillsHash,
  MIN_OCCUPATION_POSTINGS,
} from '@/lib/applications/skill-snapshot'
import { bestMatchLine, summarizeApplications, topAskedGaps, weeklyTrend, weightedMatch, type SnapshotRow } from '@/lib/applications/skill-gap-summary'
import { rankSkillRecommendations } from '@/lib/applications/skill-recommend'
import { aggregateBy, buildSkillMatchReport, pitchGapLine, skillMatchCsv, type AggregateRow } from '@/lib/applications/skill-match-aggregate'
import { courseForSkill } from '@/lib/applications/skill-course'
import { applicationGapCourseItems } from '@/lib/redesign/learn-app-gap'
import { applicationGapPromptSection, mergeApplicationGapsIntoGapAnalysis } from '@/lib/jobs/skill-gap-report'
import { buildDeck } from '@/lib/pitch/build'
import type { Course } from '@prisma/client'

const NOW = new Date('2026-10-20T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

describe('snapshot: what the job asked for', () => {
  it('reads a posting: AI skills first, tools by member name, skills without AI aliases', () => {
    const a = postingAsks({ skills: ['sql', 'machine learning', 'fp&a'], aiSkillItems: ['b_ml_general'], aiToolsNamed: ['Microsoft Copilot (M365)', 'Microsoft Copilot (M365)'] })
    expect(a.aiSkills.length).toBe(1)
    expect(a.tools).toEqual(['Microsoft Copilot'])
    expect(a.skills).toEqual(['sql', 'fp&a'])
  })

  it('infers from the occupation: skills most of its postings ask for, nothing when too few postings', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ skills: i < 30 ? ['excel', 'forecasting'] : ['sql'], aiSkillItems: [] }))
    const asks = occupationAsksFromPostings(many)!
    expect(asks.skills).toEqual(['excel', 'forecasting', 'sql'])
    expect(occupationAsksFromPostings(many.slice(0, MIN_OCCUPATION_POSTINGS - 1))).toBeNull()
    // A skill under the share floor is left out.
    const rare = [...many, ...Array.from({ length: 60 }, () => ({ skills: ['excel'], aiSkillItems: [] }))]
    expect(occupationAsksFromPostings([...rare, { skills: ['cobol'], aiSkillItems: [] }])!.skills).not.toContain('cobol')
  })

  it('O*NET fallback keeps hot tools and drops generic office software', () => {
    const asks = inferredAsks([
      { name: 'Microsoft Outlook', kind: 'TECHNOLOGY', importance: 90, hotTech: true },
      { name: 'Tableau', kind: 'TECHNOLOGY', importance: 50, hotTech: true },
      { name: 'Oracle PeopleSoft', kind: 'TECHNOLOGY', importance: 80, hotTech: false },
      { name: 'Active Listening', kind: 'SKILL', importance: 99, hotTech: false },
    ])
    expect(asks.tools).toEqual(['Tableau'])
  })
})

describe('snapshot: match math', () => {
  it('counts whole-word matches, never substrings', () => {
    const m = matchAsks({ skills: ['excel', 'r', 'sql'], tools: ['Tableau'], aiSkills: [] }, ['microsoft excel', 'sql server', 'ruby'])
    expect(m.matched).toEqual(['excel', 'sql'])
    expect(m.missing).toEqual(['Tableau', 'r'])
    expect(m.matchPct).toBe(50)
  })

  it('null match when the job asked for nothing we can read', () => {
    expect(matchAsks({ skills: [], tools: [], aiSkills: [] }, ['sql']).matchPct).toBeNull()
  })

  it('freezes facts, region and the skills hash', () => {
    const s = buildSnapshot({
      basis: 'posting',
      boardJobId: 'p1',
      asks: { skills: ['sql', 'fp&a'], tools: [], aiSkills: [] },
      facts: { industry: 'healthcare', jobFunction: 'Finance', subFunction: 'fin_fpa', level: 'DIRECTOR', locationState: 'MA', employerSector: 'private' },
      memberKeywords: ['fp&a'],
    })
    expect(s).toMatchObject({ basis: 'posting', region: 'Northeast', matchPct: 50, missing: ['sql'], industry: 'healthcare' })
    expect(s.skillsHash).toBe(skillsHash(['FP&A ']))
    expect(skillsHash(['a', 'b'])).toBe(skillsHash(['b', 'a']))
    expect(skillsHash(['a'])).not.toBe(skillsHash(['a', 'b']))
    expect(censusRegion('tx')).toBe('South')
    expect(censusRegion(null)).toBeNull()
  })

  it('keeps posting history; an inferred row gives way to a posting', () => {
    expect(shouldReplaceSnapshot(null, { basis: 'inferred', boardJobId: null })).toBe(true)
    expect(shouldReplaceSnapshot({ basis: 'inferred', boardJobId: null }, { basis: 'posting', boardJobId: 'p1' })).toBe(true)
    expect(shouldReplaceSnapshot({ basis: 'inferred', boardJobId: null }, { basis: 'inferred', boardJobId: null })).toBe(false)
    expect(shouldReplaceSnapshot({ basis: 'posting', boardJobId: 'p1' }, { basis: 'posting', boardJobId: 'p1' })).toBe(false)
    expect(shouldReplaceSnapshot({ basis: 'posting', boardJobId: 'p1' }, { basis: 'inferred', boardJobId: null })).toBe(false)
    expect(shouldReplaceSnapshot({ basis: 'posting', boardJobId: 'p1' }, { basis: 'posting', boardJobId: 'p2' })).toBe(true)
  })
})

const row = (o: Partial<SnapshotRow> & { daysAgo?: number }): SnapshotRow => ({
  appliedAt: daysAgo(o.daysAgo ?? 1),
  basis: 'posting',
  matchPct: 50,
  missing: [],
  currentMatchPct: 50,
  currentMissing: [],
  industry: null,
  jobFunction: null,
  level: null,
  ...o,
})

describe('member summary', () => {
  it('weights inferred applications half', () => {
    expect(BASIS_WEIGHT.inferred).toBe(0.5)
    expect(weightedMatch([row({ matchPct: 100 }), row({ basis: 'inferred', matchPct: 40 })], (r) => r.matchPct, (r) => r.basis)).toBe(80)
  })

  it('trend: 8 weeks ending this week, empty weeks null', () => {
    const t = weeklyTrend([row({ daysAgo: 0, matchPct: 60 }), row({ daysAgo: 1, matchPct: 40 }), row({ daysAgo: 20, matchPct: 10 })], NOW)
    expect(t).toHaveLength(8)
    expect(t[7]).toMatchObject({ weekStart: '2026-10-19', applications: 2, matchPct: 50 })
    expect(t[6].matchPct).toBeNull()
    expect(t[4].applications).toBe(1)
  })

  it('top gaps: frequent and recent first, posting-backed beats inferred, one-offs dropped when others repeat', () => {
    const rows = [
      row({ daysAgo: 2, currentMissing: ['sql', 'tableau'] }),
      row({ daysAgo: 3, currentMissing: ['sql'] }),
      row({ daysAgo: 90, currentMissing: ['python'] }),
      row({ daysAgo: 95, currentMissing: ['python'] }),
      row({ daysAgo: 100, currentMissing: ['python'] }),
      row({ daysAgo: 1, basis: 'inferred', currentMissing: ['excel'] }),
      row({ daysAgo: 1, basis: 'inferred', currentMissing: ['excel'] }),
    ]
    const g = topAskedGaps(rows, NOW, 3)
    expect(g.map((x) => x.term)).toEqual(['sql', 'excel', 'python'])
    expect(g[0]).toMatchObject({ applications: 2, recent: 2, inferredOnly: false })
    expect(g[1].inferredOnly).toBe(true)
    // tableau (asked once) only shows when too few repeat.
    expect(topAskedGaps(rows, NOW, 5).map((x) => x.term)).toContain('tableau')
  })

  it('best-match line: the dimension with the biggest spread, the main function named', () => {
    const rows = [
      ...[1, 2, 3].map(() => row({ jobFunction: 'Finance', industry: 'healthcare', currentMatchPct: 82 })),
      ...[1, 2, 3].map(() => row({ jobFunction: 'Finance', industry: 'technology', currentMatchPct: 61 })),
    ]
    expect(bestMatchLine(rows)!.text).toBe('You match 82% on Finance roles in healthcare vs 61% in technology.')
    expect(bestMatchLine(rows.slice(0, 2))).toBeNull()
    const s = summarizeApplications(rows, NOW)
    expect(s).toMatchObject({ applications: 6, fromPostings: 6, inferred: 0, matchPct: 72 })
  })
})

describe('recommendations', () => {
  it('ranks by applications, then market, with AI pay lift breaking ties, and explains why', () => {
    const recs = rankSkillRecommendations({
      appGaps: [
        { term: 'sql', applications: 8, recent: 3, inferredOnly: false, ai: false, score: 5 },
        { term: 'AI governance and risk', applications: 2, recent: 1, inferredOnly: false, ai: true, score: 1 },
        { term: 'excel', applications: 1, recent: 0, inferredOnly: true, ai: false, score: 0.1 },
      ],
      totalApplications: 10,
      market: [
        { term: 'tableau', employers: 9, have: false, ai: false },
        { term: 'excel', employers: 10, have: true, ai: false },
        { term: 'AI governance and risk', employers: 2, have: false, ai: true },
      ],
      marketEmployers: 10,
      payLift: (_t, ai) => (ai ? { pct: 21, text: 'Finance postings that ask for an AI skill pay about 21% more, like-for-like.' } : null),
    })
    expect(recs.map((r) => r.term)).toEqual(['sql', 'tableau', 'AI governance and risk'])
    expect(recs[0].reason).toBe('8 of your 10 applications asked for it.')
    expect(recs[2].reason).toContain('pay about 21% more')
    // excel is on the member's profile per the market, but the application gap (read now) still counts it; the market's "have" never hides an application gap.
    const inferred = rankSkillRecommendations({ appGaps: [{ term: 'budgeting', applications: 4, recent: 0, inferredOnly: true, ai: false, score: 1 }], totalApplications: 10, market: [], marketEmployers: 0, payLift: () => null })
    expect(inferred[0].reason).toBe('4 of your 10 applications were for roles that usually ask for it.')
  })
})

const agg = (o: Partial<AggregateRow>): AggregateRow => ({
  candidateId: 'c1',
  appliedAt: daysAgo(3),
  basis: 'posting',
  matchPct: 50,
  missing: [],
  industry: null,
  jobFunction: null,
  level: null,
  locationState: null,
  region: null,
  ...o,
})

describe('admin aggregates', () => {
  const rows = [
    agg({ candidateId: 'a', industry: 'financial_services', jobFunction: 'Finance', level: 'DIRECTOR', locationState: 'NY', region: 'Northeast', matchPct: 80, missing: ['sql'] }),
    agg({ candidateId: 'b', industry: 'financial_services', jobFunction: 'Finance', level: 'VP', locationState: 'TX', region: 'South', matchPct: 40, missing: ['sql', 'tableau'] }),
    agg({ candidateId: 'b', basis: 'inferred', industry: 'healthcare', jobFunction: 'Finance', level: 'VP', matchPct: 20, missing: ['excel'] }),
    agg({ candidateId: 'c', matchPct: null }),
  ]

  it('segments with counts, weighted match and a gap leaderboard', () => {
    const byInd = aggregateBy(rows, 'industry')
    expect(byInd.map((s) => s.segment)).toEqual(['Financial Services & Banking', 'Healthcare & Hospital Systems', 'Unknown'])
    expect(byInd[0]).toMatchObject({ applications: 2, members: 2, withSkillData: 2, matchPct: 60 })
    expect(byInd[0].topGaps[0]).toEqual({ term: 'sql', applications: 2, sharePct: 100 })
    const byLevel = aggregateBy(rows, 'level')
    expect(byLevel.find((s) => s.segment === 'VP & Head of')?.applications).toBe(2)
    const report = buildSkillMatchReport(rows, NOW)
    // (80 + 40 + 0.5*20) / 2.5 = 52
    expect(report.overall).toMatchObject({ applications: 4, members: 3, withSkillData: 3, fromPostings: 3, inferred: 1, matchPct: 52 })
    expect(report.trend).toHaveLength(12)
    expect(report.byDimension.region.map((s) => s.segment)).toEqual(['Northeast', 'South', 'Unknown'])
  })

  it('CSV: aggregates only, one row per segment, formulas neutralized', () => {
    const csv = skillMatchCsv(buildSkillMatchReport([...rows, agg({ candidateId: 'z', jobFunction: '=HYPERLINK("x")' })], NOW))
    expect(csv.split('\n')[0]).toBe('dimension,segment,applications,members,with_skill_data,from_postings,inferred,match_pct,top_gaps')
    expect(csv).toContain('overall,All applications,5,4,')
    expect(csv).not.toMatch(/,=HYPERLINK/)
    for (const id of ['a', 'b', 'c1', 'z']) expect(csv).not.toContain(`,${id},`)
  })

  it('pitch line is citable only with enough applications and members', () => {
    const seg = aggregateBy(rows, 'industry')[0]
    const line = pitchGapLine(seg)
    expect(line.text).toBe('Across 2 applications in financial services & banking, the top missing skills were sql and tableau.')
    expect(line.citable).toBe(false)
    const big = { ...seg, withSkillData: 40, members: 5 }
    expect(pitchGapLine(big).citable).toBe(true)
    const deck = (citable: boolean) =>
      buildDeck({
        rules: { type: 'workforce', slides: [{ id: 's', section: 'x', kind: 'bullets', title: 'Gaps', bullets: ['{{appGapLine}}', 'Always here'], enabled: true }] } as never,
        brand: { orgName: 'Org' } as never,
        area: null,
        applicationGaps: { text: 'Across 40 applications, the top missing skills were sql.', citable },
      })
    expect(deck(true).slides[0].bullets).toEqual(['Across 40 applications, the top missing skills were sql.', 'Always here'])
    expect(deck(false).slides[0].bullets).toEqual(['Always here'])
  })
})

describe('one source of truth: Learning, Market Reality, courses', () => {
  const course = (id: string, title: string, keywords: string[] = [], url = `https://x/${id}`) =>
    ({ id, title, keywords, url, description: 'Excel at leading teams', sponsor: null, provider: 'p', free: true, logoUrl: null }) as unknown as Course

  it('finds a course by title or keyword, never from a description', () => {
    const catalog = [course('1', 'Intro to SQL'), course('2', 'Leadership', ['fp&a'])]
    expect(courseForSkill('sql', catalog)?.id).toBe('1')
    expect(courseForSkill('fp&a', catalog)?.id).toBe('2')
    expect(courseForSkill('excel', catalog)).toBeNull()
    const tagged = [course('3', 'NIST AI RMF', [], 'https://www.nist.gov/itl/ai-risk-management-framework'), course('4', 'Advanced in AI Audit (AAIA)', [], 'https://www.isaca.org/credentialing/aaia')]
    expect(courseForSkill('AI governance and risk', tagged)?.id).toBe('3')
    expect(courseForSkill('audit', tagged)).toBeNull()
  })

  it('Learning gets one item per course, in recommendation order, with the reason', () => {
    const catalog = [course('1', 'Intro to SQL')]
    const items = applicationGapCourseItems([{ term: 'sql', reason: '8 of your 10 applications asked for it.' }, { term: 'SQL', reason: 'dup' }, { term: 'cobol', reason: 'x' }], catalog, courseForSkill)
    expect(items).toHaveLength(1)
    expect(items[0].rationale).toBe('8 of your 10 applications asked for it. This course covers “sql”.')
  })

  it('Market Reality cites only repeated application gaps and never duplicates one', () => {
    const apps = { applications: 10, matchPct: 40, gaps: [{ term: 'sql', applications: 6, inferredOnly: false }, { term: 'excel', applications: 2, inferredOnly: true }] }
    expect(applicationGapPromptSection(apps)).toContain('sql (6)')
    expect(applicationGapPromptSection(apps)).not.toContain('excel')
    const merged = mergeApplicationGapsIntoGapAnalysis({ targetRole: 'x', gaps: [] as { area: string; why: string; remediation: string; remediationType: 'upskilling' }[] }, apps)
    expect(merged.gaps.map((g) => g.area)).toEqual(['Skill: SQL'])
    const again = mergeApplicationGapsIntoGapAnalysis(merged, apps)
    expect(again.gaps).toHaveLength(1)
  })
})
