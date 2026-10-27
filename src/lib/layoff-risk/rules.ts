import { AEI_OBSERVED_EXPOSURE, AEI_SOURCE } from '@/lib/market/aei-observed-exposure'

// The layoff risk check. It counts warning signs; it does not predict. Each sign is a fact about the person's employer, industry or
// kind of work that this site can check against its own records, with the threshold written down here. The thresholds are our judgment,
// NOT a statistical model: nobody has validated them against who was actually laid off, and the page says so. Pure, so every rule is tested.
//
// What was considered and left out (docs/PATTERN_LAYOFFS.md): tenure (no source ties it to being laid off today), company size as a score
// (WARN covers only employers of 100 or more, so small employers are simply invisible in our record), and anything a person could not
// check for themselves.

export const RISK_AS_OF_NOTE = 'Employer and industry signs use WARN notices filed in the last 12 months and announcements in the last 12 months.'

export type RiskSignal = 'low' | 'watch' | 'high'

export const SIZE_BANDS = [
  { key: 'u100', label: 'Under 100' },
  { key: '100-499', label: '100 to 499' },
  { key: '500-4999', label: '500 to 4,999' },
  { key: '5000+', label: '5,000 or more' },
] as const
export type SizeBand = (typeof SIZE_BANDS)[number]['key']

/** SOC 2018 major groups (BLS) with the plain-average observed AI exposure from the Anthropic Economic Index file the repo carries. */
export const ROLE_FAMILIES: { code: string; label: string }[] = [
  { code: '11', label: 'Management' },
  { code: '13', label: 'Business and financial operations (finance, HR, operations, marketing analysts)' },
  { code: '15', label: 'Computer and mathematical (software, data, IT)' },
  { code: '17', label: 'Architecture and engineering' },
  { code: '19', label: 'Life, physical and social science' },
  { code: '21', label: 'Community and social service' },
  { code: '23', label: 'Legal' },
  { code: '25', label: 'Education, training and library' },
  { code: '27', label: 'Arts, design, entertainment and media' },
  { code: '29', label: 'Healthcare practitioners and technical' },
  { code: '41', label: 'Sales and related' },
  { code: '43', label: 'Office and administrative support' },
]

/** Observed exposure at or above this is called high in the check. Five groups reach it (business and financial 0.18, computer and math 0.38, legal 0.22, sales 0.24, office and administrative 0.19); the plain average of the 22 groups is about 0.09. */
export const HIGH_AI_EXPOSURE = 0.15
/** Employer signs. */
export const MIN_RECENT_MONTHS_FOR_REPEAT = 2
/** Industry sign: notices in the last 6 months must be at least this multiple of the 6 months before, and the industry needs this many notices in 12 months. */
export const INDUSTRY_RISE_RATIO = 1.25
export const INDUSTRY_MIN_NOTICES = 20

export interface EmployerFacts {
  name: string
  slug: string
  /** WARN notices filed in the last 12 months. */
  recentNotices: number
  /** Distinct calendar months with a filing in the last 12 months. */
  recentMonths: number
  /** Latest filing, ISO date. */
  latest: string | null
  /** An announcement or reported layoff in the last 12 months. */
  announcedRecently: boolean
}

export interface IndustryTrend {
  bucket: string
  last6: number
  prior6: number
}

export interface RiskInput {
  employer: EmployerFacts | null
  size: SizeBand | null
  industry: IndustryTrend | null
  roleCode: string | null
}

export interface RiskSign {
  key: 'employer_filed' | 'employer_repeat' | 'employer_announced' | 'industry_rising' | 'role_exposed'
  group: 'employer' | 'industry' | 'work'
  applies: boolean
  /** What was checked, in plain words. */
  label: string
  /** The fact behind the answer. */
  detail: string
}

export interface RiskResult {
  signal: RiskSignal
  signs: RiskSign[]
  /** One plain sentence on why the signal is what it is. */
  why: string
  /** Things the check could not see, to show next to the result. */
  limits: string[]
}

export function roleExposure(code: string | null): number | null {
  return code && AEI_OBSERVED_EXPOSURE[code] ? AEI_OBSERVED_EXPOSURE[code].exposure : null
}

export function industryRising(t: IndustryTrend | null): boolean {
  return !!t && t.last6 + t.prior6 >= INDUSTRY_MIN_NOTICES && t.last6 >= INDUSTRY_RISE_RATIO * Math.max(t.prior6, 1)
}

export function assessRisk(input: RiskInput): RiskResult {
  const { employer, industry, roleCode } = input
  const exposure = roleExposure(roleCode)
  const role = ROLE_FAMILIES.find((r) => r.code === roleCode)

  const signs: RiskSign[] = [
    {
      key: 'employer_filed',
      group: 'employer',
      applies: !!employer && employer.recentNotices >= 1,
      label: 'Your employer filed a WARN layoff notice in the last 12 months',
      detail: !employer
        ? 'No employer chosen, so this could not be checked.'
        : employer.recentNotices >= 1
          ? `${employer.name} filed ${employer.recentNotices} notice${employer.recentNotices === 1 ? '' : 's'}, the latest on ${employer.latest ?? 'a date we have on file'}.`
          : `${employer.name} has no notice in the last 12 months on our record.`,
    },
    {
      key: 'employer_repeat',
      group: 'employer',
      applies: !!employer && employer.recentMonths >= MIN_RECENT_MONTHS_FOR_REPEAT,
      label: `Your employer filed in ${MIN_RECENT_MONTHS_FOR_REPEAT} or more different months`,
      detail: !employer
        ? 'No employer chosen, so this could not be checked.'
        : `${employer.name} filed in ${employer.recentMonths} different month${employer.recentMonths === 1 ? '' : 's'} of the last 12.`,
    },
    {
      key: 'employer_announced',
      group: 'employer',
      applies: !!employer && employer.announcedRecently,
      label: 'Your employer announced or was reported to have cut jobs or offered buyouts in the last 12 months',
      detail: !employer
        ? 'No employer chosen, so this could not be checked.'
        : employer.announcedRecently
          ? `We hold an announcement or press report for ${employer.name} from the last 12 months. It may not be a WARN filing.`
          : `No announcement for ${employer.name} in the last 12 months on our record.`,
    },
    {
      key: 'industry_rising',
      group: 'industry',
      applies: industryRising(industry),
      label: 'WARN notices in your industry are rising',
      detail: !industry
        ? 'No industry chosen, so this could not be checked.'
        : `${industry.bucket}: ${industry.last6} notices in the last 6 months against ${industry.prior6} in the 6 months before.${industry.last6 + industry.prior6 < INDUSTRY_MIN_NOTICES ? ` Too few notices (under ${INDUSTRY_MIN_NOTICES} in 12 months) to call a trend.` : ''}`,
    },
    {
      key: 'role_exposed',
      group: 'work',
      applies: exposure != null && exposure >= HIGH_AI_EXPOSURE,
      label: 'Your kind of work has high observed AI exposure',
      detail: exposure == null || !role
        ? 'No kind of work chosen, so this could not be checked.'
        : `${role.label.split(' (')[0]}: observed exposure ${(exposure * 100).toFixed(0)}% of tasks on average (${AEI_SOURCE.title}, ${AEI_SOURCE.published}). That is how much of the work AI could speed up and is used for, not how many jobs will go.`,
    },
  ]

  const has = (k: RiskSign['key']) => signs.find((s) => s.key === k)!.applies
  const employerSigns = signs.filter((s) => s.group === 'employer' && s.applies).length
  const otherSigns = signs.filter((s) => s.group !== 'employer' && s.applies).length

  let signal: RiskSignal = 'low'
  if (has('employer_filed') && (has('employer_repeat') || has('employer_announced'))) signal = 'high'
  else if (employerSigns >= 1 || otherSigns >= 2) signal = 'watch'

  const why =
    signal === 'high'
      ? 'Your employer has filed a notice and shows another sign of ongoing cuts (filings in more than one month, or an announcement).'
      : signal === 'watch'
        ? employerSigns >= 1
          ? 'Your employer shows at least one sign of cuts in the last 12 months.'
          : 'Both your industry and your kind of work show a sign, though your employer does not.'
        : 'None of the checks that could be run on your employer pointed to recent cuts, and at most one industry or work sign applies.'

  const limits = [
    'It cannot see your team, your manager, your company’s finances or what leaders have said inside the company. Those matter more than anything here.',
    'A notice names one site. A large employer with many sites files often, and a notice at another site, in another state or in another part of the company may never touch your team.',
    'WARN notices cover employers with 100 or more employees and layoffs of 50 or more at a site, so a smaller layoff leaves no notice and a smaller employer leaves none at all.',
    'A state may publish late or leave out worker counts, so no notice on file does not mean no layoff.',
    'The thresholds are our judgment and have not been tested against who was actually laid off. Treat the result as a prompt to prepare, not a forecast about you.',
  ]
  if (input.size === 'u100') limits.unshift('Employers under 100 employees are not covered by the federal WARN Act, so our record cannot show them. The employer signs above will read as clear for that reason, not because it is safe.')

  return { signal, signs, why, limits }
}

export const SIGNAL_LABEL: Record<RiskSignal, string> = { low: 'Low', watch: 'Watch', high: 'High' }
