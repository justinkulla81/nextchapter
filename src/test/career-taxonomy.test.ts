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

import { bestPay, comparePay, describePay, OEWS_WAGE_CEILING, type PayByLevel, type PayInfo, type PayLevel } from '@/lib/careers/local-pay'
import { cityPositionInMetro, resolveArea, stateAbbreviation } from '@/lib/careers/area'
import { parseOewsAreas } from '@/lib/careers/import-parsers'

const pay = (level: PayLevel, median: number | null, over: Partial<PayInfo> = {}): PayInfo => ({
  level,
  areaName: level === 'METRO' ? 'Boston-Cambridge-Nashua, MA-NH' : level === 'STATE' ? 'Massachusetts' : 'United States',
  median,
  p10: null,
  p25: null,
  p75: null,
  p90: null,
  employment: null,
  ceilingHit: false,
  ...over,
})

describe('local pay comparison', () => {
  it('compares at the narrowest place where both occupations have a median', () => {
    const src: PayByLevel = { METRO: pay('METRO', 100_000), NATIONAL: pay('NATIONAL', 80_000) }
    const tgt: PayByLevel = { METRO: pay('METRO', 120_000), NATIONAL: pay('NATIONAL', 85_000) }
    const c = comparePay(src, tgt)
    expect(c.basis).toBe('METRO')
    expect(c.deltaPct).toBe(20)
    expect(c.pay?.median).toBe(120_000)
  })

  it('falls back to the state, then the nation, rather than mixing places', () => {
    // Target has no metro figure, so a Boston source median must not be compared with a national target median.
    const src: PayByLevel = { METRO: pay('METRO', 140_000), STATE: pay('STATE', 120_000), NATIONAL: pay('NATIONAL', 100_000) }
    const tgt: PayByLevel = { STATE: pay('STATE', 108_000), NATIONAL: pay('NATIONAL', 99_000) }
    const c = comparePay(src, tgt)
    expect(c.basis).toBe('STATE')
    expect(c.deltaPct).toBe(-10)
  })

  it('reports "at least" when the target pay is withheld above the wage ceiling', () => {
    const src: PayByLevel = { NATIONAL: pay('NATIONAL', 150_000) }
    const tgt: PayByLevel = { NATIONAL: pay('NATIONAL', null, { ceilingHit: true }) }
    const c = comparePay(src, tgt)
    expect(c.atLeast).toBe(true)
    expect(c.deltaPct).toBe(Math.round(((OEWS_WAGE_CEILING - 150_000) / 150_000) * 100))
    expect(describePay(c.pay)).toBe('$239,200 or more')
  })

  it('does not invent a change when the source pay is itself withheld', () => {
    const src: PayByLevel = { NATIONAL: pay('NATIONAL', null, { ceilingHit: true }) }
    const tgt: PayByLevel = { NATIONAL: pay('NATIONAL', 200_000) }
    const c = comparePay(src, tgt)
    expect(c.deltaPct).toBeNull()
    expect(c.pay?.median).toBe(200_000)
  })

  it('prefers the most local figure that says something', () => {
    expect(bestPay({ METRO: pay('METRO', null), STATE: pay('STATE', 90_000) })?.level).toBe('STATE')
    expect(bestPay({})).toBeNull()
    expect(describePay(null)).toBe('Not published for this role')
  })
})

describe('pivot ranking with local pay', () => {
  const space = buildVectorSpace(ALL)
  const base = { space, profiles, sourceSoc: accountant.socCode, resumeKeywords: [] as string[] }
  const local = (m: number, level: PayLevel = 'METRO'): PayByLevel => ({ [level]: pay(level, m) })

  it('applies the pay floor to local pay, not the national medians', () => {
    // Nationally the analyst pays 10% more; in this metro it pays 30% less, so a "same or higher" floor drops it.
    const lookup = (soc: string): PayByLevel => (soc === accountant.socCode ? local(100_000) : soc === analyst.socCode ? local(70_000) : {})
    const strict = rankPivots({ ...base, wageFloor: 'MATCH', pay: lookup })
    expect(strict.map((o) => o.socCode)).not.toContain(analyst.socCode)
    const any = rankPivots({ ...base, wageFloor: 'ANY', pay: lookup })
    const a = any.find((o) => o.socCode === analyst.socCode)!
    expect(a.wageDeltaPct).toBe(-30)
    expect(a.payBasis).toBe('METRO')
    expect(a.pay?.areaName).toContain('Boston')
  })

  it('never drops a role for pay when its exact pay is withheld at the ceiling', () => {
    const lookup = (soc: string): PayByLevel =>
      soc === accountant.socCode ? local(100_000, 'NATIONAL') : soc === analyst.socCode ? { NATIONAL: pay('NATIONAL', null, { ceilingHit: true }) } : {}
    const out = rankPivots({ ...base, wageFloor: 'MATCH', pay: lookup })
    const m = out.find((o) => o.socCode === analyst.socCode)!
    expect(m.payAtLeast).toBe(true)
    expect(m.wageDeltaPct).toBeGreaterThan(100)
  })
})

describe('area resolution', () => {
  const catalog = {
    states: [{ code: '25', name: 'Massachusetts' }, { code: '36', name: 'New York' }],
    metros: [
      { code: '14460', name: 'Boston-Cambridge-Nashua, MA-NH' },
      { code: '40484', name: 'Worcester, MA-CT' },
      { code: '35614', name: 'New York-Newark-Jersey City, NY-NJ' },
    ],
  }

  it('reads state names and abbreviations', () => {
    expect(stateAbbreviation('Massachusetts')).toBe('MA')
    expect(stateAbbreviation('ma')).toBe('MA')
    expect(stateAbbreviation('Narnia')).toBeNull()
  })

  it('finds a metro from the cities in its BLS name, including ones outside our curated list', () => {
    expect(cityPositionInMetro('Boston-Cambridge-Nashua, MA-NH', 'Cambridge', 'MA')).toBe(1)
    expect(cityPositionInMetro('Boston-Cambridge-Nashua, MA-NH', 'Nashua', 'CA')).toBe(-1)
    const ref = resolveArea({ city: 'Worcester', state: 'MA' }, catalog)
    expect(ref.metro?.code).toBe('40484')
    expect(ref.state?.code).toBe('25')
  })

  it('uses the curated big-metro list first', () => {
    const ref = resolveArea({ city: 'Boston', state: 'Massachusetts' }, catalog)
    expect(ref.metro?.code).toBe('14460')
  })

  it('returns only areas we hold data for, and the state alone when the city is unknown', () => {
    const ref = resolveArea({ city: 'Smallville', state: 'NY' }, catalog)
    expect(ref.metro).toBeNull()
    expect(ref.state?.code).toBe('36')
    expect(resolveArea({ city: 'Boston', state: 'MA' }, { states: [], metros: [] })).toEqual({ metro: null, state: null })
    expect(resolveArea({ city: null, state: null }, catalog)).toEqual({ metro: null, state: null })
  })
})

describe('OEWS area parser', () => {
  const header = 'AREA,AREA_TITLE,AREA_TYPE,OCC_CODE,OCC_TITLE,O_GROUP,TOT_EMP,A_PCT10,A_PCT25,A_MEDIAN,A_PCT75,A_PCT90'

  it('reads metro rows, pads codes, and marks a withheld wage as the ceiling', () => {
    const csv = [
      header,
      '14460,"Boston-Cambridge-Nashua, MA-NH",4,13-2011,Accountants and Auditors,detailed,"58,310","60,100","72,000","93,430","117,000",#',
      '14460,"Boston-Cambridge-Nashua, MA-NH",4,11-1011,Chief Executives,detailed,"5,000","90,000","140,000",#,#,#',
      '14460,"Boston-Cambridge-Nashua, MA-NH",4,13-0000,Business and Financial,major,"200,000",1,2,3,4,5',
      '25,Massachusetts,2,13-2011,Accountants and Auditors,detailed,"80,000",1,2,3,4,5',
      '10180,Abilene TX,6,13-2011,Accountants and Auditors,detailed,"500",1,2,3,4,5',
    ].join('\n')
    const rows = parseOewsAreas(csv, 'METRO')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ soc6: '13-2011', areaType: 'METRO', areaCode: '14460', areaName: 'Boston-Cambridge-Nashua, MA-NH', employment: 58310, wageMedian: 93430, wageP90: null, ceilingHit: true })
    expect(rows[1]).toMatchObject({ soc6: '11-1011', wageMedian: null, ceilingHit: true, wageP10: 90000 })
  })

  it('keeps only the requested area type, so a file loaded under the wrong flag yields nothing', () => {
    const csv = [header, '25,Massachusetts,2,13-2011,Accountants and Auditors,detailed,"80,000",1,2,3,4,5'].join('\n')
    expect(parseOewsAreas(csv, 'METRO')).toEqual([])
    const state = parseOewsAreas(csv, 'STATE')
    expect(state[0]).toMatchObject({ areaCode: '25', areaType: 'STATE', wageMedian: 3 })
  })

  it('treats the national file as one area called US', () => {
    const csv = ['AREA,AREA_TITLE,AREA_TYPE,OCC_CODE,O_GROUP,TOT_EMP,A_MEDIAN', '99,U.S.,1,13-2011,detailed,1538400,79880'].join('\n')
    expect(parseOewsAreas(csv, 'NATIONAL')[0]).toMatchObject({ areaCode: 'US', areaType: 'NATIONAL', wageMedian: 79880 })
  })
})

import { inScopeBySoc, inWhiteCollarScope } from '@/lib/careers/scope'
import { parseOnetTasks } from '@/lib/careers/import-parsers'

describe('white-collar scope', () => {
  it('keeps management, business and finance, computing and legal at Job Zone 4 or 5', () => {
    expect(inWhiteCollarScope('11-1011.00', 5)).toBe(true) // Chief Executives
    expect(inWhiteCollarScope('13-2011.00', 4)).toBe(true) // Accountants
    expect(inWhiteCollarScope('15-1252.00', 4)).toBe(true)
    expect(inWhiteCollarScope('23-1011.00', 5)).toBe(true)
  })

  it('drops work below Job Zone 4 even in a kept group', () => {
    expect(inWhiteCollarScope('11-9051.00', 3)).toBe(false) // a zone-3 manager role
    expect(inWhiteCollarScope('13-1031.00', 3)).toBe(false)
  })

  it('takes only the professional parts of engineering, media and sales', () => {
    expect(inScopeBySoc('17-2051.00')).toBe(true) // civil engineers
    expect(inScopeBySoc('17-3011.00')).toBe(false) // architectural drafters
    expect(inScopeBySoc('27-3031.00')).toBe(true) // public relations specialists
    expect(inScopeBySoc('27-2011.00')).toBe(false) // actors
    expect(inScopeBySoc('41-3031.00')).toBe(true) // securities sales
    expect(inScopeBySoc('41-2011.00')).toBe(false) // cashiers
    expect(inScopeBySoc('47-2061.00')).toBe(false) // construction laborers
  })

  it('excludes an occupation with no Job Zone', () => {
    expect(inWhiteCollarScope('13-2011.00', null)).toBe(false)
    expect(inWhiteCollarScope('13-2011.00', undefined)).toBe(false)
  })
})

describe('O*NET task and rated-kind parsing', () => {
  it('orders core tasks first, caps per occupation, and tolerates bad rows', () => {
    const text = [
      'O*NET-SOC Code\tTask ID\tTask\tTask Type\tIncumbents Responding',
      '13-2011.00\t3\tSupplemental thing\tSupplemental\t10',
      '13-2011.00\t2\tCore two\tCore\t10',
      '13-2011.00\t1\tCore one\tCore\t10',
      '13-2011.00\tx\tBroken id\tCore\t10',
      '13-2051.00\t7\tAnalyst core\tCore\t10',
    ].join('\n')
    const rows = parseOnetTasks(text, 2)
    expect(rows.filter((r) => r.socCode === '13-2011.00').map((r) => r.text)).toEqual(['Core one', 'Core two'])
    expect(rows.filter((r) => r.socCode === '13-2051.00')).toHaveLength(1)
  })

  it('namespaces abilities and work activities so ids never collide with skills', () => {
    const head = 'O*NET-SOC Code\tElement ID\tElement Name\tScale ID\tData Value\tRecommend Suppress\tNot Relevant'
    const rows = [
      ...parseOnetRated([head, '13-2011.00\t1.A.1\tOral Comprehension\tIM\t4.00\tN\tn/a', '13-2011.00\t1.A.1\tOral Comprehension\tLV\t5.00\tN\tN'].join('\n'), 'ABILITY'),
      ...parseOnetRated([head, '13-2011.00\t4.A.1\tGetting Information\tIM\t4.00\tN\tn/a', '13-2011.00\t4.A.1\tGetting Information\tLV\t5.00\tN\tN'].join('\n'), 'ACTIVITY'),
    ]
    expect(rows.map((r) => r.skillId)).toEqual(['ability:1.A.1', 'activity:4.A.1'])
  })

  it('never lists an ability as a gap to build', () => {
    const src = occ('13-2011.00', 'Src', { elements: [['ability:a', el('Oral Comprehension', 'ABILITY', 90, 30)], ['skill:s', el('Negotiation', 'SKILL', 90, 30)]] })
    const tgt = occ('13-2051.00', 'Tgt', { elements: [['ability:a', el('Oral Comprehension', 'ABILITY', 90, 90)], ['skill:s', el('Negotiation', 'SKILL', 90, 90)]] })
    expect(ratedGaps(src, tgt).map((g) => g.name)).toEqual(['Negotiation'])
  })
})

import { BUILTIN_ALIASES, buildAliasIndex, buildAliasRows, findToolByName, nameVariants, resolveSkillIds } from '@/lib/careers/skill-aliases'

describe('skill aliases', () => {
  const tools = [
    { id: 'tech:microsoft-excel', name: 'Microsoft Excel' },
    { id: 'tech:salesforce-software', name: 'Salesforce software' },
    { id: 'tech:oracle-netsuite', name: 'Oracle NetSuite' },
    { id: 'tech:sap', name: 'SAP' },
    { id: 'tech:javascript', name: 'JavaScript' },
    { id: 'tech:java', name: 'Java' },
  ]

  it('derives name variants without filler words and vendor prefixes', () => {
    expect(nameVariants('Microsoft Excel')).toEqual(['microsoft excel', 'excel'])
    expect(nameVariants('Salesforce software')).toEqual(['salesforce software', 'salesforce'])
    expect(nameVariants('R')).toEqual([])
  })

  it('finds the right tool by exact variant first, then by whole-phrase containment', () => {
    expect(findToolByName('excel', tools)?.id).toBe('tech:microsoft-excel')
    expect(findToolByName('netsuite', tools)?.id).toBe('tech:oracle-netsuite')
    // "java" is its own tool; it must not resolve to JavaScript just because the letters appear in it.
    expect(findToolByName('java', tools)?.id).toBe('tech:java')
    expect(findToolByName('cobol', tools)).toBeNull()
  })

  it('stores built-in shorthand only when it resolves to a real tool, and lists what stays unmapped', () => {
    const { rows, unmapped } = buildAliasRows(tools, ['excel', 'fp&a', 'netsuite'])
    const by = new Map(rows.map((r) => [r.alias, r]))
    expect(by.get('sfdc')?.skillId).toBe('tech:salesforce-software')
    expect(by.get('sfdc')?.source).toBe('BUILTIN')
    expect(by.get('excel')?.skillId).toBe('tech:microsoft-excel')
    expect(by.has('k8s')).toBe(false) // no Kubernetes tool offered, so no alias
    expect(unmapped).toEqual(['fp&a'])
  })

  it('lets a hand-written alias win over a generated variant', () => {
    expect(Object.keys(BUILTIN_ALIASES)).toContain('sfdc')
    const { rows } = buildAliasRows(tools)
    expect(new Set(rows.map((r) => r.alias)).size).toBe(rows.length)
  })

  it('resolves resume keywords to skill ids by alias, including inside longer phrases', () => {
    const { rows } = buildAliasRows(tools)
    const index = buildAliasIndex(rows)
    const ids = resolveSkillIds(['SFDC', 'Advanced Excel modeling', 'java development', 'Leadership'], index)
    expect(ids).toEqual(new Set(['tech:salesforce-software', 'tech:microsoft-excel', 'tech:java']))
  })

  it('never matches a short alias inside other text', () => {
    const index = buildAliasIndex([{ alias: 'r', skillId: 'tech:r' }])
    expect(resolveSkillIds(['research and reporting'], index).size).toBe(0)
    expect(resolveSkillIds(['R'], index)).toEqual(new Set(['tech:r']))
  })
})

describe('tool gaps with aliases', () => {
  it('does not list a tool the resume evidences by alias', () => {
    const target = occ('13-2051.00', 'T', { elements: [['tech:salesforce', el('Salesforce software', 'TECHNOLOGY', 80, null, true)], ['tech:bloomberg', el('Bloomberg Terminal', 'TECHNOLOGY', 70, null)]] })
    const without = toolGaps(null, target, ['SFDC'])
    expect(without.map((g) => g.name)).toContain('Salesforce software')
    const withAlias = toolGaps(null, target, ['SFDC'], 6, new Set(['tech:salesforce']))
    expect(withAlias.map((g) => g.name)).toEqual(['Bloomberg Terminal'])
  })
})

import { bandFromOverlap, computeSkillsFit, SKILLS_FIT_LABEL } from '@/lib/careers/skills-fit'

describe('skills fit', () => {
  it('turns overlap into four bands', () => {
    expect(bandFromOverlap(0.95)).toBe('close')
    expect(bandFromOverlap(0.8)).toBe('good')
    expect(bandFromOverlap(0.6)).toBe('partial')
    expect(bandFromOverlap(0.2)).toBe('few')
    expect(SKILLS_FIT_LABEL.close).toBe('Lines up closely')
  })

  it('says why it cannot tell instead of guessing', () => {
    expect(computeSkillsFit({ source: accountant, target: null, haveKeywords: [] })).toEqual({ status: 'unmapped', reason: 'title' })
    expect(computeSkillsFit({ source: null, target: analyst, haveKeywords: [] })).toEqual({ status: 'unmapped', reason: 'candidate' })
  })

  it('calls the same occupation a close fit', () => {
    const fit = computeSkillsFit({ source: accountant, target: accountant, haveKeywords: [] })
    expect(fit).toMatchObject({ status: 'mapped', band: 'close', targetTitle: 'Accountants and Auditors' })
  })

  it('names the tools the person lacks, in-demand first', () => {
    const fit = computeSkillsFit({ source: accountant, target: analyst, haveKeywords: [] })
    expect(fit.status).toBe('mapped')
    if (fit.status === 'mapped') expect(fit.toolsToLearn).toEqual(['Bloomberg Terminal'])
  })

  it('moves a person up one band when they already use most of the role’s in-demand tools', () => {
    const hot = (n: string) => [`tech:${n}`, el(n, 'TECHNOLOGY', 80, null, true)] as [string, OccupationElement]
    const base = [FIN(95, 100), READ(80, 70), PEOPLE(30, 30)]
    const target = occ('13-9999.00', 'Quant analyst', { elements: [...base, hot('a'), hot('b'), hot('c')] })
    const src = occ('13-1111.00', 'Source', { elements: [FIN(95, 60), READ(80, 70), PEOPLE(30, 30)] })
    const without = computeSkillsFit({ source: src, target, haveKeywords: [] })
    const withTools = computeSkillsFit({ source: src, target, haveKeywords: [], haveSkillIds: new Set(['tech:a', 'tech:b', 'tech:c']) })
    expect(without.status === 'mapped' && withTools.status === 'mapped').toBe(true)
    if (without.status === 'mapped' && withTools.status === 'mapped') {
      const order = ['few', 'partial', 'good', 'close']
      expect(order.indexOf(withTools.band)).toBe(Math.min(order.indexOf(without.band) + 1, 3))
    }
  })

  it('does not bump on a role with too few in-demand tools to judge', () => {
    const hot = (n: string) => [`tech:${n}`, el(n, 'TECHNOLOGY', 80, null, true)] as [string, OccupationElement]
    const target = occ('13-9998.00', 'T', { elements: [FIN(95, 100), READ(80, 70), hot('a')] })
    const src = occ('13-1112.00', 'S', { elements: [FIN(95, 60), READ(80, 70)] })
    const a = computeSkillsFit({ source: src, target, haveKeywords: [] })
    const b = computeSkillsFit({ source: src, target, haveKeywords: [], haveSkillIds: new Set(['tech:a']) })
    expect(a.status === 'mapped' && b.status === 'mapped' && a.band === b.band).toBe(true)
  })
})


describe('review fixes: matching', () => {
  it('does not hide a tool because its name sits inside a longer resume keyword', () => {
    const target = occ('15-1252.00', 'Dev', { elements: [['tech:java', el('Java', 'TECHNOLOGY', 80, null)], ['tech:r', el('R', 'TECHNOLOGY', 70, null)]] })
    const names = toolGaps(null, target, ['JavaScript', 'research and reporting']).map((g) => g.name)
    expect(names).toContain('Java')
    // "R" is shorter than a usable alias and is not credited from an unrelated keyword either.
    expect(toolGaps(null, target, ['Java']).map((g) => g.name)).not.toContain('Java')
  })

  it('keeps "assistant" in a title so Executive Assistant is not read as Chief Executives', () => {
    const index = buildTitleIndex(
      [{ socCode: '11-1011.00', title: 'Chief Executives' }, { socCode: '43-6011.00', title: 'Executive Secretaries and Executive Administrative Assistants' }],
      [{ socCode: '11-1011.00', title: 'Chief Executive Officer' }]
    )
    const m = matchTitle(index, 'Executive Assistant')
    expect(m.kind === 'EXACT' && m.socCode === '11-1011.00').toBe(false)
  })

  it('credits only exact tool names for hand-written aliases', () => {
    const tools = [{ id: 'tech:microsoft-teams', name: 'Microsoft Teams' }, { id: 'tech:jenkins', name: 'Jenkins' }]
    const { rows } = buildAliasRows(tools)
    const aliases = new Set(rows.map((r) => r.alias))
    expect(aliases.has('ms')).toBe(false)
    expect(aliases.has('ci cd')).toBe(false)
  })

  it('only tags courses with tools and knowledge areas', () => {
    const skills: TaggableSkill[] = [
      { id: 'ability:x', name: 'Oral Comprehension', kind: 'ABILITY' },
      { id: 'activity:y', name: 'Analyzing Data or Information', kind: 'ACTIVITY' },
      { id: 'tech:python', name: 'Python', kind: 'TECHNOLOGY' },
    ]
    expect(tagCourse({ title: 'Oral comprehension and analyzing data or information with Python', description: '', keywords: [] }, skills)).toEqual(['tech:python'])
  })
})
