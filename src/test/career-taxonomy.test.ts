import { describe, expect, it } from 'vitest'
import type { OccupationElement, OccupationProfile } from '@/lib/careers/types'
import { buildVectorSpace, ratedGaps, similarity, skillOverlap, toolGaps } from '@/lib/careers/vectors'
import { buildTitleIndex, matchTitle, normalizeTitle } from '@/lib/careers/title-match'
import { rankPivots } from '@/lib/careers/pivots'

function el(name: string, kind: OccupationElement['kind'], importance: number, level: number | null, hotTech = false): OccupationElement {
  return { name, kind, importance, level, hotTech }
}

function occ(
  socCode: string,
  title: string,
  extra: Omit<Partial<OccupationProfile>, 'elements'> & { elements: [string, OccupationElement][] }
): OccupationProfile {
  return {
    socCode,
    title,
    jobZone: 4,
    medianWage: 100_000,
    employment: null,
    growthPct: null,
    annualOpenings: null,
    typicalEducation: null,
    relatedSocCodes: [],
    ...extra,
    elements: new Map(extra.elements),
  }
}

// Small stand-in for O*NET: two finance-flavoured roles, a close cousin, a
// distant role, and an entry-level role that should be filtered by Job Zone.
const FIN = (imp: number, lvl: number) => ['skill:fin', el('Financial analysis', 'SKILL', imp, lvl)] as [string, OccupationElement]
const PEOPLE = (imp: number, lvl: number) => ['skill:people', el('Coordinating people', 'SKILL', imp, lvl)] as [string, OccupationElement]
const CODE = (imp: number, lvl: number) => ['skill:code', el('Programming', 'SKILL', imp, lvl)] as [string, OccupationElement]
const READ = (imp: number, lvl: number) => ['skill:read', el('Reading comprehension', 'SKILL', imp, lvl)] as [string, OccupationElement]

const accountant = occ('13-2011.00', 'Accountants and Auditors', {
  elements: [FIN(90, 70), READ(80, 70), PEOPLE(30, 30), ['tech:excel', el('Microsoft Excel', 'TECHNOLOGY', 90, null)]],
  relatedSocCodes: ['13-2051.00'],
})
const analyst = occ('13-2051.00', 'Financial and Investment Analysts', {
  medianWage: 110_000,
  elements: [FIN(95, 85), READ(80, 70), PEOPLE(30, 30), ['tech:excel', el('Microsoft Excel', 'TECHNOLOGY', 90, null)], ['tech:bloomberg', el('Bloomberg Terminal', 'TECHNOLOGY', 70, null, true)]],
})
const programmer = occ('15-1251.00', 'Computer Programmers', {
  medianWage: 105_000,
  elements: [CODE(95, 80), READ(80, 70), FIN(10, 10), PEOPLE(20, 20)],
})
const manager = occ('11-3031.00', 'Financial Managers', {
  medianWage: 150_000,
  elements: [FIN(90, 80), PEOPLE(85, 75), READ(80, 70), ['tech:excel', el('Microsoft Excel', 'TECHNOLOGY', 90, null)]],
})
const cashier = occ('41-2011.00', 'Cashiers', {
  jobZone: 1,
  medianWage: 30_000,
  elements: [FIN(60, 30), PEOPLE(70, 40), READ(40, 30)],
})

const ALL = [accountant, analyst, programmer, manager, cashier]
const profiles = new Map(ALL.map((p) => [p.socCode, p]))

describe('skill similarity', () => {
  const space = buildVectorSpace(ALL)

  it('ranks a role with the same distinctive skills above an unrelated one', () => {
    const toAnalyst = similarity(space, accountant.socCode, analyst.socCode)!
    const toProgrammer = similarity(space, accountant.socCode, programmer.socCode)!
    expect(toAnalyst).toBeGreaterThan(toProgrammer)
  })

  it('is 1 for an occupation against itself and null for an unknown code', () => {
    expect(similarity(space, accountant.socCode, accountant.socCode)).toBeCloseTo(1, 5)
    expect(similarity(space, accountant.socCode, '99-9999.00')).toBeNull()
  })
})

describe('skill overlap and gaps', () => {
  it('gives full credit where the source already meets the target level', () => {
    expect(skillOverlap(analyst, accountant)).toBeCloseTo(1, 5)
  })

  it('gives partial credit where the source is below the target level', () => {
    const overlap = skillOverlap(accountant, analyst)!
    expect(overlap).toBeLessThan(1)
    expect(overlap).toBeGreaterThan(0.8)
  })

  it('lists the biggest level gaps first and ignores small ones', () => {
    const gaps = ratedGaps(accountant, manager)
    expect(gaps[0].name).toBe('Coordinating people')
    expect(gaps.map((g) => g.name)).not.toContain('Reading comprehension')
  })

  it('reports tools the target uses that neither the source nor the resume has', () => {
    const gaps = toolGaps(accountant, analyst, [])
    expect(gaps.map((g) => g.name)).toEqual(['Bloomberg Terminal'])
    expect(gaps[0].hotTech).toBe(true)
  })

  it('drops a tool the resume already mentions', () => {
    expect(toolGaps(accountant, analyst, ['bloomberg terminal', 'Python'])).toEqual([])
  })
})

describe('pivot ranking', () => {
  const space = buildVectorSpace(ALL)
  const base = { space, profiles, sourceSoc: accountant.socCode, resumeKeywords: [] as string[] }

  it('puts the closest skill match first', () => {
    const out = rankPivots({ ...base, wageFloor: 'ANY' })
    expect(out[0].socCode).toBe(analyst.socCode)
    expect(out[0].onetRelated).toBe(true)
  })

  it('never suggests the current occupation or work two Job Zones below it', () => {
    const out = rankPivots({ ...base, wageFloor: 'ANY' })
    expect(out.map((o) => o.socCode)).not.toContain(accountant.socCode)
    expect(out.map((o) => o.socCode)).not.toContain(cashier.socCode)
  })

  it('applies the pay floor but keeps roles where pay is unknown', () => {
    const lower = occ('13-9999.00', 'Lower Paid Analyst', {
      medianWage: 70_000,
      elements: [FIN(95, 85), READ(80, 70), PEOPLE(30, 30)],
    })
    const unknown = occ('13-9998.00', 'Unknown Pay Analyst', {
      medianWage: null,
      elements: [FIN(95, 85), READ(80, 70), PEOPLE(30, 30)],
    })
    const all = [...ALL, lower, unknown]
    const p = new Map(all.map((x) => [x.socCode, x]))
    const s = buildVectorSpace(all)
    const strict = rankPivots({ space: s, profiles: p, sourceSoc: accountant.socCode, wageFloor: 'MATCH', resumeKeywords: [] })
    expect(strict.map((o) => o.socCode)).not.toContain(lower.socCode)
    expect(strict.map((o) => o.socCode)).toContain(unknown.socCode)
    expect(strict.find((o) => o.socCode === unknown.socCode)?.wageDeltaPct).toBeNull()
    const any = rankPivots({ space: s, profiles: p, sourceSoc: accountant.socCode, wageFloor: 'ANY', resumeKeywords: [] })
    expect(any.map((o) => o.socCode)).toContain(lower.socCode)
  })

  it('reports the pay difference as a percentage of the current median', () => {
    const out = rankPivots({ ...base, wageFloor: 'ANY' })
    expect(out.find((o) => o.socCode === analyst.socCode)?.wageDeltaPct).toBe(10)
  })

  it('returns nothing for an occupation the taxonomy does not hold', () => {
    expect(rankPivots({ ...base, sourceSoc: '00-0000.00', wageFloor: 'ANY' })).toEqual([])
  })
})

describe('title matching', () => {
  const index = buildTitleIndex(
    [
      { socCode: '13-2011.00', title: 'Accountants and Auditors' },
      { socCode: '11-3031.00', title: 'Financial Managers' },
      { socCode: '11-2021.00', title: 'Marketing Managers' },
      { socCode: '11-2022.00', title: 'Sales Managers' },
      { socCode: '15-1252.00', title: 'Software Developers' },
    ],
    [
      { socCode: '11-3031.00', title: 'Chief Financial Officer' },
      { socCode: '11-3031.00', title: 'Controller' },
      { socCode: '15-1252.00', title: 'Software Engineer' },
    ]
  )

  it('strips level words and abbreviations', () => {
    expect(normalizeTitle('Sr. Software Engineer')).toBe('software engineer')
    expect(normalizeTitle('Dir, Finance')).toBe('director finance')
  })

  it('matches an alternate title exactly, ignoring seniority', () => {
    const m = matchTitle(index, 'Senior Software Engineer')
    expect(m.kind).toBe('EXACT')
    if (m.kind === 'EXACT') expect(m.socCode).toBe('15-1252.00')
  })

  it('accepts a clear fuzzy winner', () => {
    const m = matchTitle(index, 'Marketing Manager')
    expect(m.kind === 'EXACT' || m.kind === 'FUZZY').toBe(true)
    if (m.kind === 'EXACT' || m.kind === 'FUZZY') expect(m.socCode).toBe('11-2021.00')
  })

  it('does not guess between equally close occupations', () => {
    const m = matchTitle(index, 'Manager')
    expect(m.kind).toBe('AMBIGUOUS')
    expect(m.candidates.length).toBeGreaterThan(1)
  })

  it('returns none for text with nothing in common', () => {
    expect(matchTitle(index, 'zzz qqq').kind).toBe('NONE')
    expect(matchTitle(index, '   ').kind).toBe('NONE')
  })
})

import {
  parseDelimited,
  parseJobZones,
  parseOews,
  parseOnetAltTitles,
  parseOnetOccupations,
  parseOnetRated,
  parseOnetRelated,
  parseOnetTechnology,
  parseProjections,
} from '@/lib/careers/import-parsers'

const tsv = (...lines: string[]) => lines.join('\n')

describe('O*NET parsers', () => {
  it('keeps only well-formed occupation rows', () => {
    const rows = parseOnetOccupations(
      tsv('O*NET-SOC Code\tTitle\tDescription', '13-2011.00\tAccountants and Auditors\tExamine records.', 'bad\tNope\tx')
    )
    expect(rows).toEqual([{ socCode: '13-2011.00', title: 'Accountants and Auditors', description: 'Examine records.' }])
  })

  it('rescales importance (1-5) and level (0-7) to 0-100 and joins the two scales', () => {
    const head = 'O*NET-SOC Code\tElement ID\tElement Name\tScale ID\tData Value\tRecommend Suppress\tNot Relevant'
    const rows = parseOnetRated(
      tsv(
        head,
        '13-2011.00\t2.A.1.a\tReading Comprehension\tIM\t5.00\tN\tn/a',
        '13-2011.00\t2.A.1.a\tReading Comprehension\tLV\t3.50\tN\tN',
        '13-2011.00\t2.A.1.b\tWriting\tIM\t3.00\tY\tn/a',
        '13-2011.00\t2.A.1.b\tWriting\tLV\t4.00\tY\tN',
        '13-2011.00\t2.A.1.c\tSpeaking\tIM\t4.00\tN\tn/a'
      ),
      'SKILL'
    )
    expect(rows).toEqual([
      { socCode: '13-2011.00', skillId: 'skill:2.A.1.a', name: 'Reading Comprehension', kind: 'SKILL', importance: 100, level: 50, hotTech: false },
    ])
  })

  it('treats a Not Relevant level as zero', () => {
    const rows = parseOnetRated(
      tsv(
        'O*NET-SOC Code\tElement ID\tElement Name\tScale ID\tData Value\tRecommend Suppress\tNot Relevant',
        '13-2011.00\t2.C.1.a\tChemistry\tIM\t1.00\tN\tn/a',
        '13-2011.00\t2.C.1.a\tChemistry\tLV\t2.00\tN\tY'
      ),
      'KNOWLEDGE'
    )
    expect(rows[0]).toMatchObject({ skillId: 'knowledge:2.C.1.a', importance: 0, level: 0 })
  })

  it('dedupes technology rows and lets a hot flag win', () => {
    const rows = parseOnetTechnology(
      tsv(
        'O*NET-SOC Code\tExample\tCommodity Code\tCommodity Title\tHot Technology\tIn Demand',
        '13-2011.00\tMicrosoft Excel\t1\tSpreadsheet\tN\tN',
        '13-2011.00\tMicrosoft Excel\t2\tSpreadsheet\tY\tN',
        '13-2011.00\tSAP\t3\tERP\tN\tY'
      )
    )
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.name === 'Microsoft Excel')).toMatchObject({ skillId: 'tech:microsoft-excel', hotTech: true, importance: 80 })
    expect(rows.find((r) => r.name === 'SAP')?.hotTech).toBe(true)
  })

  it('reads job zones, alternate titles and related occupations', () => {
    expect(parseJobZones(tsv('O*NET-SOC Code\tJob Zone', '13-2011.00\t4', '13-2012.00\t9')).get('13-2011.00')).toBe(4)
    expect(parseOnetAltTitles(tsv('O*NET-SOC Code\tAlternate Title', '13-2011.00\tCPA'))).toEqual([{ socCode: '13-2011.00', title: 'CPA' }])
    expect(
      parseOnetRelated(tsv('O*NET-SOC Code\tRelated O*NET-SOC Code\tRelatedness Tier\tIndex', '13-2011.00\t13-2051.00\tPrimary-Short\t1'))
    ).toEqual([{ socCode: '13-2011.00', relatedSocCode: '13-2051.00', tier: 'Primary-Short', rank: 1 }])
  })
})

describe('BLS parsers', () => {
  it('handles quoted commas in CSV', () => {
    expect(parseDelimited('a,"b,c",d\n1,2,3', ',')).toEqual([['a', 'b,c', 'd'], ['1', '2', '3']])
  })

  it('reads OEWS detailed rows and leaves suppressed or top-coded wages unknown', () => {
    const rows = parseOews(
      ['OCC_CODE,OCC_TITLE,O_GROUP,TOT_EMP,A_MEDIAN', '00-0000,All Occupations,total,100,50000', '13-2011,Accountants,detailed,"1,538,400","79,880"', '11-1011,Chief Executives,detailed,200000,#'].join('\n')
    )
    expect(rows).toEqual([
      { soc6: '13-2011', medianWage: 79880, employment: 1538400 },
      { soc6: '11-1011', medianWage: null, employment: 200000 },
    ])
  })

  it('finds the projections header below title rows and converts openings from thousands', () => {
    const csv = [
      'Table 1.2 Occupational projections,,,,',
      '"Title","2024 National Employment Matrix code","Employment change, percent, 2024-34","Occupational openings, 2024-34 annual average","Typical education needed for entry"',
      '"Accountants and auditors","13-2011","5.0","126.5","Bachelor\'s degree"',
      '"Total, all occupations","00-0000","3.1","1000","n/a"',
    ].join('\n')
    expect(parseProjections(csv)).toEqual([
      { soc6: '13-2011', growthPct: 5, annualOpenings: 126500, typicalEducation: "Bachelor's degree", period: '2024-34' },
    ])
  })

  it('returns nothing when there is no recognizable header', () => {
    expect(parseProjections('foo,bar\n1,2')).toEqual([])
  })
})

import { buildSkillGapGrounding, groundingPromptBlock } from '@/lib/careers/grounding'

describe('skill gap grounding', () => {
  it('lists the target role’s missing tools and knowledge, skipping what the resume shows', () => {
    const knowledgeTarget = occ('11-3031.00', 'Financial Managers', {
      elements: [
        ['knowledge:econ', el('Economics and Accounting', 'KNOWLEDGE', 90, 85)],
        ['skill:people', el('Coordinating people', 'SKILL', 85, 75)],
        ['tech:bloomberg', el('Bloomberg Terminal', 'TECHNOLOGY', 80, null, true)],
        ['tech:excel', el('Microsoft Excel', 'TECHNOLOGY', 50, null)],
      ],
    })
    const g = buildSkillGapGrounding(accountant, knowledgeTarget, ['Microsoft Excel'])
    expect(g.tools).toEqual(['Bloomberg Terminal'])
    expect(g.knowledge).toEqual(['Economics and Accounting'])
    expect(g.skills).toEqual(['Coordinating people'])
    expect(g.key).toBe('13-2011.00>11-3031.00')
    expect(groundingPromptBlock(g)).toContain('Bloomberg Terminal')
  })

  it('still works with no current occupation', () => {
    const g = buildSkillGapGrounding(null, analyst, [])
    expect(g.sourceSoc).toBeNull()
    expect(g.tools).toContain('Bloomberg Terminal')
    expect(g.key).toBe('->13-2051.00'.replace('->', '-' + '>'))
  })
})

import { skillMatchTerms, tagCourse, type TaggableSkill } from '@/lib/careers/course-tagging'
import { normalizeSoc6, parseTrainingPrograms } from '@/lib/careers/import-parsers'

describe('course tagging', () => {
  const skills: TaggableSkill[] = [
    { id: 'tech:python', name: 'Python', kind: 'TECHNOLOGY' },
    { id: 'tech:java', name: 'Java', kind: 'TECHNOLOGY' },
    { id: 'tech:javascript', name: 'JavaScript', kind: 'TECHNOLOGY' },
    { id: 'tech:microsoft-office', name: 'Microsoft Office', kind: 'TECHNOLOGY' },
    { id: 'tech:r', name: 'R', kind: 'TECHNOLOGY' },
    { id: 'knowledge:econ', name: 'Economics and Accounting', kind: 'KNOWLEDGE' },
    { id: 'knowledge:admin', name: 'Administration and Management', kind: 'KNOWLEDGE' },
    { id: 'skill:ct', name: 'Critical Thinking', kind: 'SKILL' },
  ]

  it('matches tools as whole words, not substrings', () => {
    const tags = tagCourse({ title: 'JavaScript for beginners', description: 'Build web pages.', keywords: [] }, skills)
    expect(tags).toEqual(['tech:javascript'])
  })

  it('matches the distinctive part of a knowledge area and ignores generic parts', () => {
    expect(skillMatchTerms(skills[5])).toEqual(['economics', 'accounting'])
    expect(skillMatchTerms(skills[6])).toEqual([])
    const tags = tagCourse({ title: 'Financial accounting essentials', description: 'Learn bookkeeping.', keywords: [] }, skills)
    expect(tags).toEqual(['knowledge:econ'])
  })

  it('never tags generic skills, one-letter tools or generic software', () => {
    const tags = tagCourse({ title: 'Critical thinking with R and Microsoft Office', description: '', keywords: [] }, skills)
    expect(tags).toEqual([])
  })

  it('puts tools before knowledge areas and caps the tag count', () => {
    const many: TaggableSkill[] = Array.from({ length: 12 }, (_, i) => ({ id: `tech:tool${i}`, name: `Toolname${i}`, kind: 'TECHNOLOGY' as const }))
    const tags = tagCourse({ title: many.map((m) => m.name).join(' '), description: 'accounting', keywords: [] }, [...skills, ...many])
    expect(tags).toHaveLength(8)
    expect(tags.every((t) => t.startsWith('tech:'))).toBe(true)
  })
})

describe('training program list parser', () => {
  it('normalizes SOC codes', () => {
    expect(normalizeSoc6('13-2011.00')).toBe('13-2011')
    expect(normalizeSoc6('132011')).toBe('13-2011')
    expect(normalizeSoc6('banana')).toBeNull()
  })

  it('reads a state list with its own column names, dedupes, and leaves unknowns empty', () => {
    const csv = [
      'Provider Name,Program Name,Website,SOC Codes,Delivery,Total Cost,Duration (weeks)',
      'Bunker Hill CC,Bookkeeping Certificate,https://example.edu/bk,"43-3031; 13-2011.00",Hybrid,"$4,200",16',
      'Bunker Hill CC,Bookkeeping Certificate,https://example.edu/bk,43-3031,Hybrid,4200,16',
      'Acme Institute,Data Analytics,not a url,,Online,,',
      ',Missing Provider,,,,,',
    ].join('\n')
    const rows = parseTrainingPrograms(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ providerName: 'Bunker Hill CC', socCodes: ['43-3031', '13-2011'], deliveryMode: 'HYBRID', costUsd: 4200, durationWeeks: 16, url: 'https://example.edu/bk' })
    expect(rows[1]).toMatchObject({ programName: 'Data Analytics', url: null, socCodes: [], deliveryMode: 'ONLINE', costUsd: null, durationWeeks: null })
  })
})
