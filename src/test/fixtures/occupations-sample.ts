import { isTargetOccupation, toSocCode } from '@/lib/occupations/target-occupations'
import type { ElementKind, OccupationElement, OccupationProfile, OccupationTechSkill } from '@/lib/occupations/types'

// SYNTHETIC test data, not O*NET. The occupations, SOC codes and titles are real
// categories, but every score below is invented for the tests: the importance and
// level numbers only need to make related occupations look related. Element ids are
// invented too (the real import uses O*NET's own ids). Never show these as real figures.

const ELEMENT_NAMES: Record<string, [ElementKind, string]> = {
  critical_thinking: ['SKILL', 'Critical thinking'],
  active_listening: ['SKILL', 'Active listening'],
  writing: ['SKILL', 'Writing'],
  persuasion: ['SKILL', 'Persuasion'],
  negotiation: ['SKILL', 'Negotiation'],
  mgmt_financial: ['SKILL', 'Management of financial resources'],
  mgmt_personnel: ['SKILL', 'Management of personnel resources'],
  mathematics: ['SKILL', 'Mathematics'],
  programming: ['SKILL', 'Programming'],
  sales_marketing: ['KNOWLEDGE', 'Sales and marketing'],
  economics_accounting: ['KNOWLEDGE', 'Economics and accounting'],
  computers: ['KNOWLEDGE', 'Computers and electronics'],
  personnel_hr: ['KNOWLEDGE', 'Personnel and human resources'],
  analyzing_data: ['ACTIVITY', 'Analyzing data or information'],
  developing_strategies: ['ACTIVITY', 'Developing objectives and strategies'],
}

/** `scores` maps element id -> [importance 1-5, level 0-7]. */
function occ(
  onetSocCode: string,
  title: string,
  jobZone: number | null,
  scores: Record<string, [number, number]>,
  tech: (string | [string, 'hot'])[]
): OccupationProfile {
  const socCode = toSocCode(onetSocCode)!
  const elements: OccupationElement[] = Object.entries(scores).map(([id, [importance, level]]) => {
    const [kind, name] = ELEMENT_NAMES[id]
    return { kind, elementId: id, name, importance, level }
  })
  const techSkills: OccupationTechSkill[] = tech.map((t) =>
    Array.isArray(t) ? { example: t[0], hotTechnology: true } : { example: t, hotTechnology: false }
  )
  return { onetSocCode, socCode, title, jobZone, isTarget: isTargetOccupation(socCode, jobZone), elements, techSkills }
}

export const MARKETING_MANAGERS = occ(
  '11-2021.00', 'Marketing Managers', 4,
  { critical_thinking: [4.1, 5], writing: [3.9, 4.8], persuasion: [4.2, 5], active_listening: [4, 5], mgmt_personnel: [3.6, 4.5], sales_marketing: [4.8, 6], developing_strategies: [4.4, 5.5], analyzing_data: [3.6, 4.5], mathematics: [2.6, 3] },
  [['HubSpot', 'hot'], ['Salesforce', 'hot'], ['Google Analytics', 'hot'], 'Microsoft Excel']
)
export const SALES_MANAGERS = occ(
  '11-2022.00', 'Sales Managers', 4,
  { critical_thinking: [3.9, 5], persuasion: [4.6, 5.5], negotiation: [4.5, 5.5], active_listening: [4.1, 5], mgmt_personnel: [4.1, 5], sales_marketing: [4.9, 6.2], developing_strategies: [4.0, 5], analyzing_data: [3.2, 4], mathematics: [2.8, 3.2] },
  [['Salesforce', 'hot'], 'HubSpot', 'Microsoft Excel', 'Microsoft PowerPoint']
)
export const FINANCIAL_MANAGERS = occ(
  '11-3031.00', 'Financial Managers', 4,
  { critical_thinking: [4.3, 5.3], mgmt_financial: [4.5, 5.6], mgmt_personnel: [3.7, 4.6], mathematics: [3.9, 4.8], economics_accounting: [4.8, 6], analyzing_data: [4.2, 5.2], developing_strategies: [4.0, 5], writing: [3.5, 4.2] },
  [['Microsoft Excel', 'hot'], ['SAP', 'hot'], 'Oracle NetSuite', 'Tableau']
)
export const FINANCIAL_ANALYSTS = occ(
  '13-2051.00', 'Financial and Investment Analysts', 4,
  { critical_thinking: [4.5, 5.4], mathematics: [4.4, 5.2], economics_accounting: [4.7, 5.8], analyzing_data: [4.7, 5.6], writing: [3.6, 4.3], active_listening: [3.5, 4.2], computers: [3.2, 4] },
  [['Microsoft Excel', 'hot'], ['Tableau', 'hot'], 'SQL', 'Bloomberg Terminal']
)
export const DATA_SCIENTISTS = occ(
  '15-2051.00', 'Data Scientists', 5,
  { critical_thinking: [4.4, 5.4], mathematics: [4.8, 6], programming: [4.6, 5.8], analyzing_data: [4.9, 6], computers: [4.6, 5.8], writing: [3.3, 4], active_listening: [3.4, 4] },
  [['Python', 'hot'], ['SQL', 'hot'], ['R', 'hot'], 'Tableau', 'Snowflake']
)
export const MARKET_RESEARCH_ANALYSTS = occ(
  '13-1161.00', 'Market Research Analysts and Marketing Specialists', 4,
  { critical_thinking: [4.2, 5], writing: [4.1, 5], mathematics: [3.8, 4.6], sales_marketing: [4.2, 5.2], analyzing_data: [4.6, 5.6], persuasion: [3.2, 4], computers: [3.0, 3.8] },
  [['Google Analytics', 'hot'], ['Tableau', 'hot'], 'SQL', 'Microsoft Excel']
)
export const HR_MANAGERS = occ(
  '11-3121.00', 'Human Resources Managers', 4,
  { critical_thinking: [4.0, 5], active_listening: [4.5, 5.6], mgmt_personnel: [4.6, 5.8], personnel_hr: [4.9, 6.2], negotiation: [3.9, 4.8], developing_strategies: [3.8, 4.8], writing: [3.7, 4.5] },
  [['Workday', 'hot'], 'ADP Workforce Now', 'Microsoft Excel']
)
export const GENERAL_OPS_MANAGERS = occ(
  '11-1021.00', 'General and Operations Managers', 4,
  { critical_thinking: [4.1, 5.2], mgmt_personnel: [4.3, 5.3], mgmt_financial: [3.8, 4.8], developing_strategies: [4.2, 5.2], active_listening: [4.0, 5], negotiation: [3.6, 4.5] },
  ['SAP', 'Microsoft Excel', 'Salesforce', 'Microsoft Project']
)
// Out of scope on purpose: a Job Zone below 4, and a clerical occupation.
export const FOOD_SERVICE_MANAGERS = occ(
  '11-9051.00', 'Food Service Managers', 3,
  { active_listening: [3.8, 4.5], mgmt_personnel: [3.9, 4.8], mgmt_financial: [3.2, 4] },
  ['Microsoft Excel', 'Toast POS', 'OpenTable']
)
export const SECRETARIES = occ(
  '43-6014.00', 'Secretaries and Administrative Assistants', 2,
  { active_listening: [3.5, 4], writing: [3.2, 3.8] },
  ['Microsoft Outlook', 'Microsoft Word', 'Microsoft Excel']
)
// Too few named tools to judge a tools fit.
export const SPARSE_TOOLS_OCCUPATION = occ(
  '23-1011.00', 'Lawyers', 5,
  { critical_thinking: [4.6, 5.6], writing: [4.8, 6], persuasion: [4.4, 5.4] },
  ['Westlaw', 'LexisNexis']
)

export const ALL_OCCUPATIONS: OccupationProfile[] = [
  MARKETING_MANAGERS, SALES_MANAGERS, FINANCIAL_MANAGERS, FINANCIAL_ANALYSTS, DATA_SCIENTISTS,
  MARKET_RESEARCH_ANALYSTS, HR_MANAGERS, GENERAL_OPS_MANAGERS, FOOD_SERVICE_MANAGERS, SECRETARIES, SPARSE_TOOLS_OCCUPATION,
]
export const TARGET_OCCUPATIONS = ALL_OCCUPATIONS.filter((o) => o.isTarget)

export const ALT_TITLES: { onetSocCode: string; title: string }[] = [
  { onetSocCode: '11-2021.00', title: 'Marketing Director' },
  { onetSocCode: '11-2021.00', title: 'Brand Manager' },
  { onetSocCode: '11-2021.00', title: 'Digital Marketing Manager' },
  { onetSocCode: '11-2022.00', title: 'Sales Director' },
  { onetSocCode: '11-2022.00', title: 'Regional Sales Manager' },
  { onetSocCode: '11-3031.00', title: 'Controller' },
  { onetSocCode: '11-3031.00', title: 'Finance Manager' },
  { onetSocCode: '11-3031.00', title: 'Finance Director' },
  { onetSocCode: '13-2051.00', title: 'Financial Analyst' },
  { onetSocCode: '13-2051.00', title: 'Business Analyst' },
  { onetSocCode: '13-1161.00', title: 'Marketing Analyst' },
  { onetSocCode: '13-1161.00', title: 'Marketing Research Analyst' },
  { onetSocCode: '13-1161.00', title: 'Business Analyst' },
  { onetSocCode: '15-2051.00', title: 'Machine Learning Scientist' },
  { onetSocCode: '11-3121.00', title: 'HR Manager' },
  { onetSocCode: '11-3121.00', title: 'Human Resources Director' },
  { onetSocCode: '11-1021.00', title: 'General Manager' },
  { onetSocCode: '11-1021.00', title: 'Operations Manager' },
]
