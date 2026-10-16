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
  /** The share of the workforce, when the text gives one ("30% of its staff"). */
  percent: number | null
}

const WORKFORCE = String.raw`(?:workforce|work force|staff|employees|headcount|team|personnel|jobs|people|roles|positions)`
const PERCENT_OF = new RegExp(String.raw`(\d{1,3}(?:\.\d+)?)\s?(?:%|percent|per cent)\s+of\s+(?:its |the |their |our )?(?:[A-Za-z]+ ){0,2}?${WORKFORCE}\b`, 'i')
const PERCENT_BY = new RegExp(String.raw`${WORKFORCE}\s+by\s+(?:about |around |nearly |roughly |some )?(\d{1,3}(?:\.\d+)?)\s?(?:%|percent|per cent)`, 'i')

/** A percentage of the workforce, never a stock move or a rate ("falls 5% after layoffs"). */
export function readPercent(text: string): number | null {
  const m = text.match(PERCENT_OF) ?? text.match(PERCENT_BY)
  const n = m ? parseFloat(m[1]) : NaN
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null
}

const NAME = String.raw`(?<co>[A-Z0-9][\w&.'’-]*(?: (?:&|[A-Z0-9][\w&.'’-]*)){0,4}?)`
const HEDGE = String.raw`(?:is|are|will|plans? to|set to|to|reportedly|preparing to|prepares to|preparing|prepares|poised to|expected to|about to|ready to|looks? to|looking to|said to|likely to|may|could|would|now|also|again)`
const VERB = String.raw`(?:${HEDGE} )*(?:lay(?:s|ing)? off|laid off|cut(?:s|ting)?|slash(?:es|ing)?|eliminat(?:e|es|ing)|axe[sd]?|shed(?:s|ding)?|trim(?:s|ming)?|let(?:s|ting)? go(?: of)?)`
const COUNT = String.raw`(?:about |around |nearly |more than |over |up to |roughly |some |another |almost |at least )?(?<n>\d[\d,]*(?:\.\d+)?)\s?(?<k>k|thousand)?\+?\s*(?:[a-z-]+ ){0,3}?(?:jobs|employees|workers|staff|staffers|positions|people|roles)`

const WITH_COUNT = new RegExp(String.raw`^${NAME},? ${VERB} ${COUNT}`, 'i')
const LAYOFFS_COUNT = new RegExp(String.raw`^${NAME}(?:'s)? (?:layoffs?|job cuts)[:,]? .*?${COUNT}`, 'i')
const ANNOUNCES = new RegExp(String.raw`^${NAME} (?:announces|confirms|begins|starts|plans|unveils|launches|to begin)(?: (?:new|more|mass|another|a new round of|fresh))? (?:[a-z-]+ ){0,2}?(?:layoffs|job cuts|staff cuts|headcount cuts)\b`, 'i')

// The wider shapes: the layoff is announced without a headcount, as a share of
// the workforce, or by the company's owner. Each still needs a name as the
// subject and a layoff verb, so a headline that fits none is skipped.
const NAME_NC = NAME.replace('(?<co>', '(?:')
const PEOPLE = String.raw`(?:jobs|workers|employees|staff|staffers|roles|positions|people)`
const OF_WORKFORCE = String.raw`(?: of)? (?:its |the |their )?(?:[A-Za-z0-9&.'’-]+ ){0,2}?(?:workforce|work force|staff|employees|team|headcount|personnel|people|jobs|roles|positions)\b`
const PCT = String.raw`\d{1,3}(?:\.\d+)?\s?(?:%|percent|per cent)`
const BIG = String.raw`(?:a |an )?(?:large|big|significant|substantial|major|sizable|considerable) (?:part|portion|share|number|chunk|percentage)`
/** "Bumble to cut 30% of workforce", "Meta cuts 5% of staff". */
const SHARE_PCT = new RegExp(String.raw`^${NAME},? ${VERB} (?:about |around |nearly |roughly |up to |more than |over )?${PCT}${OF_WORKFORCE}`, 'i')
/** "Intel to lay off thousands", never "cuts hundreds of millions in costs". */
const SHARE_WORDS = new RegExp(String.raw`^${NAME},? ${VERB} (?:thousands|hundreds|dozens)\b(?! of (?!(?:[a-z-]+ ){0,2}?${PEOPLE}\b))`, 'i')
/** "laying off a large part of the Airtable team". */
const LARGE_PART = new RegExp(String.raw`^${NAME},? ${VERB} ${BIG}${OF_WORKFORCE}`, 'i')
/** "Airtable's new owner is laying off …": the layoff is at the company the owner owns. */
const OWNER = new RegExp(String.raw`^${NAME}['’]s (?:(?:new|latest|private equity|parent|corporate) )*(?:owner|owners|parent|acquirer|buyer|parent company|parent firm) ${VERB}\b`, 'i')
/** "Bending Spoons lays off large part of Airtable": the layoff is at the target. */
const TARGET = new RegExp(
  String.raw`^${NAME_NC},? ${VERB} (?:${BIG}|${BIG.replace('(?:a |an )?', '')}|${PCT}|\d[\d,]*(?: ${PEOPLE})?)(?: of| at| from) (?:the )?(?!(?:its|their|the|workforce|work force|staff|employees|team|teams|headcount|personnel|workers|jobs|roles|positions|people|global|entire|total|full|all|about|around)\b)(?<tco>[A-Z0-9][\w&.'’-]*(?: (?:&|[A-Z0-9][\w&.'’-]*)){0,3}?)(?= after | following | as | amid | in | at | with | over | to |,|:| -|$)`,
  'i',
)
/** "Miro layoffs: 18% of workforce affected", "Miro Layoffs Hit 18% of Staff". */
const LAYOFFS_PCT = new RegExp(String.raw`^${NAME}(?:'s)? (?:layoffs?|job cuts)[:,]? .*?${PCT}${OF_WORKFORCE}`, 'i')
/** "Miro 18% layoffs", "Miro announces 18% workforce reduction". */
const PCT_LAYOFFS = new RegExp(
  String.raw`^${NAME},? (?:(?:announces|confirms|reveals|plans|begins) )?${PCT} (?:workforce |staff |headcount |job )?(?:layoffs|job cuts|staff cuts|reduction|cuts)\b`,
  'i',
)
/** "Amazon confirms 14,000 corporate layoffs", "Verizon announces 13,000 job cuts". */
const COUNT_THEN_CUTS = new RegExp(
  String.raw`^${NAME},? (?:(?:announces|confirms|reveals|details|reports|plans|begins) )?(?:about |around |nearly |more than |over |up to |roughly |some |almost |at least )?(?<n>\d[\d,]*(?:\.\d+)?)\s?(?<k>k|thousand)?\+? (?:[a-z-]+ ){0,2}?(?:layoffs|job cuts|staff cuts)\b`,
  'i',
)
/** "Layoffs hit Microsoft again", "Job cuts at Nestle: 16,000 roles to go": the company comes after the noun. */
const CUTS_FIRST = new RegExp(
  String.raw`^(?:(?:new|more|mass|fresh|corporate|big|major) )*(?:layoffs?|job cuts|staff cuts) (?:hit|hits|at|strike|strikes|rock|rocks|reach|reaches|hammer|hammers|come to|continue at) ${NAME}(?= again|,|:| -| as | amid | after | following | with | over |$)`,
  'i',
)
/** "Salesforce reduces headcount by 4,000". */
const HEADCOUNT = new RegExp(
  String.raw`^${NAME},? (?:is |are |will |plans? to |set to |to |reportedly )?(?:reduc(?:es|ing|e)|shrink(?:s|ing)?|trim(?:s|ming)?) (?:its |their |the )?(?:global |total |entire |overall |corporate |white-collar |office )?(?:headcount|workforce|work force|staff)(?: by (?:about |around |nearly |more than |over |roughly |some )?(?:${PCT}|(?<n>\d[\d,]*)(?<k>k|thousand)?))?`,
  'i',
)

/** Words that make the subject a description rather than a company's name. */
const NOT_A_NAME = /\b(firm|giant|maker|makers|retailer|chain|plant|startup|employer|employers|company|companies|agency|district|city|county|state|states|government|federal|tech|more|mass|new|major|another|local|dozens|hundreds|thousands|layoffs|layoff|health|global|banking|workers|employees|report|reports|why|how|what|here|these|this|after|amid|as|area|bay|region|industry|sector|hospital|school|schools|university|us|u\.s\.|trump|congress|prepares|preparing|plans|announces|confirms|reveals|begins|starts)\b/i

function count(n: string | undefined, k: string | undefined): number | null {
  if (!n) return null
  const v = parseFloat(n.replace(/,/g, ''))
  if (!Number.isFinite(v)) return null
  const total = Math.round(k ? v * 1000 : v)
  // A year ("2026 layoffs") or a figure no layoff reaches is not a headcount.
  return total > 0 && total < 500_000 && !(total >= 1990 && total <= 2100 && !n.includes(',')) ? total : null
}

export function readLayoffHeadline(headline: string): HeadlineLayoff | null {
  // Quote marks around a phrase ('large part') are not part of it; a possessive's apostrophe is.
  const h = headline
    .replace(/[“”"]/g, '')
    .replace(/(^|\s)['‘’]/g, '$1')
    .replace(/['‘’](?=\s|$|[.,:;])/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // "Online whiteboard company Miro cuts…": a lowercase description before the name is not part of it.
    .replace(/^(?:[A-Za-z][\w-]* ){1,4}(?:company|firm|startup|start-up|maker|giant|platform|provider|unicorn|vendor|retailer) (?=[A-Z0-9])/, '')
    // An aside after the name ("Miro, valued at $17.5B, lays off…").
    .replace(/^([^,]{2,40}),\s*(?:valued at|backed by|which|once valued)[^,]*,\s*/i, '$1 ')
    // A section label in front of the headline is not part of the subject.
    .replace(/^(?:exclusive|breaking|update|report|reports|just in|developing|analysis|opinion)\s*[:|-]\s*/i, '')
  // The owner shapes go first: "Airtable's new owner" is a name-shaped phrase the
  // others would take for the company itself.
  const m = h.match(OWNER) ?? h.match(TARGET)
    ?? h.match(WITH_COUNT) ?? h.match(LAYOFFS_COUNT) ?? h.match(ANNOUNCES)
    ?? h.match(COUNT_THEN_CUTS) ?? h.match(CUTS_FIRST) ?? h.match(LAYOFFS_PCT) ?? h.match(PCT_LAYOFFS)
    ?? h.match(SHARE_PCT) ?? h.match(SHARE_WORDS) ?? h.match(LARGE_PART) ?? h.match(HEADCOUNT)
  const raw = (m?.groups?.co ?? m?.groups?.tco?.replace(/\s+(?:teams?|staff|workforce|employees|workers)$/i, ''))?.trim()
  if (!raw) return null
  const company = raw.replace(/\s+(?:CEO|CFO|COO|CTO|founder|co-founder|chief\b).*$/i, '').replace(/^the /i, '').replace(/[,:]$/, '').trim()
  if (company.length < 2 || NOT_A_NAME.test(company)) return null
  const companyKey = normalizeOrgName(company)
  if (!companyKey) return null
  return { company, companyKey, employees: count(m!.groups?.n, m!.groups?.k), percent: readPercent(h) }
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
