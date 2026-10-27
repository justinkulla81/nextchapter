/**
 * The function a to-do belongs to, so the list and the morning email can be read
 * by who in the company would do the work (sales, product, marketing, ...)
 * instead of by when it landed. Stored on CrmTask.area when it was set on
 * purpose; otherwise inferred from the title, notes and organization, so old
 * rows sort correctly without a backfill.
 */
export type TodoAreaKey =
  | 'sales-highered' | 'sales-outplacement' | 'sales-hiring' | 'sales-growth-learning' | 'sales-workforce'
  | 'product-candidate' | 'product-highered' | 'product-admin'
  | 'marketing-candidate' | 'marketing-b2b'
  | 'ops-candidate'
  | 'layoffs-outreach'
  | 'content' | 'research' | 'pr' | 'speaking'
  | 'fundraising'
  | 'finance-admin' | 'tech-security'
  | 'other'

export interface TodoArea { key: TodoAreaKey; group: string; label: string }

/** Order is the order the email and the list print them in. */
export const TODO_AREAS: TodoArea[] = [
  { key: 'layoffs-outreach', group: 'Layoffs outreach', label: 'Layoffs outreach' },
  { key: 'sales-outplacement', group: 'Sales', label: 'Employer · outplacement' },
  { key: 'sales-hiring', group: 'Sales', label: 'Employer · hiring' },
  { key: 'sales-growth-learning', group: 'Sales', label: 'Employer · growth & learning' },
  { key: 'sales-highered', group: 'Sales', label: 'Higher ed' },
  { key: 'sales-workforce', group: 'Sales', label: 'Workforce boards & government' },
  { key: 'product-candidate', group: 'Product', label: 'Candidate' },
  { key: 'product-highered', group: 'Product', label: 'Higher ed' },
  { key: 'product-admin', group: 'Product', label: 'Admin & CRM' },
  { key: 'marketing-candidate', group: 'Marketing', label: 'Candidate' },
  { key: 'marketing-b2b', group: 'Marketing', label: 'B2B' },
  { key: 'ops-candidate', group: 'Operations', label: 'Candidate growth & retention' },
  { key: 'speaking', group: 'Speaking & visibility', label: 'Speaking, panels, applications' },
  { key: 'pr', group: 'Speaking & visibility', label: 'PR' },
  { key: 'content', group: 'Content & research', label: 'Content' },
  { key: 'research', group: 'Content & research', label: 'Research' },
  { key: 'fundraising', group: 'Fundraising', label: 'Fundraising & grants' },
  { key: 'finance-admin', group: 'Finance & admin', label: 'Finance & admin' },
  { key: 'tech-security', group: 'Tech', label: 'Tech, security & speed' },
  { key: 'other', group: 'Other', label: 'Unsorted' },
]

const KEYS = new Set<string>(TODO_AREAS.map((a) => a.key))
export function isAreaKey(v: unknown): v is TodoAreaKey {
  return typeof v === 'string' && KEYS.has(v)
}
export function areaMeta(key: TodoAreaKey): TodoArea {
  return TODO_AREAS.find((a) => a.key === key)!
}

/** The headings the email and list use, in order, each with the areas under it. */
export const TODO_AREA_GROUPS: { group: string; areas: TodoArea[] }[] = TODO_AREAS.reduce(
  (acc, a) => {
    const g = acc.find((x) => x.group === a.group)
    if (g) g.areas.push(a)
    else acc.push({ group: a.group, areas: [a] })
    return acc
  },
  [] as { group: string; areas: TodoArea[] }[],
)

// First match wins, so the narrow rules sit above the broad ones.
const RULES: [RegExp, TodoAreaKey][] = [
  [/\b(keynote|panel|speak(er|ing)?|cfp|call for (speakers|proposals)|demo day|pitch day|podcast|fellowship application)\b/i, 'speaking'],
  [/\b(layoff|laid off|warn notice|warn filing|rapid response|severance)\b/i, 'layoffs-outreach'],
  [/\b(outplacement|reemployment)\b/i, 'sales-outplacement'],
  [/\b(l&d|learning (and|&) development|upskill|reskill|retention|growth (and|&) learning|internal mobility)\b/i, 'sales-growth-learning'],
  [/\b(hiring (partner|client|portal)|recruiter|talent acquisition|ats|job board|search firm|staffing)\b/i, 'sales-hiring'],
  [/\b(university|college|career services|alumni|higher[- ]?ed|provost|dean)\b/i, 'sales-highered'],
  [/\b(workforce board|american job center|wioa|state agency|econ(omic)? dev)/i, 'sales-workforce'],
  [/\b(grant|rfp|investor|vc\b|seed round|fundrais|pitch deck|angel|accelerator)\b/i, 'fundraising'],
  [/\b(press|journalist|reporter|media pitch|op-ed|interview request)\b/i, 'pr'],
  [/\b(blog|newsletter|linkedin post|article|video|webinar content|case study|guide)\b/i, 'content'],
  [/\b(research|report|survey|data release|displacement report|white paper)\b/i, 'research'],
  [/\b(security|vulnerab|outage|latency|slow page|performance|casa|soc ?2|spam|attack|bug|deploy|database|cron)\b/i, 'tech-security'],
  [/\b(invoice|tax|accounting|bookkeep|payroll|insurance|legal|contract renewal|bank|budget|billing|stripe)\b/i, 'finance-admin'],
  [/\b(churn|win[- ]?back|re-?engage|candidate retention|activation|onboarding email|streak)\b/i, 'ops-candidate'],
  [/\b(seo|ads?\b|campaign|landing page|homepage|brand|cold email|outreach template)\b/i, 'marketing-b2b'],
  [/\b(candidate|job seeker|member).*(feature|screen|flow|ux)\b/i, 'product-candidate'],
  [/\b(admin|crm).*(feature|page|tool|screen)\b/i, 'product-admin'],
]

export interface TodoAreaInput {
  area?: string | null
  title: string
  notes?: string | null
  kind?: string
  orgTypes?: string[]
}

export function inferArea(t: TodoAreaInput): TodoAreaKey {
  if (isAreaKey(t.area)) return t.area
  if (t.title.startsWith('Find a contact')) return 'layoffs-outreach'
  const text = `${t.title} ${t.notes ?? ''}`
  for (const [re, key] of RULES) if (re.test(text)) return key
  const types = t.orgTypes ?? []
  if (types.includes('UNIVERSITY')) return 'sales-highered'
  if (types.includes('OUTPLACEMENT_LEAD') || types.includes('OUTPLACEMENT_FIRM')) return 'sales-outplacement'
  if (types.includes('SEARCH_FIRM')) return 'sales-hiring'
  if (types.includes('GOVERNMENT')) return 'sales-workforce'
  if (types.includes('VC_FUND') || types.includes('ANGEL_SYNDICATE') || types.includes('FUNDER_GRANT') || types.includes('FOUNDATION')) return 'fundraising'
  if (types.includes('MEDIA')) return 'pr'
  if (t.kind === 'ADMIN') return 'tech-security'
  return 'other'
}
