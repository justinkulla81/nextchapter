// The WARN Act facts the layoff pages state, in one place, each with its source and the date it was read. A figure or rule is
// stated on a page only if it is here. docs/PATTERN_LAYOFFS.md lists what was left out for lack of a source.
//
// Federal text is quoted from the Legal Information Institute (Cornell) copies of 29 U.S.C. and 20 C.F.R., which reproduce the
// official text; the official sources are the U.S. Code (uscode.house.gov) and the eCFR (ecfr.gov), which block automated
// readers, so the copy was used. Re-read these before the next edition of the pages.

export const WARN_GUIDE_AS_OF = '2026-10-27'

export interface WarnSource {
  label: string
  url: string
  /** What the source was used for. */
  for: string
}

export const WARN_SOURCES = {
  statute101: { label: '29 U.S.C. § 2101 (definitions)', url: 'https://www.law.cornell.edu/uscode/text/29/2101', for: 'who is an employer; plant closing; mass layoff; part-time employee; employment loss' },
  statute102: { label: '29 U.S.C. § 2102 (notice)', url: 'https://www.law.cornell.edu/uscode/text/29/2102', for: '60-day notice, who receives it, the three exceptions, 90-day aggregation' },
  statute104: { label: '29 U.S.C. § 2104 (enforcement)', url: 'https://www.law.cornell.edu/uscode/text/29/2104', for: 'back pay and benefits up to 60 days, the $500-a-day penalty, who may sue, good-faith reduction' },
  cfr639_5: { label: '20 C.F.R. § 639.5 (when notice is required)', url: 'https://www.law.cornell.edu/cfr/text/20/639.5', for: '60 calendar days; staggered terminations; strikes and lockouts' },
  cfr639_7: { label: '20 C.F.R. § 639.7 (content of notice)', url: 'https://www.law.cornell.edu/cfr/text/20/639.7', for: 'written, specific notice; what each recipient must be told' },
  cfr639_9: { label: '20 C.F.R. § 639.9 (shortened notice)', url: 'https://www.law.cornell.edu/cfr/text/20/639.9', for: 'the burden is on the employer; as much notice as practicable; narrow reading of each exception' },
  dolWarn: { label: 'U.S. Department of Labor, WARN Act compliance assistance', url: 'https://www.dol.gov/agencies/eta/layoffs/warn', for: 'the federal contact; courts enforce the Act' },
  ca: { label: 'California EDD, Worker Adjustment and Retraining Notification (WARN)', url: 'https://edd.ca.gov/en/jobs_and_training/layoff_services_warn', for: 'California rules' },
  nj: { label: 'New Jersey WARN Act, 2023 amended text (NJ Department of Labor)', url: 'https://www.nj.gov/labor/assets/PDFs/WARN/NJ_WARN_ACT_2023law.pdf', for: 'New Jersey rules' },
  njBusiness: { label: 'NJ Business Services, important updates to employee rights under New Jersey WARN law', url: 'https://business.nj.gov/updates/important-updates-to-employee-rights-under-new-jersey-warn-law', for: 'New Jersey rules in plain terms' },
  ny: { label: 'New York State Department of Labor, Worker Adjustment and Retraining Notification (WARN)', url: 'https://dol.ny.gov/worker-adjustment-and-retraining-notification-warn', for: 'New York rules' },
  nyFactSheet: { label: 'New York State Department of Labor, WARN Act fact sheet (P483, October 2024)', url: 'https://it.dol.ny.gov/system/files/documents/2024/12/p483_warn-act-fact-sheet-10_24.pdf', for: 'New York rules' },
  il: { label: 'Illinois Department of Labor, Worker Adjustment and Retraining Notification Act', url: 'https://labor.illinois.gov/laws-rules/conmed/warn.html', for: 'Illinois rules' },
  ilStatute: { label: 'Illinois Compiled Statutes, WARN Act (820 ILCS 65)', url: 'http://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=2617&ChapterID=68', for: 'Illinois rules' },
  me: { label: 'Maine Revised Statutes, 26 M.R.S. § 625-B (severance pay and notice: closing, substantial shutdown or relocation)', url: 'https://legislature.maine.gov/statutes/26/title26sec625-B.html', for: 'Maine rules' },
  ia: { label: 'Iowa Code § 84C.3 (notice) and chapter 84C, WARN Act', url: 'https://www.legis.iowa.gov/docs/code/84C.3.pdf', for: 'Iowa rules' },
  md: { label: 'Maryland Labor and Employment Article §§ 11-301 to 11-306 (Economic Stabilization Act)', url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gle&section=11-301&enactments=false', for: 'Maryland rules' },
  mdFaq: { label: 'Maryland Department of Labor, Economic Stabilization Act frequently asked questions', url: 'https://labor.maryland.gov/employment/dwdal-esa-frequently-asked-questions.shtml', for: 'Maryland rules' },
  nh: { label: 'New Hampshire RSA chapter 275-F (Worker Adjustment and Retraining Notification Act)', url: 'https://www.gencourt.state.nh.us/rsa/html/XXIII/275-F/275-F-mrg.htm', for: 'New Hampshire rules' },
  vt: { label: '21 V.S.A. § 413 (Notice of Potential Layoffs Act: notice)', url: 'https://legislature.vermont.gov/statutes/section/21/005/00413', for: 'Vermont rules' },
  vtLiability: { label: '21 V.S.A. § 415 (Notice of Potential Layoffs Act: liability)', url: 'https://legislature.vermont.gov/statutes/section/21/005/00415', for: 'Vermont rules' },
  de: { label: 'Delaware Code, Title 19, Chapter 19 (Delaware WARN Act)', url: 'https://delcode.delaware.gov/title19/c019/index.html', for: 'Delaware rules' },
  wa: { label: 'Washington Employment Security Department, "Washington state expands federal WARN Act requirements and penalties"', url: 'https://esd.wa.gov/about-us/blog/2025/washington-state-expands-federal-warn-act-requirements-and-penalties', for: 'Washington rules' },
} as const satisfies Record<string, WarnSource>

export type WarnSourceKey = keyof typeof WARN_SOURCES

/** The federal rule in short facts. Each line names the sources that back it. */
export const FEDERAL_WARN = {
  coverage: {
    text: 'An employer is covered if it has 100 or more employees, not counting part-time employees, or 100 or more employees who together work at least 4,000 hours a week, not counting overtime.',
    sources: ['statute101'] as WarnSourceKey[],
  },
  plantClosing: {
    text: 'A plant closing is a permanent or temporary shutdown of a single site, or of operating units within it, that costs 50 or more employees their jobs during any 30-day period, not counting part-time employees.',
    sources: ['statute101'] as WarnSourceKey[],
  },
  massLayoff: {
    text: 'A mass layoff is a reduction in force that is not a plant closing and costs, at a single site in any 30-day period, at least 33% of the employees and at least 50 employees, or at least 500 employees.',
    sources: ['statute101'] as WarnSourceKey[],
  },
  partTime: {
    text: 'For the counts above, a part-time employee averages fewer than 20 hours a week or has worked fewer than 6 of the 12 months before notice is due.',
    sources: ['statute101'] as WarnSourceKey[],
  },
  employmentLoss: {
    text: 'An employment loss is a firing other than for cause, a layoff of more than 6 months, or a cut in hours of more than 50% in each month of a 6-month period. A voluntary departure or retirement is not an employment loss.',
    sources: ['statute101'] as WarnSourceKey[],
  },
  notice: {
    text: 'The employer must give written notice at least 60 days before a plant closing or mass layoff. It goes to the employees (or their representative), to the State or its rapid-response unit, and to the chief elected official of the local government.',
    sources: ['statute102', 'cfr639_5'] as WarnSourceKey[],
  },
  aggregation: {
    text: 'Smaller cuts at one site in a 90-day period that add up past the threshold count together, unless the employer shows they came from separate causes and were not meant to avoid the Act.',
    sources: ['statute102'] as WarnSourceKey[],
  },
  content: {
    text: 'The notice must be specific. Written notice to an employee with no representative must give a company contact, say whether the action is permanent or temporary, and give the start date and the employee’s own separation date.',
    sources: ['cfr639_7'] as WarnSourceKey[],
  },
  exceptions: {
    text: 'Notice can be shorter in three cases: a faltering company (plant closings only) actively seeking money that notice would have cost it, an unforeseeable business circumstance, or a natural disaster. The employer must still give as much notice as practicable and a short statement of why, and it must prove the exception applies. Courts and the rules read each one narrowly.',
    sources: ['statute102', 'cfr639_9'] as WarnSourceKey[],
  },
  remedy: {
    text: 'An employer that skips required notice owes each affected employee back pay for each day of the violation, up to 60 days, plus the benefits they would have had, including medical expenses. Employees, their representatives and local governments may sue in federal court, and a court may award attorney’s fees. Liability can be reduced for good faith and for pay the employer actually made.',
    sources: ['statute104'] as WarnSourceKey[],
  },
  penalty: {
    text: 'An employer that does not notify the local government can face a civil penalty of up to $500 a day, which does not apply if it pays each employee within 3 weeks of ordering the shutdown or layoff.',
    sources: ['statute104'] as WarnSourceKey[],
  },
  sale: {
    text: 'In a sale of a business, the seller gives notice up to the sale and the buyer after it; the seller’s employees who are not part-time become the buyer’s employees at the sale.',
    sources: ['statute101'] as WarnSourceKey[],
  },
  transfer: {
    text: 'A closing or layoff is not an employment loss if, before it, the employer offers a transfer within reasonable commuting distance, or anywhere with no more than a 6-month break, and for a distant offer the employee accepts within 30 days.',
    sources: ['statute101'] as WarnSourceKey[],
  },
  enforcement: {
    text: 'Federal courts enforce the Act: the Department of Labor’s own page says the federal court solely enforces it. A federal court cannot stop a plant closing or mass layoff under the Act, and the remedies in the Act are the only ones it provides.',
    sources: ['dolWarn', 'statute104'] as WarnSourceKey[],
  },
} as const

export interface StateWarnLaw {
  /** Two-letter code. */
  code: string
  name: string
  /** Who is covered and when notice is due, in the state's own terms. */
  summary: string
  /** How it differs from the federal rule. */
  differs: string
  sources: WarnSourceKey[]
  /** Days of notice the state asks for (the longest stated for the employer's notice), for the notice-deadline tool. */
  noticeDays: number
  /** Anything in the sources that disagrees or that was not confirmed. */
  caveat?: string
}

/**
 * States whose rules were read from the state's own statute or labor department pages. Other states have laws too; they are not listed because
 * they were not sourced (docs/PATTERN_LAYOFFS.md). The pages say so and point to the U.S. Department of Labor and each
 * state's labor department.
 */
export const STATE_WARN_LAWS: StateWarnLaw[] = [
  {
    code: 'CA',
    name: 'California',
    summary: 'Employers with 75 or more full- and part-time employees in the preceding 12 months, for a mass layoff of 50 or more employees in a 30-day period, a plant closure or a relocation. Written notice at least 60 days ahead to affected employees, the Employment Development Department, the local workforce area and the local chief elected official.',
    differs: 'Lower employer size (75, counting part-time) and it covers relocations of at least 100 miles. From 2026 the notice must say how the employer will support laid-off workers.',
    sources: ['ca'],
    noticeDays: 60,
  },
  {
    code: 'NJ',
    name: 'New Jersey',
    summary: 'Since the April 10, 2023 amendment, employers with 100 or more employees must give 90 days’ notice, and a mass layoff is 50 or more workers at a worksite. An employer that gives less notice owes each affected employee one week of pay for each full year of service, and four more weeks if notice is short.',
    differs: 'Longer notice (90 days) and mandatory severance pay, neither of which the federal Act has.',
    sources: ['nj', 'njBusiness'],
    noticeDays: 90,
    caveat: 'Some New Jersey Department of Labor pages still describe the earlier 60-day rule. This summary follows the amended statute text. Amendments after those pages were published were not checked.',
  },
  {
    code: 'NY',
    name: 'New York',
    summary: 'Private employers with 50 or more full-time employees in the state must give 90 days’ notice of a plant closing or mass layoff. A mass layoff is at least 25 full-time employees who are at least 33% of the site, or at least 250 employees. Notice goes to affected employees, their representatives, the Department of Labor and local workforce boards.',
    differs: 'Lower employer size (50) and longer notice (90 days), with lower mass-layoff counts.',
    sources: ['ny', 'nyFactSheet'],
    noticeDays: 90,
    caveat: 'The Department’s public pages count full-time employees; its regulation and the State Comptroller’s audit also describe an aggregate-hours test. Check the regulation text for a specific case.',
  },
  {
    code: 'IL',
    name: 'Illinois',
    summary: 'Employers with 75 or more full-time employees (or 75 or more employees working at least 4,000 hours a week) must give 60 days’ written notice to affected employees, their representatives, the Department of Commerce and Economic Opportunity and the local chief elected official. A mass layoff is 25 or more full-time employees who are at least one third of the site, or 250 or more.',
    differs: 'Lower employer size (75) and lower mass-layoff counts than the federal 500.',
    sources: ['il', 'ilStatute'],
    noticeDays: 60,
  },
  {
    code: 'WA',
    name: 'Washington',
    summary: 'Since July 27, 2025, an employer of 50 or more employees in Washington may not order a business closing or a mass layoff of 50 or more employees in a 30-day period until 60 days after written notice to the Employment Security Department and to the affected employees or their representative. The penalty is up to $500 a day, avoidable by paying each employee within three weeks.',
    differs: 'Lower employer size (50), and the notice to the state must include each affected employee’s address.',
    sources: ['wa'],
    noticeDays: 60,
    caveat: 'A second Washington bill (HB 1313) proposed a state WARN Act with extra requirements; whether it passed was not confirmed.',
  },
  {
    code: 'ME',
    name: 'Maine',
    summary: 'Applies to a covered establishment: a facility that employs, or has at any time in the preceding 12 months employed, 100 or more persons. For a closing, the employer must give the director of the Bureau of Labor Standards, the employees and the municipal officers written notice not less than 90 days ahead; the director can waive the employee and municipal notice. Employees with at least 3 years at the establishment who are not fired for cause are owed severance of one week’s pay for each year of service, with partial pay for a partial year.',
    differs: 'Mandatory severance and 90 days’ notice, neither of which the federal Act has. It also covers moving all or substantially all operations 100 or more miles away. For a mass layoff, the employer tells the director as far ahead as practicable and no later than 7 days after the layoff. A notice violation is a civil violation with a fine of $500 a day.',
    sources: ['me'],
    noticeDays: 90,
    caveat: 'The statute text read shows amendments through P.L. 2023, c. 52. Later changes were not checked.',
  },
  {
    code: 'IA',
    name: 'Iowa',
    summary: 'Employers with 25 or more employees, not counting part-time employees. Written notice at least 30 days ahead of a business closing or a mass layoff of 25 or more employees at a single site in a 30-day period, to the affected employees or their representatives and to Iowa Workforce Development. If a collective bargaining agreement sets a different notice period, that period governs.',
    differs: 'A much lower employer size (25) and lower layoff counts than the federal Act, with a shorter notice period (30 days). The penalty stated is a civil penalty of up to $100 a day for violating the notice duty to the department, and the statute says a court may not enjoin a closing or layoff.',
    sources: ['ia'],
    noticeDays: 30,
    caveat: 'Sections 84C.2 to 84C.5 were read. Later sections were not.',
  },
  {
    code: 'MD',
    name: 'Maryland',
    summary: 'Employers with at least 50 employees that operate a business in Maryland (the Economic Stabilization Act). Written notice at least 60 days before a reduction in operations: a relocation or shutdown that cuts the employees at the workplace by at least 25% or 15 employees, whichever is greater, over 3 months. It goes to all employees at the workplace, each exclusive representative, the Division’s dislocated worker unit and the chief elected official of the political subdivision.',
    differs: 'A lower employer size (50) and a different trigger (25% or 15 employees, whichever is greater). The statute sets no severance amount; the Secretary of Labor must issue guidelines on continuing benefits. The Secretary can order compliance and assess a civil penalty of up to $10,000 a day.',
    sources: ['md', 'mdFaq'],
    noticeDays: 60,
  },
  {
    code: 'NH',
    name: 'New Hampshire',
    summary: 'Businesses with 100 or more employees in New Hampshire, not counting part-time employees (or 100 or more employees working at least 3,000 hours a week combined). Written notice at least 60 days ahead of a plant closing (50 or more employees at a site in 30 days) or a mass layoff (250 or more, or 25 or more if they are 33% of the full-time employees), to the affected employees and their representatives, the commissioner of labor, the attorney general and the chief elected official of each municipality where it occurs.',
    differs: 'Notice also goes to the attorney general, and the mass-layoff count can be as low as 25 employees. An employer that skips notice owes each employee back pay and the cost of benefits for up to 60 days or half the days employed, whichever is smaller, and can face a civil penalty of up to $2,500 plus up to $100 per employee for each day of noncompliance.',
    sources: ['nh'],
    noticeDays: 60,
  },
  {
    code: 'VT',
    name: 'Vermont',
    summary: 'Employers with 50 or more full-time employees, or 50 or more part-time employees who each work at least 1,040 hours a year, or a combination of the two. A business closing, or a permanent loss of at least 50 employees at one or more Vermont worksites in a 90-day period, requires notice 45 days ahead to the Secretary of Commerce and Community Development and the Commissioner of Labor, and 30 days ahead to the municipality’s chief elected or administrative officer, the affected employees and any bargaining agent.',
    differs: 'Shorter notice (45 days to the state, 30 days to employees) than the federal Act, with a lower employer size and a 90-day window. An employer that breaks the rule owes each employee one day of severance pay for each day after the first day in the 45-day notice period, up to ten days, plus up to one month of continued medical or dental coverage.',
    sources: ['vt', 'vtLiability'],
    noticeDays: 45,
    caveat: 'Section 415 was amended effective July 1, 2024. Section 417 (penalties) was not read.',
  },
  {
    code: 'DE',
    name: 'Delaware',
    summary: 'Businesses with 100 or more employees, not counting part-time employees (or 100 or more employees working at least 2,000 hours a week combined); governments, school districts and charter schools are excluded. Written notice at least 60 days ahead of a plant closing (50 or more employees), a mass layoff (50 or more at a site if they are 33% of its workforce, or 500 or more) or a relocation of all or substantially all operations 50 or more miles away. It goes to the affected employees and their representatives, the Department of Labor’s WARN Act Administrator and the local workforce development board.',
    differs: 'It covers relocations 50 or more miles away, and the notice must list each planned dislocated worker’s name, job title, home address, phone and email, with general information on payouts, severance, relocation and retirement options. An employer that skips notice owes each employee back pay and the value of benefits for up to 60 days or half the days employed, whichever is smaller.',
    sources: ['de'],
    noticeDays: 60,
    caveat: 'Sections 1901 to 1905 and 1909 were read. Section 1910, section 1911 and part of section 1909 were not.',
  },
]

export const stateWarnLaw = (code: string) => STATE_WARN_LAWS.find((s) => s.code === code.toUpperCase()) ?? null

/** Every source key used by the rules above, deduplicated, in the order first used. */
export function usedSources(): WarnSourceKey[] {
  const seen: WarnSourceKey[] = []
  const add = (k: WarnSourceKey) => { if (!seen.includes(k)) seen.push(k) }
  for (const f of Object.values(FEDERAL_WARN)) f.sources.forEach(add)
  for (const s of STATE_WARN_LAWS) s.sources.forEach(add)
  return seen
}
