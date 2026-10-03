/**
 * Reading a layoff out of a news headline: who, and how many.
 *
 * Deliberately narrow. Only the shapes headline writers use for a layoff
 * announcement — "Disney lays off around 300 employees", "BioMarin laying off
 * 119 employees", "Workday layoffs to impact over 140 workers", "Nike
 * announces layoffs" — and only when the subject is a name, not a
 * description ("Banking giant", "Health giant"). A headline that doesn't fit
 * is skipped rather than guessed at; the cost of missing one is that a WARN
 * filing or a second headline catches it later.
 */
import { normalizeOrgName } from '@/lib/text/org-name-match'

export interface HeadlineLayoff {
  company: string
  companyKey: string
  employees: number | null
}

const NAME = String.raw`(?<co>[A-Z0-9][\w&.'’-]*(?: (?:&|[A-Z0-9][\w&.'’-]*)){0,4}?)`
const VERB = String.raw`(?:is |are |will |plans? to |set to |to |reportedly )?(?:lay(?:s|ing)? off|laid off|cut(?:s|ting)?|slash(?:es|ing)?|eliminat(?:e|es|ing)|axe[sd]?|shed(?:s|ding)?|trim(?:s|ming)?)`
const COUNT = String.raw`(?:about |around |nearly |more than |over |up to |roughly |some |another |almost |at least )?(?<n>\d[\d,]*(?:\.\d+)?)\s?(?<k>k|thousand)?\+?\s*(?:[a-z-]+ ){0,3}?(?:jobs|employees|workers|staff|staffers|positions|people|roles)`

const WITH_COUNT = new RegExp(String.raw`^${NAME},? ${VERB} ${COUNT}`, 'i')
const LAYOFFS_COUNT = new RegExp(String.raw`^${NAME}(?:'s)? (?:layoffs?|job cuts) .*?${COUNT}`, 'i')
const ANNOUNCES = new RegExp(String.raw`^${NAME} (?:announces|confirms|begins|starts|plans|unveils|launches|to begin)(?: (?:new|more|mass|another|a new round of|fresh))? (?:layoffs|job cuts)\b`, 'i')

/** Words that make the subject a description rather than a company's name. */
const NOT_A_NAME = /\b(firm|giant|maker|makers|retailer|chain|plant|startup|employer|employers|company|companies|agency|district|city|county|state|states|government|federal|tech|more|mass|new|major|another|local|dozens|hundreds|thousands|layoffs|layoff|health|global|banking|workers|employees|report|reports|why|how|what|here|these|this|after|amid|as|area|bay|region|industry|sector|hospital|school|schools|university|us|u\.s\.|trump|congress)\b/i

function count(n: string | undefined, k: string | undefined): number | null {
  if (!n) return null
  const v = parseFloat(n.replace(/,/g, ''))
  if (!Number.isFinite(v)) return null
  const total = Math.round(k ? v * 1000 : v)
  // A year ("2026 layoffs") or a figure no layoff reaches is not a headcount.
  return total > 0 && total < 500_000 && !(total >= 1990 && total <= 2100 && !n.includes(',')) ? total : null
}

export function readLayoffHeadline(headline: string): HeadlineLayoff | null {
  const h = headline.replace(/\s+/g, ' ').trim()
  const m = h.match(WITH_COUNT) ?? h.match(LAYOFFS_COUNT) ?? h.match(ANNOUNCES)
  const raw = m?.groups?.co?.trim()
  if (!raw) return null
  const company = raw.replace(/^the /i, '').replace(/[,:]$/, '').trim()
  if (company.length < 2 || NOT_A_NAME.test(company)) return null
  const companyKey = normalizeOrgName(company)
  if (!companyKey) return null
  return { company, companyKey, employees: count(m!.groups?.n, m!.groups?.k) }
}

/** "CNBC on MSN" and "CNBC" are one publisher, for telling two sources from one. */
export function publisherKey(source: string | null | undefined): string {
  return (source ?? '').replace(/\s+on MSN$/i, '').trim().toLowerCase()
}

/**
 * Whether two employer keys name the same company: equal, or one is the
 * other with words around it ("disney" / "walt disney") — whole words only,
 * and never on a key too short to mean anything.
 */
export function sameEmployer(a: string, b: string): boolean {
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (short.length < 4) return false
  return ` ${long} `.includes(` ${short} `)
}
