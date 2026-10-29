// The clusters of searches the owner watches on the admin "Search queries" page. EDIT THIS LIST to add or change one: each group is a
// plain rule over a row (the search term and the page it landed on). A row can belong to more than one group; rows that match none
// are counted under "Everything else". Rules read the lower-cased term, so write patterns in lower case.

export interface QueryRow {
  query: string
  page: string
}

export interface QueryGroup {
  key: string
  label: string
  /** What the group is for, in a line. Shown under the label. */
  note: string
  matches: (row: QueryRow) => boolean
}

const test = (re: RegExp) => (row: QueryRow) => re.test(row.query.toLowerCase())
const onPath = (re: RegExp) => (row: QueryRow) => re.test(row.page)

export const QUERY_GROUPS: QueryGroup[] = [
  {
    key: 'cobra-aca',
    label: 'COBRA vs ACA',
    note: 'Health insurance after a layoff (the cluster with impressions and no clicks on 2026-10-26).',
    matches: (r) => test(/\b(cobra|aca|obamacare|affordable care act)\b/)(r) || onPath(/\/resources\/cobra-aca|\/tools\/cobra-vs-aca/)(r),
  },
  {
    key: 'severance',
    label: 'Severance',
    note: 'Severance pay, tax and agreements.',
    matches: (r) => test(/severance/)(r) || onPath(/\/resources\/severance-pay|\/tools\/severance-calculator|\/topics\/severance/)(r),
  },
  {
    key: 'unemployment',
    label: 'Unemployment benefits',
    note: 'Filing and amounts by state.',
    matches: (r) => test(/unemployment|jobless|file for benefits/)(r) || onPath(/\/unemployment-benefits/)(r),
  },
  {
    key: 'layoffs-warn',
    label: 'Layoffs and WARN',
    note: 'Layoff trackers, WARN notices and company layoffs.',
    matches: (r) => test(/layoff|laid off|lay off|warn (act|notice)|reduction in force|\brif\b/)(r) || onPath(/\/layoffs|\/resources\/warn-act|\/tools\/layoff-risk-check/)(r),
  },
  {
    key: 'ai-skills-pay',
    label: 'AI skills and pay',
    note: 'AI skills in job postings, pay premium and AI training.',
    matches: (r) => test(/\bai\b.*\b(skill|skills|pay|salary|jobs?|training)\b|prompt engineer|ai training/)(r) || onPath(/\/ai-skills|\/ai-training|\/resources\/ai-skills-pay-premium/)(r),
  },
  {
    key: 'salary',
    label: 'Salary',
    note: 'What a job pays.',
    matches: (r) => test(/\b(salary|salaries|wage|pay range|how much does .* make)\b/)(r) || onPath(/\/salaries\//)(r),
  },
  {
    key: 'jobs-city',
    label: 'Jobs by title and city',
    note: 'Job and career searches, including a city or state.',
    matches: (r) => test(/\b(jobs?|careers?|hiring|openings?|positions?)\b/)(r) || onPath(/\/jobs\/|\/places\//)(r),
  },
  {
    key: 'employers',
    label: 'Employer names',
    note: 'People searching a company by name; they land on an employer page.',
    matches: onPath(/\/employers\/[^/]+/),
  },
]

export const OTHER_GROUP = { key: 'other', label: 'Everything else', note: 'Searches that match no group above.' }
