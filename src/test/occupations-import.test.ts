import { describe, it, expect } from 'vitest'
import { parseTable, resolveColumns, numberOrNull } from '@/lib/occupations/import/delimited'
import {
  buildOnetImport, parseAlternateTitles, parseElements, parseJobZones, parseOccupationData, parseRelatedOccupations, parseTechnologySkills,
} from '@/lib/occupations/import/onet'
import { parseOewsNational, parseProjections } from '@/lib/occupations/import/bls'

// Synthetic rows laid out like the real files (headers as published, values invented).
const tsv = (...lines: string[]) => lines.join('\n') + '\n'

const OCCUPATION_DATA = tsv(
  'O*NET-SOC Code\tTitle\tDescription',
  '11-2021.00\tMarketing Managers\tPlan, direct, or coordinate marketing policies.',
  '11-9051.00\tFood Service Managers\tPlan, direct, or coordinate food service.',
  '15-2051.00\tData Scientists\tDevelop and implement data methods.',
  '43-6014.00\tSecretaries and Administrative Assistants\tPerform clerical work.'
)
const JOB_ZONES = tsv(
  'O*NET-SOC Code\tJob Zone\tDate\tDomain Source',
  '11-2021.00\t4\t08/2024\tAnalyst',
  '11-9051.00\t3\t08/2024\tAnalyst',
  '15-2051.00\t5\t08/2024\tAnalyst',
  '43-6014.00\t2\t08/2024\tAnalyst'
)
const SKILLS = tsv(
  'O*NET-SOC Code\tElement ID\tElement Name\tScale ID\tScale Name\tData Value\tN\tStandard Error\tLower CI Bound\tUpper CI Bound\tRecommend Suppress\tNot Relevant\tDate\tDomain Source',
  '11-2021.00\t2.A.2.a\tCritical Thinking\tIM\tImportance\t4.12\t8\t0.2\t3.7\t4.5\tN\tn/a\t08/2024\tAnalyst',
  '11-2021.00\t2.A.2.a\tCritical Thinking\tLV\tLevel\t4.88\t8\t0.2\t4.4\t5.3\tN\tN\t08/2024\tAnalyst',
  '11-2021.00\t2.B.1.a\tSocial Perceptiveness\tIM\tImportance\t3.0\t8\t0.2\t2.6\t3.4\tY\tn/a\t08/2024\tAnalyst',
  '11-2021.00\t2.B.1.a\tSocial Perceptiveness\tLV\tLevel\t3.1\t8\t0.2\t2.7\t3.5\tY\tN\t08/2024\tAnalyst',
  '11-2021.00\t2.A.1.a\tReading Comprehension\tIM\tImportance\t4.0\t8\t0.2\t3.6\t4.4\tN\tn/a\t08/2024\tAnalyst',
  '15-2051.00\t2.A.2.a\tCritical Thinking\tIM\tImportance\t4.4\t8\t0.2\t4.0\t4.8\tN\tn/a\t08/2024\tAnalyst',
  '15-2051.00\t2.A.2.a\tCritical Thinking\tLV\tLevel\t5.4\t8\t0.2\t5.0\t5.8\tN\tN\t08/2024\tAnalyst',
  '11-9051.00\t2.A.2.a\tCritical Thinking\tIM\tImportance\t3.5\t8\t0.2\t3.1\t3.9\tN\tn/a\t08/2024\tAnalyst',
  '11-9051.00\t2.A.2.a\tCritical Thinking\tLV\tLevel\t4.0\t8\t0.2\t3.6\t4.4\tN\tN\t08/2024\tAnalyst'
)
const TECH = tsv(
  'O*NET-SOC Code\tExample\tCommodity Code\tCommodity Title\tHot Technology\tIn Demand',
  '11-2021.00\tHubSpot\t43232310\tCustomer relationship management CRM software\tY\tY',
  '11-2021.00\tHubSpot\t43232201\tContent management system software\tN\tN',
  '11-2021.00\tMicrosoft Excel\t43232110\tSpreadsheet software\tN\tY',
  '11-9051.00\tToast POS\t43232304\tPoint of sale software\tN\tN'
)
const ALT = tsv(
  'O*NET-SOC Code\tAlternate Title\tShort Title\tSource(s)',
  '11-2021.00\tMarketing Directors\t\t09',
  '11-2021.00\tMarketing Director\t\t09',
  '11-2021.00\tBrand Manager\t\t09',
  '11-9051.00\tRestaurant Manager\t\t09'
)
const RELATED = tsv(
  'O*NET-SOC Code\tRelated O*NET-SOC Code\tRelatedness Tier\tIndex',
  '11-2021.00\t15-2051.00\tPrimary-Short\t1',
  '11-2021.00\t11-9051.00\tSupplemental\t2',
  '11-2021.00\t15-2051.00\tPrimary-Long\t3'
)

describe('delimited', () => {
  it('reads tab and comma files, quoted fields, a BOM and CRLF', () => {
    expect(parseTable('a\tb\r\n1\t2\r\n').rows).toEqual([['1', '2']])
    const t = parseTable('﻿name,note\n"Smith, J","said ""hi""\nthere"\n')
    expect(t.header).toEqual(['name', 'note'])
    expect(t.rows).toEqual([['Smith, J', 'said "hi"\nthere']])
  })
  it('skips title rows above the header', () => {
    const t = parseTable('Table 1.2,,\nnotes,,\nOccupation Code,Value\n11-2021,5\n', { headerStartsWith: /^occupation code$/i })
    expect(t.header).toEqual(['Occupation Code', 'Value'])
    expect(t.rows).toEqual([['11-2021', '5']])
  })
  it('fails on a missing column and lists the headers found', () => {
    const t = parseTable('a,b\n1,2\n')
    expect(() => resolveColumns(t, { x: { match: ['Nope'] } }, 'Test file')).toThrow(/Test file: no column found for x\. Headers present: a \| b/)
    expect(resolveColumns(t, { x: { match: ['Nope'], optional: true }, b: { match: ['B'] } }, 'f')).toEqual({ x: -1, b: 1 })
  })
  it('reads numbers and treats suppression markers as null', () => {
    expect(numberOrNull('1,234.5')).toBe(1234.5)
    for (const v of ['', '*', '**', '#', 'x']) expect(numberOrNull(v)).toBeNull()
  })
})

describe('O*NET parsers', () => {
  it('reads occupations and job zones', () => {
    expect(parseOccupationData(OCCUPATION_DATA)[0]).toEqual({ onetSocCode: '11-2021.00', socCode: '11-2021', title: 'Marketing Managers', description: 'Plan, direct, or coordinate marketing policies.' })
    expect(parseJobZones(JOB_ZONES).get('15-2051.00')).toBe(5)
  })
  it('pairs importance with level and drops suppressed, unpaired and not-relevant elements', () => {
    const rows = parseElements(SKILLS, 'SKILL')
    const marketing = rows.filter((r) => r.onetSocCode === '11-2021.00')
    expect(marketing).toEqual([{ onetSocCode: '11-2021.00', kind: 'SKILL', elementId: '2.A.2.a', elementName: 'Critical Thinking', importance: 4.12, level: 4.88 }])
    // Social Perceptiveness is suppressed; Reading Comprehension has no level row.
    expect(rows).toHaveLength(3)
  })
  it('merges a technology listed under several commodities, keeping its hot flag', () => {
    const rows = parseTechnologySkills(TECH).filter((r) => r.onetSocCode === '11-2021.00')
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.example === 'HubSpot')).toMatchObject({ hotTechnology: true, inDemand: true })
    expect(rows.find((r) => r.example === 'Microsoft Excel')).toMatchObject({ hotTechnology: false, inDemand: true })
  })
  it('normalises alternate titles and collapses ones that normalise alike', () => {
    const rows = parseAlternateTitles(ALT).filter((r) => r.onetSocCode === '11-2021.00')
    expect(rows.map((r) => r.normalizedTitle)).toEqual(['marketing director', 'brand manager'])
  })
  it('keeps one row per related pair', () => {
    const rows = parseRelatedOccupations(RELATED)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ onetSocCode: '11-2021.00', relatedOnetSocCode: '15-2051.00', tier: 'Primary-Short', relatedIndex: 1 })
  })
  it('flags in-scope occupations and writes child rows only for them', () => {
    const imp = buildOnetImport({ occupationData: OCCUPATION_DATA, jobZones: JOB_ZONES, skills: SKILLS, technologySkills: TECH, alternateTitles: ALT, relatedOccupations: RELATED })
    expect(imp.occupations.filter((o) => o.isTarget).map((o) => o.title)).toEqual(['Marketing Managers', 'Data Scientists'])
    expect(imp.occupations).toHaveLength(4) // out-of-scope occupations are still listed
    expect(imp.elements.every((e) => ['11-2021.00', '15-2051.00'].includes(e.onetSocCode))).toBe(true)
    expect(imp.techSkills.map((t) => t.example)).not.toContain('Toast POS')
    expect(imp.altTitles.map((t) => t.title)).not.toContain('Restaurant Manager')
    // Related links must be in scope on both ends: the link to Food Service Managers is dropped.
    expect(imp.related).toEqual([{ onetSocCode: '11-2021.00', relatedOnetSocCode: '15-2051.00', tier: 'Primary-Short', relatedIndex: 1 }])
  })
  it('imports with only the required files', () => {
    const imp = buildOnetImport({ occupationData: OCCUPATION_DATA, jobZones: JOB_ZONES, skills: SKILLS })
    expect(imp.techSkills).toEqual([])
    expect(imp.related).toEqual([])
  })
  it('stops when a required column is missing', () => {
    expect(() => parseOccupationData('Code\tName\n11-2021.00\tX\n')).toThrow(/Occupation Data: no column found/)
  })
})

const OEWS_HEADER = 'AREA,AREA_TITLE,AREA_TYPE,NAICS,NAICS_TITLE,I_GROUP,OWN_CODE,OCC_CODE,OCC_TITLE,O_GROUP,TOT_EMP,A_PCT10,A_PCT25,A_MEDIAN,A_PCT75,A_PCT90'
const OEWS = [
  OEWS_HEADER,
  '99,U.S.,1,000000,Cross-industry,cross-industry,1235,00-0000,All Occupations,total,150000000,30000,38000,49000,70000,100000',
  '99,U.S.,1,000000,Cross-industry,cross-industry,1235,11-0000,Management Occupations,major,10000000,60000,80000,110000,150000,200000',
  '99,U.S.,1,000000,Cross-industry,cross-industry,1235,11-2021,"Marketing Managers",detailed,"350,000",84000,115000,158280,#,#',
  '99,U.S.,1,000000,Cross-industry,cross-industry,1235,11-1011,Chief Executives,detailed,300000,80000,130000,#,#,#',
  '99,U.S.,1,511000,Publishing,sector,1235,11-2021,Marketing Managers,detailed,9000,90000,120000,170000,200000,#',
  '99,U.S.,1,000000,Cross-industry,cross-industry,1235,15-2051,Data Scientists,detailed,**,*,95000,112590,150000,190000',
].join('\n')

describe('parseOewsNational', () => {
  it('keeps detailed, cross-industry rows and reads figures with commas', () => {
    const rows = parseOewsNational(OEWS)
    expect(rows.map((r) => r.socCode).sort()).toEqual(['11-1011', '11-2021', '15-2051'])
    expect(rows.find((r) => r.socCode === '11-2021')).toMatchObject({ employment: 350000, wageMedian: 158280, topCoded: false })
  })
  it('does not take an industry row for the occupation', () => {
    expect(parseOewsNational(OEWS).find((r) => r.socCode === '11-2021')!.wageMedian).toBe(158280)
  })
  it('marks a "#" median top-coded and stores no median unless the ceiling is given', () => {
    const ceo = parseOewsNational(OEWS).find((r) => r.socCode === '11-1011')!
    expect(ceo).toMatchObject({ topCoded: true, wageMedian: null })
    expect(parseOewsNational(OEWS, { topCodeAnnual: 239200 }).find((r) => r.socCode === '11-1011')).toMatchObject({ topCoded: true, wageMedian: 239200 })
  })
  it('reads withheld figures as null', () => {
    expect(parseOewsNational(OEWS).find((r) => r.socCode === '15-2051')).toMatchObject({ employment: null, wageP10: null, wageMedian: 112590 })
  })
  it('stops when the pay columns are missing', () => {
    expect(() => parseOewsNational('OCC_CODE,TOT_EMP\n11-2021,5\n')).toThrow(/OEWS national: no column found/)
  })
})

const PROJ = [
  'Table 1.2 Occupational projections,,,,,,,,',
  'Updated 2025,,,,,,,,',
  'Occupation Title,Occupation Code,Occupation Type,"Employment, 2024","Employment, 2034",Employment Change 2024-34,Employment Percent Change 2024-34,Occupational Openings 2024-34 Annual Average,Typical Entry-Level Education',
  'Total all occupations,00-0000,Summary,"167,000.0","174,000.0",7000,4.2,"18,000.0",',
  'Marketing managers,11-2021,Line item,"350.0","366.3",16.3,4.7,"31.0",Bachelor\'s degree',
  'Management occupations,11-0000,Summary,"10,000.0","10,500.0",500,5.0,"1,000.0",',
].join('\n')

describe('parseProjections', () => {
  it('skips title rows and summary rows, and scales thousands to people', () => {
    const rows = parseProjections(PROJ)
    expect(rows).toEqual([
      { socCode: '11-2021', baseYear: 2024, projectedYear: 2034, employmentBase: 350000, employmentProj: 366300, changePct: 4.7, annualOpenings: 31000, typicalEducation: "Bachelor's degree" },
    ])
  })
  it('stops when the year columns are not there', () => {
    expect(() => parseProjections('Occupation Code,Employment\n11-2021,5\n')).toThrow(/two years/)
  })
})
