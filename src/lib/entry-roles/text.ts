import { TITLE_LIMIT } from '@/lib/seo/title'
import { fitDescription } from '@/lib/seo/templates'
import { SITE_URL } from '@/lib/seo/facts'
import { entryRole, similarRoles, type EntryRole } from '@/lib/entry-roles/roles'

// Wording for the entry-level role pages: titles, descriptions, the answer-first opening, the questions and their answers, and
// the structured data. Pure, so src/test/entry-roles.test.ts can hold it to the page rules. Every number comes from the stored
// figures passed in; nothing here states pay, demand or hiring odds on its own.

/** "Sales Development Representative (SDR)" -> "Sales Development Representative". */
export const roleLabel = (r: EntryRole) =>
  r.name.replace(/\s*\([^)]*\)/g, '').split(' / ')[0].replace(/^Junior /, '').trim()
/** "SDR" from "(SDR)", else null. */
export const roleAcronym = (r: EntryRole) => /\(([A-Za-z]{2,6})\)/.exec(r.name)?.[1] ?? null

/** Lower case for use inside a sentence, keeping acronyms (IT, QA, SEO, UX, DevOps) as written. */
const lower = (s: string) =>
  s.split(' ').map((w) => (/^[A-Z0-9&]{2,5}$/.test(w) || /^[A-Za-z]+[A-Z][a-z]*[A-Z]?[a-z]*$/.test(w) && /[a-z][A-Z]/.test(w) ? w : w.toLowerCase())).join(' ')
const n = (x: number) => x.toLocaleString('en-US')
const usd = (x: number) => `$${Math.round(x).toLocaleString('en-US')}`

/** Longest title that fits, richest first. */
const pick = (...c: string[]) => c.find((t) => t.length <= TITLE_LIMIT) ?? c[c.length - 1]

export interface RoleFacts {
  jobs: number
  noExperience: number
  training: number
  median: number | null
  p25: number | null
  p75: number | null
  payCount: number
}

export function roleSeo(r: EntryRole, f: RoleFacts | null) {
  const label = roleLabel(r)
  const ac = roleAcronym(r)
  const open = f && f.jobs > 0
  return {
    title: pick(`Entry-Level ${label} Jobs: What It Is, Skills, Openings`, `Entry-Level ${label} Jobs and Skills`, `Entry-Level ${label} Jobs`),
    h1: `Entry-level ${lower(label)} jobs${ac ? ` (${ac})` : ''}: what the job is, skills and open roles`,
    description: fitDescription(
      `${open ? `${n(f.jobs)} open entry-level ${lower(label)} jobs. ` : ''}What a ${lower(label)} does, the skills it takes, how to get started with little or no experience, and where the job leads. Check your résumé against the skills.`,
      160,
    ),
  }
}

export function rolePlaceSeo(r: EntryRole, place: string, jobs: number, median: number | null) {
  const label = roleLabel(r)
  return {
    title: pick(`Entry-Level ${label} Jobs in ${place}: ${n(jobs)} Open`, `Entry-Level ${label} Jobs in ${place}`, `${label} Jobs in ${place}`),
    h1: `Entry-level ${lower(label)} jobs in ${place}: ${n(jobs)} open roles`,
    description: fitDescription(
      `${n(jobs)} open entry-level ${lower(label)} jobs in ${place} from employers’ own career sites, checked within the last week.${median ? ` Median listed pay is about ${usd(median)} a year.` : ''} What the job is and the skills it takes.`,
      160,
    ),
  }
}

/** The first paragraph: it defines the job and gives the one figure that matters, so a reader or a model can quote it whole. */
export function roleLead(r: EntryRole, f: RoleFacts | null): string {
  const live = f && f.jobs > 0 ? ` Right now ${n(f.jobs)} entry-level ${lower(roleLabel(r))} jobs are open on employers’ own career sites.` : ''
  return `${r.what}${live}`
}

/** Whether openings state that no experience is needed, in numbers taken from the postings' own words. */
export function experienceAnswer(r: EntryRole, f: RoleFacts | null): string {
  const label = lower(roleLabel(r))
  if (!f || f.jobs === 0) {
    return `Entry-level ${label} jobs exist, but none are open on the career sites we track at this moment, so we cannot say how many ask for experience. Each posting states its own requirements, so read the requirements section before you decide a job is out of reach.`
  }
  const phrase = f.noExperience > 0
    ? `${n(f.noExperience)} of the ${n(f.jobs)} open entry-level ${label} jobs say in their own text that no experience is required.`
    : `None of the ${n(f.jobs)} open entry-level ${label} jobs we track say in their own text that no experience is required, so expect employers to look for related experience, coursework or projects.`
  const training = f.training > 0 ? ` ${n(f.training)} say they provide training.` : ''
  return `${phrase}${training} The figures are counted from the posting text and change as jobs open and close.`
}

export function payAnswer(r: EntryRole, f: RoleFacts | null): string | null {
  if (!f || f.median == null || f.p25 == null || f.p75 == null) return null
  return `Across ${n(f.payCount)} open entry-level ${lower(roleLabel(r))} listings that state an annual pay figure, the middle half run from ${usd(f.p25)} to ${usd(f.p75)}, with a median of ${usd(f.median)}. Listings that state pay are not every listing, and some roles add commission or bonus on top.`
}

export interface Faq { q: string; a: string }

export function roleFaqs(r: EntryRole, f: RoleFacts | null): Faq[] {
  const label = lower(roleLabel(r))
  const out: Faq[] = [
    { q: `What does a ${label} do?`, a: `${r.what} A typical day includes: ${r.tasks.map(lower).join('; ')}.` },
    { q: `Can I get an entry-level ${label} job with no experience?`, a: experienceAnswer(r, f) },
    { q: `What skills do you need to be a ${label}?`, a: `The skills this job uses most are ${r.skills.slice(0, 6).map(lower).join(', ')}. Most can be learned before the first day through coursework, short courses, practice or a related job.` },
  ]
  const pay = payAnswer(r, f)
  if (pay) out.push({ q: `How much does an entry-level ${label} make?`, a: pay })
  const next = r.next.map((s) => entryRole(s)).filter((x): x is EntryRole => !!x).map((x) => roleLabel(x))
  if (next.length) out.push({ q: `Where can a ${label} job lead?`, a: `People in this job commonly move to ${next.slice(0, 4).map(lower).join(', ')}. The link between jobs is the shared skills; the path is not guaranteed and depends on the employer.` })
  return out
}

export function faqJsonLd(faqs: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}

export function occupationJsonLd(r: EntryRole, path: string, f: RoleFacts | null) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Occupation',
    name: roleLabel(r),
    description: r.what,
    url: `${SITE_URL}${path}`,
    skills: r.skills.join(', '),
    responsibilities: r.tasks.join('. '),
    ...(f?.median != null && f.p25 != null && f.p75 != null
      ? { estimatedSalary: { '@type': 'MonetaryAmountDistribution', name: `Listed pay, entry-level ${lower(roleLabel(r))}`, currency: 'USD', duration: 'P1Y', percentile25: f.p25, median: f.median, percentile75: f.p75 } }
      : {}),
  }
}

/** The words a résumé uses for a skill: the label, the parenthetical names, and a few common stand-ins for generic tool words. */
const STAND_INS: Record<string, string[]> = {
  'crm software': ['crm', 'salesforce', 'hubspot', 'zoho', 'pipedrive', 'dynamics'],
  'crm and support tools': ['crm', 'zendesk', 'salesforce', 'freshdesk', 'intercom'],
  'crm and success platforms': ['crm', 'gainsight', 'salesforce', 'hubspot'],
  'crm administration': ['crm', 'salesforce', 'hubspot'],
  spreadsheets: ['excel', 'google sheets', 'spreadsheet'],
  'spreadsheet skills': ['excel', 'google sheets', 'spreadsheet'],
  'spreadsheet basics': ['excel', 'google sheets', 'spreadsheet'],
  excel: ['excel', 'google sheets'],
  'ticketing systems': ['zendesk', 'jira', 'servicenow', 'freshdesk', 'ticketing', 'tickets'],
  'ticketing tools': ['zendesk', 'jira', 'servicenow', 'freshdesk', 'ticketing', 'tickets'],
  'applicant tracking systems': ['ats', 'greenhouse', 'lever', 'workday', 'icims', 'applicant tracking'],
  'hris software': ['hris', 'workday', 'adp', 'bamboohr', 'paycom', 'paylocity'],
  'accounting software': ['quickbooks', 'netsuite', 'xero', 'sage', 'accounting software'],
  'erp software': ['erp', 'sap', 'oracle', 'netsuite'],
  'erp or accounting software': ['erp', 'sap', 'oracle', 'netsuite', 'quickbooks'],
  'email platforms': ['mailchimp', 'hubspot', 'klaviyo', 'marketo', 'email marketing'],
  'email marketing tools': ['mailchimp', 'hubspot', 'klaviyo', 'marketo', 'email marketing'],
  'communication': ['communication', 'communicated', 'written and verbal'],
  'writing': ['writing', 'wrote', 'copywriting', 'editing'],
  'organization': ['organization', 'organized', 'organizational'],
  'attention to detail': ['attention to detail', 'detail-oriented', 'detail oriented', 'accuracy'],
  sql: ['sql'],
  'sql basics': ['sql'],
}

export function skillWords(skill: string): string[] {
  const base = skill.replace(/\s*\([^)]*\)/g, '').trim()
  const paren = /\(([^)]*)\)/.exec(skill)?.[1]
  const names = paren ? paren.split(/,|\bor\b|\band\b/).map((x) => x.replace(/similar|level knowledge/g, '').trim()).filter((x) => x.length > 1) : []
  const words = [base, ...names, ...(STAND_INS[base.toLowerCase()] ?? [])]
  return [...new Set(words.map((w) => w.toLowerCase()))]
}

export const skillItems = (r: EntryRole) => r.skills.map((s) => ({ label: s.replace(/\s*\([^)]*\)/g, '').trim() || s, words: skillWords(s) }))

export { similarRoles }
