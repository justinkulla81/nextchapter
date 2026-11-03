import type { PayGroup, PayStat, SkillPay } from './types'
import { paysLess, paysMore } from './assemble'

// The wording for pay data pages, meta descriptions, FAQ answers and llms.txt, in one place so a page and its structured data
// say the same thing. Every sentence names the sample and says "advertised": these are employer-posted ranges, not what people are paid.

export const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
export const k = (n: number) => `$${Math.round(Math.abs(n) / 100) / 10}k`
export const signedPct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}%`
export const num = (n: number) => n.toLocaleString('en-US')
export const dateText = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

const BRAND: Record<string, string> = {
  ios: 'iOS', macos: 'macOS', javascript: 'JavaScript', typescript: 'TypeScript', pytorch: 'PyTorch', tensorflow: 'TensorFlow', powerpoint: 'PowerPoint',
  postgresql: 'PostgreSQL', mysql: 'MySQL', github: 'GitHub', gitlab: 'GitLab', hubspot: 'HubSpot', quickbooks: 'QuickBooks', solidworks: 'SolidWorks',
  autocad: 'AutoCAD', catia: 'CATIA', netsuite: 'NetSuite', dynamodb: 'DynamoDB', nosql: 'NoSQL', graphql: 'GraphQL', cloudformation: 'CloudFormation',
  powershell: 'PowerShell', sharepoint: 'SharePoint', langchain: 'LangChain', devops: 'DevOps', saas: 'SaaS', 'node.js': 'Node.js',
}
const ACRONYM = new Set(['aws', 'bgp', 'css', 'crm', 'erp', 'etl', 'gaap', 'gcp', 'hipaa', 'hris', 'html', 'json', 'lms', 'mep', 'pmp', 'php', 'rest', 'api', 'sap', 'sem', 'seo', 'sox', 'sql', 'sso', 'ec2', 'bi'])

/** A skill as written on a page: "machine learning" -> "Machine Learning", "sql server" -> "SQL Server", "c++" -> "C++", "pytorch" -> "PyTorch". */
export function skillName(skill: string): string {
  return skill
    .split(' ')
    .map((w) => {
      if (BRAND[w]) return BRAND[w]
      if (ACRONYM.has(w) || /[+#&/]/.test(w)) return w.toUpperCase()
      return w.replace(/(^|-)([a-z])/g, (_, a: string, b: string) => `${a}${a ? b : b.toUpperCase()}`)
    })
    .join(' ')
}

export const METHOD_SHORT =
  'Pay is the midpoint of the range an employer posted (or stated in the posting text), converted to a year, on live U.S. professional jobs. It is advertised pay, not what anyone is paid.'

export const rangeText = (s: PayStat) => `${usd(s.p25)} to ${usd(s.p75)} for the middle half, median ${usd(s.p50)}`
export const sampleText = (s: PayStat) => `${num(s.n)} paid postings from ${num(s.companies)} employers`

/** The like-for-like gap in words (callers add "with function, level and industry matched"); null when the figure is missing. */
export function gapPhrase(g: Pick<PayGroup, 'likePct' | 'likeUsd'>, vs: string): string | null {
  if (g.likePct === undefined || g.likeUsd === undefined) return null
  if (Math.abs(g.likePct) < 2) return `about the same as ${vs}`
  return `${signedPct(g.likePct)} (about ${k(g.likeUsd)} a year) against ${vs}`
}

export function skillSentence(s: SkillPay): string {
  const name = skillName(s.skill)
  const base = `Postings that list ${name} advertise a median ${usd(s.p50)} (${sampleText(s)}), against ${usd(s.baseP50)} for other postings that list skills.`
  if (s.likePct === undefined || s.likeUsd === undefined) return base
  if (paysMore(s)) return `${base} Matched on function, level and industry the gap is ${signedPct(s.likePct)}, about ${k(s.likeUsd)} a year.`
  if (paysLess(s)) return `${base} Matched on function, level and industry the gap is ${signedPct(s.likePct)}: the raw difference comes from the roles that list it, not from the skill.`
  return `${base} Matched on function, level and industry there is no clear gap.`
}

/** Meta description for a skill page: 110 to 165 characters, the skill and the number first. */
export function skillDescription(s: SkillPay): string {
  const gap = s.likePct !== undefined && paysMore(s) ? ` and ${signedPct(s.likePct)} against similar jobs` : ''
  const d = `${skillName(s.skill)} salary: postings listing it advertise a median ${usd(s.p50)}${gap}. ${num(s.n)} paid U.S. postings, with the method and a CSV.`
  return d.length <= 165 ? d : `${d.slice(0, 160).replace(/\s+\S*$/, '')}…`
}

export const citeLine = (what: string, asOf: string, url: string) => `NextChapter, “${what}”, data as of ${dateText(asOf)}, ${url}`
