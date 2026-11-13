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
const ANNOUNCES = new RegExp(String.raw`^${NAME} (?:announces|confirms|begins|starts|plans|unveils|launches|to begin)(?: (?:new|more|mass|another|a new round of|fresh))? (?:[a-z-]+ ){0,2}?(?:layoffs|job cuts|staff cuts|headcount cuts|redundancies|buyouts)\b`, 'i')

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
  String.raw`^${NAME},? (?:(?:announces|confirms|reveals|details|reports|plans|begins) )?(?:about |around |nearly |more than |over |up to |roughly |some |almost |at least )?(?<n>\d[\d,]*(?:\.\d+)?)\s?(?<k>k|thousand)?\+? (?:[a-z-]+ ){0,2}?(?:layoffs|job cuts|staff cuts|redundancies|buyouts)\b`,
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


// Workforce events that are not worded as a layoff: a redundancy programme, a buyout offer, an office or plant closing, a headquarters
// moving, a merger that cuts jobs. Each still needs a name as the subject and a verb, so a headline that fits none is skipped.
/** "BT to make 500 staff redundant", "Vodafone makes 11,000 redundancies". */
const REDUNDANT = new RegExp(String.raw`^${NAME},? (?:${HEDGE} )*(?:make|makes|making) (?:about |around |nearly |more than |over |up to |roughly |some |large |many |further )?(?:(?<n>\d[\d,]*)\s?)?(?:(?:[a-z-]+ ){0,1}(?:staff|workers|employees|people|roles|jobs|positions) )?(?:redundant|redundancies)\b`, 'i')
/** "Ford offers buyouts to 5,000 workers", "Intel launches voluntary separation program", "Boeing extends early retirement offer". */
const BUYOUT_OFFER = new RegExp(
  String.raw`^${NAME},? (?:${HEDGE} )*(?:offers?|offering|launch(?:es|ing)?|announces?|extends?|opens?|rolls? out|unveils?) (?:a |another |new |second |its |voluntary |round of )*(?:voluntary )?(?:buy-?outs?|separation (?:program(?:me)?|packages?|offers?)|early[- ]retirement|departure program(?:me)?|exit program(?:me)?|severance (?:program(?:me)?|packages?))(?:.*?(?<n>\d[\d,]*)\s?(?:[a-z-]+ ){0,2}?(?:employees|workers|staff|people))?`,
  'i',
)
/** "Starbucks to close its Seattle office", "GM shutting down Orion plant, 1,200 jobs", "Acme to shut down". */
const CLOSURE = new RegExp(
  String.raw`^${NAME},? (?:${HEDGE} )*(?:(?:clos(?:e|es|ing)|shutter(?:s|ing)?) (?:its |their |the |a |all )?(?:[A-Za-z.-]+ ){0,3}?(?:offices?|headquarters|plants?|facilit(?:y|ies)|factor(?:y|ies)|stores?|locations?|sites?|campus|operations|business|division|unit)|(?:shut(?:s|ting)? down|wind(?:s|ing)? down|cease(?:s)? operations)\b)(?:.*?(?<n>\d[\d,]*)\s?(?:[a-z-]+ ){0,2}?(?:jobs|employees|workers|staff|positions))?`,
  'i',
)
/** "Boeing to relocate headquarters to Arlington", "Chevron moving corporate offices to Houston". */
const RELOCATION = new RegExp(
  String.raw`^${NAME},? (?:${HEDGE} )*(?:relocat(?:e|es|ing)|mov(?:e|es|ing)|shift(?:s|ing)?|transfer(?:s|ring)?) (?:its |their |the )?(?:corporate |global |world |u\.s\. |us )?(?:headquarters|hq|head office|corporate offices?|offices?|operations|manufacturing|production|jobs|business)\b`,
  'i',
)
/** "Kroger-Albertsons merger to cost 3,000 jobs", "Acme merger could cut 500 roles". */
const MERGER = new RegExp(
  String.raw`^${NAME}(?:'s)?(?:[- ]\w[\w&.'’-]*)? (?:merger|acquisition|takeover|deal|combination) (?:with [A-Z][\w&.'’ -]{1,30} )?(?:${HEDGE} )*(?:cost|cut|eliminate|result in|lead to|put at risk|threaten|axe)(?: up to| about| around| as many as| nearly)? (?<n>\d[\d,]*)\s?(?:[a-z-]+ ){0,2}?(?:jobs|employees|workers|staff|positions|roles)`,
  'i',
)

/** Words that make the subject a description rather than a company's name. */
const NOT_A_NAME = /\b(stock|shares|firm|giant|maker|makers|retailer|chain|plant|startup|employer|employers|company|companies|agency|district|city|county|state|states|government|federal|tech|more|mass|new|major|another|local|dozens|hundreds|thousands|layoffs|layoff|health|global|banking|workers|employees|report|reports|why|how|what|here|these|this|after|amid|as|area|bay|region|industry|sector|hospital|school|schools|university|us|u\.s\.|trump|congress|prepares|preparing|plans|announces|confirms|reveals|begins|starts)\b/i

/**
 * What survives the shapes above but is still not a company: a bare article or abbreviation ("The", "AI", "U.S."), a clause that
 * ended mid-sentence ("Mosaic to", "Cisco posts record revenue and"), a headline fragment with a verb in it ("Mikel Arteta defends
 * Arsenal's decision"), or a place or thing ("South Fort Meade facility", "LC4 budget proposal"). Found in the news-reported layoffs on
 * 2026-10-27: about 30 of 137 had a name like these.
 */
const BARE_WORD = /^(?:the|a|an|ai|us|u\.s\.|usa|announcing|announces|corporate jobs|jobs|job cuts|layoffs?|more|big four bank|australian bank|about|over|from|almost|despite|it|u|people|management|staffing|staffers|journalism|head office|corporate headquarters|commercial (?:airplane|aircraft|airliner|plane)|civil aircraft|water leak|q3|prominent business|national nonprofit)$/i
const FRAGMENT = /\b(?:on|to|expects?|expected|blamed|blames?|posts?|defends?|defend|aims?|discontinues?|shuts?|closes?|closing|decision|proposal|budget|calls?|will|would|could|reorganization|says?|said|says|names?|hits?|falls?|rises?|invites?|urges?|asks?|woos?|courts?|lures?|assures?)\b/i
const PLACE_OR_THING = /\b(?:facility|factory|plant|operator|manufacturer|contractor|council|dev|news|skill games)\b/i
const DANGLING_END = /\b(?:to|and|for|of|at|in|on|with|by|as|the|a)$/i
export function isPlausibleCompany(name: string): boolean {
  const n = name.trim()
  if (n.length < 2 || BARE_WORD.test(n) || DANGLING_END.test(n)) return false
  if (n.split(/\s+/).length > 5) return false
  if (FRAGMENT.test(n) || PLACE_OR_THING.test(n)) return false
  // A tracker or list page, a superlative description, an industry group or an unnamed company ('Largest Australian airline', 'Restaurants and bars', 'Staffing co.').
  if (/\btrackers?\b/i.test(n) || /^(?:largest|biggest|top|leading|major)\b/i.test(n) || /\band (?:bars|restaurants|retailers|banks)$/i.test(n) || /^[A-Za-z]+ co\.$/i.test(n)) return false
  return true
}

function count(n: string | undefined, k: string | undefined): number | null {
  if (!n) return null
  const v = parseFloat(n.replace(/,/g, ''))
  if (!Number.isFinite(v)) return null
  const total = Math.round(k ? v * 1000 : v)
  // A year ("2026 layoffs") or a figure no layoff reaches is not a headcount.
  return total > 0 && total < 500_000 && !(total >= 1990 && total <= 2100 && !n.includes(',')) ? total : null
}

/** Short names a headline uses for a well-known company, mapped to the name it is tracked under (normalized, lower case). */
const BRAND_NAMES: Record<string, string> = {
  amex: 'American Express',
}

/**
 * The company inside a name the shapes above let through (2026-11-13): "SpaceX's AI Group" is SpaceX (a unit of it), and "PVH Simplifies"
 * is PVH (the headline's verb stuck to the name). Each of these made a second page for a company that already had one.
 */
export function cleanName(name: string): string {
  return name
    .replace(/^(.+?)['’]s\s+(?:[\w&-]+\s+){0,3}?(?:group|unit|division|team|arm|business|subsidiary|operations|segment|lab|labs)$/i, '$1')
    .replace(/\s+(?:simplifies|restructures|streamlines|trims|slashes|cuts|reorganizes|reorganises|reshuffles|shrinks|downsizes|eliminates|axes|sheds|lays|plans|unveils)$/i, '')
    .trim()
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
    .replace(/^(?:[A-Za-z][\w-]* ){1,4}(?:company|firm|startup|start-up|maker|giant|platform|provider|unicorn|vendor|retailer|publisher|insurer|lender|carmaker|automaker|airline|developer|host|manufacturer|supplier|brewer|chipmaker|drugmaker|biotech|conglomerate) (?=[A-Z0-9])/, '')
    // "Insurer FM", "Cambridge-based HubSpot", "Norway's biggest bank DNB": a sector word or place in front of the name is not part of it.
    .replace(/^(?:Insurer|Lender|Carmaker|Automaker|Airline|Publisher|Retailer|Chipmaker|Drugmaker|Brewer|Bank|Insurance giant|Tech giant) (?=[A-Z0-9])/, '')
    .replace(/^(?:[A-Z][\w.]*(?: [A-Z][\w.]*)?-based|[A-Z][\w.]*(?: [A-Z][\w.]*)?['’]s (?:biggest|largest|top)) (?:[a-z-]+ ){0,3}?(?=[A-Z0-9])/, '')
    // An aside after the name ("Miro, valued at $17.5B, lays off…").
    .replace(/^([^,]{2,40}),\s*(?:valued at|backed by|which|once valued)[^,]*,\s*/i, '$1 ')
    // A section label in front of the headline is not part of the subject.
    .replace(/^(?:exclusive|breaking|update|report|reports|just in|developing|analysis|opinion)\s*[:|-]\s*/i, '')
  // The owner shapes go first: "Airtable's new owner" is a name-shaped phrase the
  // others would take for the company itself.
  const strong = h.match(OWNER) ?? h.match(TARGET)
    ?? h.match(WITH_COUNT) ?? h.match(LAYOFFS_COUNT) ?? h.match(ANNOUNCES)
    ?? h.match(COUNT_THEN_CUTS) ?? h.match(CUTS_FIRST) ?? h.match(LAYOFFS_PCT) ?? h.match(PCT_LAYOFFS)
    ?? h.match(SHARE_PCT) ?? h.match(SHARE_WORDS) ?? h.match(LARGE_PART) ?? h.match(HEADCOUNT)
    ?? h.match(REDUNDANT) ?? h.match(MERGER)
  // A buyout, relocation or closure is a workforce event only when the headline says people are affected. "Apple to shut down its support
  // forum", "I-64 shut down for hours" and "Tesla to wind down Cybertruck production" are not (found in a dry run, 2026-11-13).
  const buyout = strong ? null : h.match(BUYOUT_OFFER)
  if (/\b(?:box office|representative office|embassy|consulate)\b/i.test(h)) return null
  // A running list of layoffs ('Fierce Biotech Layoff Tracker 2026') is a page about many companies, not one company's layoff.
  if (/\blayoffs? trackers?\b|\btracker\b.*\blayoffs?\b/i.test(h)) return null
  const weak = strong || buyout ? null : h.match(RELOCATION) ?? h.match(CLOSURE)
  if (weak && !PEOPLE_AFFECTED.test(h)) return null
  const m = strong ?? buyout ?? weak
  const raw = (m?.groups?.co ?? m?.groups?.tco?.replace(/\s+(?:teams?|staff|workforce|employees|workers)$/i, ''))?.trim()
  if (!raw) return null
  const named = raw.replace(/\s+(?:merger|acquisition|takeover|deal)$/i, '').replace(/\s+(?:has|have|had|is|are|was|were|moves|may|might)(?: been)?$/i, '').replace(/\s+(?:CEO|CFO|COO|CTO|founder|co-founder|chief\b).*$/i, '').replace(/^the /i, '').replace(/[,:]$/, '').replace(/['’]s$/i, '').trim()
  const company = BRAND_NAMES[cleanName(named).toLowerCase()] ?? cleanName(named)
  if (company.length < 2 || NOT_A_NAME.test(company) || !isPlausibleCompany(company)) return null
  const companyKey = normalizeOrgName(company)
  if (!companyKey) return null
  return { company, companyKey, employees: count(m!.groups?.n, m!.groups?.k), percent: readPercent(h) }
}



/** Words that say people lose or change jobs, or a corporate workplace (not a road, a plant's output or a product) is affected. */
const PEOPLE_AFFECTED = /\b(?:jobs?|workers?|employees?|staff(?:ers)?|workforce|layoffs?|laid off|redundan\w+|headcount|positions|roles|severance|job (?:losses|cuts)|offices?|headquarters|hq|head office|law firm)\b/i

/**
 * Whether a headline points at white-collar work (Census groups 1 and 2), blue-collar work, or neither. Most headlines say neither, so
 * 'unknown' is the common answer and is never a reason to drop one; only the report's frame, not the news check, narrows by it.
 */
export function readCollar(headline: string): 'white' | 'blue' | 'unknown' {
  const white = /\b(?:offices?|headquarters|hq|corporate|back[- ]office|software|engineers?|developers?|tech|bank(?:s|ing)?|finance|financial|consult\w*|law firm|insurance|marketing|sales|managers?|management|executives?|analysts?|accountants?|recruit\w*|HR|AI|studio|media|newsroom|white[- ]collar|salaried|remote)\b/i.test(headline)
  const blue = /\b(?:plants?|factor(?:y|ies)|warehouses?|stores?|restaurants?|mines?|mills?|refiner(?:y|ies)|assembly|production line|drivers?|truckers?|hourly|manufactur\w*|shipyard|fulfillment)\b/i.test(headline)
  return white && !blue ? 'white' : blue && !white ? 'blue' : 'unknown'
}

/** What kind of workforce action a headline reports; names the entry so the alert and the tracker say what happened. */
export type WorkforceEvent = 'layoff' | 'buyout' | 'closure' | 'relocation' | 'merger' | 'redundancy' | 'ai_displacement'

const EVENT_LABEL: Record<WorkforceEvent, string> = {
  layoff: 'Layoff', buyout: 'Voluntary buyout', closure: 'Office, plant or business closure', relocation: 'Relocation',
  merger: 'Merger-related job cuts', redundancy: 'Redundancies', ai_displacement: 'AI-related job cuts',
}
export const workforceEventLabel = (e: WorkforceEvent): string => EVENT_LABEL[e]

/** The most specific event a headline names; a plain layoff when it names none of the others. */
export function readWorkforceEvent(headline: string): WorkforceEvent {
  if (/buy-?outs?|voluntary (?:separation|departure|exit|retirement)|early[- ]retirement/i.test(headline)) return 'buyout'
  if (/\b(?:relocat\w*|moving (?:its )?(?:corporate |global )?(?:headquarters|hq|offices?))\b/i.test(headline)) return 'relocation'
  if (/\b(?:clos(?:e|es|ing|ure|ures)|shut(?:s|ting)? down|shutter\w*|wind(?:s|ing)? down|cease(?:s)? operations|shutdown)\b/i.test(headline)) return 'closure'
  if (/\b(?:merger|acquisition|takeover|combination)\b/i.test(headline)) return 'merger'
  if (/\bredundan(?:t|cies|cy)\b/i.test(headline)) return 'redundancy'
  if (/\b(?:AI|artificial intelligence|automation|automat\w+)\b/.test(headline) || /\bartificial intelligence\b/i.test(headline)) return 'ai_displacement'
  return 'layoff'
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
