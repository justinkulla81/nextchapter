import { createHash } from 'node:crypto'

// Reads bids / RFPs off a workforce board's procurement page. Pure — no network — so the rules are
// tested (src/test/board-bids.test.ts). The page is plain HTML written by a board's staff, so this is
// deliberately forgiving about layout and strict about what counts as a bid: a line must name an
// RFP/RFQ/RFI/IFB/NOFO/solicitation to be kept.

export interface ParsedBid {
  id: string
  title: string
  url: string
  deadline: Date | null
  deadlineText: string | null
  status: 'OPEN' | 'CLOSED'
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const DATE_RE = new RegExp(
  `(\\b${MONTH}\\.? +\\d{1,2}(?:st|nd|rd|th)?,? +20\\d\\d|\\b\\d{1,2}(?:st|nd|rd|th)? +${MONTH}\\.?,? +20\\d\\d|\\b\\d{1,2}/\\d{1,2}/(?:20)?\\d\\d\\b|\\b20\\d\\d-\\d\\d-\\d\\d\\b)`,
  'i',
)
const DEADLINE_WORD = /(due|deadline|closes?|closing|submit|submission|responses?|proposals? (?:are )?due|no later than|until|by)\b/i
const BID_RE = /\b(rfp|rfq|rfi|ifb|itb|nofo|request(?:s)? for (?:proposals?|quotes?|qualifications?|information|applications?|bids?)|invitation (?:for|to) bid|notice of funding|solicitation|bid (?:no|number|#))/i
const CLOSED_WORD = /\b(closed|awarded?|cancel+ed|expired|archived|no longer (?:accepting|available))\b/i
const CLOSED_HEADING = /^(closed|past|previous|prior|archived?|awarded|expired|completed)\b/i
const OPEN_HEADING = /^(open|current|active|available|upcoming|new)\b/i
// Menu / boilerplate lines that name the topic without being a bid.
const NOISE = /^(rfps?|rfqs?|procurement|bids?|bids? (?:and|&) rfps?|rfps? (?:and|&) bids?|current rfps?|rfps? (?:and|&) procurement|vendor forms?|new vendor forms?|previous posts?|next posts?|older posts?|previous post rfp|request for proposals?|requests for proposals?|solicitations?|procurement (?:opportunities|information|policy)|doing business with us|view all|read more|click here)$/i

function decode(s: string): string {
  return s
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

const clean = (s: string) => decode(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

export function parseDate(text: string): Date | null {
  const m = DATE_RE.exec(text)
  if (!m) return null
  const t = m[1].toLowerCase().replace(/(\d)(st|nd|rd|th)/, '$1').replace(/\./g, '').replace(/,/g, '').trim()
  let y: number, mo: number, d: number
  let r: RegExpExecArray | null
  if ((r = /^(20\d\d)-(\d\d)-(\d\d)$/.exec(t))) { y = +r[1]; mo = +r[2] - 1; d = +r[3] }
  else if ((r = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t))) { y = +r[3] < 100 ? 2000 + +r[3] : +r[3]; mo = +r[1] - 1; d = +r[2] }
  else if ((r = /^([a-z]+) +(\d{1,2}) +(20\d\d)$/.exec(t))) { mo = MONTHS.indexOf(r[1].slice(0, 3)); d = +r[2]; y = +r[3] }
  else if ((r = /^(\d{1,2}) +([a-z]+) +(20\d\d)$/.exec(t))) { mo = MONTHS.indexOf(r[2].slice(0, 3)); d = +r[1]; y = +r[3] }
  else return null
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null
  return new Date(Date.UTC(y, mo, d, 23, 59))
}

/** A date counts as a deadline when a deadline word sits just before it. */
function findDeadline(window: string): { date: Date; text: string; tagged: boolean } | null {
  const m = DATE_RE.exec(window)
  if (!m) return null
  const date = parseDate(m[1])
  if (!date) return null
  const before = window.slice(Math.max(0, m.index - 45), m.index)
  return { date, text: m[1], tagged: DEADLINE_WORD.test(before) }
}

export function bidId(boardId: string, title: string): string {
  const key = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return createHash('sha1').update(`${boardId}|${key}`).digest('hex').slice(0, 24)
}

interface Anchor { href: string; text: string }

function absolute(href: string, base: string): string | null {
  if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) return null
  try { return new URL(href, base).toString() } catch { return null }
}

const DUE_LINE = /^(?:proposals?|bids?|responses?|submissions?|quotes?|applications?)\b[^.]{0,40}\b(?:due|must be received|deadline)\b/i
// Prose, Q&A, status messages and page furniture — lines that mention RFPs without naming one.
const PROSE_NOISE = /\(\d{3}\)\s*\d{3}|^q\d+\b|^\(note|^•|^attention:|^(announcement|additional)\b|^(rfps?|rfp\s*\/\s*rfq|rfq|request(?:s)? for (?:proposals?|quotes?|quotations?))\b[^0-9]{0,6}[-–—:]\s*[A-Za-z!'’ .&]*\b(workforce|works|board|careersource|council|partnership|county|network|alliance|region)\b[A-Za-z!'’ .&]*$|^(complete|to|understand|the|date of|redesignation|these|this|all|any)\s|\b(rfps?|rfqs?|itbs?|ifbs?)['’]?s\b|\b(rfps|rfqs)\b|response package|bidders?\b|form below|sign up|distribution list|terms and conditions|periodically|(^|\s)(yourself|you|your|please|must|will|should|can|may|if|who|we|our|are|is|has|have|been)\s|^(q|a)\s*:|^(no|there (?:are|is) no|currently|none)\b|\b(no (?:open|current|active|itns|rfps?)|at this time|not currently|currently has no)\b|[<>]|https?:|\s[|»]\s|&raquo;|\baddend(?:a|um)\b|questions? received|\bq\s*&\s*a\b|\banswers?\b|archives?\b/i
const LINE_NOISE = /\b(responses to questions|questions posted|closing date bid number|bid tabs|official source|sample document|committee meeting|suggested reading|call recording|important dates|application open date|article categories|experience managing|see page|visit the|for assistance|for questions|date of release|business eligible|release date|questions? in writing|addenda|click here|click image|view and download|download (?:the )?(?:entire|complete)|submitted questions)\b/i
const HEADING_NOISE = /^(current|open|closed|past|upcoming|active)\b.*\b(requests? for proposals?|rfps?|solicitations?|bids?)\b|^click\b|^view\b|^download\b/i
const WORDS_IGNORED = new Set(['communication', 'during', 'open', 'current', 'information', 'policy', 'policies', 'procurement', 'process', 'processes', 'questions', 'answers', 'archive', 'archives', 'future', 'home', 'sealed', 'submissions', 'invitation', 'bid', 'bids', 'notice', 'applicants', 'page', 'welcome', 'quotes', 'quote', 'solicitation', 'solicitations', 'opportunities', 'opportunity', 'rfp', 'rfq', 'rfi', 'issues', 'issue', 'request', 'requests', 'for', 'proposal', 'proposals', 'the', 'and', 'of', 'a', 'to', 'services', 'service', 'scwdb'])

function tokens(title: string): Set<string> {
  return new Set(title.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !WORDS_IGNORED.has(w)))
}

function similar(a: string, b: string): boolean {
  const x = tokens(a), y = tokens(b)
  if (x.size === 0 || y.size === 0) return false
  let both = 0
  for (const w of x) if (y.has(w)) both++
  return both >= 2 && both / Math.min(x.size, y.size) >= 0.8 && both / Math.max(x.size, y.size) >= 0.45
}

/** Adds one bid; a second line about the same bid ("SCWDB Issues RFP for X" after "X / Proposals Due ...") is merged into it. */
function addBid(
  title: string, line: string, pageUrl: string, anchors: Anchor[], closedFlag: boolean,
  dl: { date: Date; text: string; tagged: boolean } | null, now: Date, boardId: string, found: Map<string, ParsedBid>,
) {
  const norm = title.toLowerCase()
  const specificAnchor = anchors.find((a) => { const t = a.text.toLowerCase(); return t.length > 6 && (norm.includes(t) || t.includes(norm)) && a.href !== pageUrl })
  // Menu items and headings say "RFPs"; a bid has a topic, a number, a deadline or a document of its own.
  const specific = tokens(title).size >= 3 || !!dl || /\d{2,}/.test(title) || (!!specificAnchor && tokens(title).size >= 2)
  if (!specific) return
  const anchor = anchors.find((a) => { const t = a.text.toLowerCase(); return t.length > 6 && (norm.includes(t) || t.includes(norm)) })
  const url = anchor?.href ?? pageUrl

  const yearInTitle = /\b(20\d\d)\b/.exec(title)
  let status: 'OPEN' | 'CLOSED' = closedFlag || (yearInTitle && +yearInTitle[1] < now.getUTCFullYear()) ? 'CLOSED' : 'OPEN'
  let deadline: Date | null = null
  let deadlineText: string | null = null
  if (dl) {
    deadlineText = dl.text
    if (dl.tagged || dl.date.getTime() > now.getTime()) {
      deadline = dl.date
      if (dl.date.getTime() < now.getTime()) status = 'CLOSED'
    } else if (now.getTime() - dl.date.getTime() > 45 * 86_400_000) {
      // An untagged old date is a posting date for something long since over.
      status = 'CLOSED'
    }
  }

  const twin = [...found.values()].find((b) => similar(b.title, title))
  if (twin) {
    // Keep the first title (it comes from the listing), fill in what the first line lacked.
    if (!twin.deadline && deadline) { twin.deadline = deadline; twin.deadlineText = deadlineText; twin.status = status }
    if (twin.url === pageUrl && url !== pageUrl) twin.url = url
    return
  }
  const id = bidId(boardId, title)
  found.set(id, { id, title: title.slice(0, 200), url, deadline, deadlineText, status })
}

export function extractBids(html: string, pageUrl: string, boardId: string, now: Date): ParsedBid[] {
  const body = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|nav|footer)\b[\s\S]*?<\/\1>/gi, ' ')

  const pageTitle = clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').toLowerCase()
  const anchors: Anchor[] = []
  for (const m of body.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = absolute(decode(m[1]), pageUrl)
    const text = clean(m[2])
    if (href && text) anchors.push({ href, text })
  }

  // One line per block element; headings are kept so Open / Closed sections can be told apart.
  const lines = body
    .replace(/<\/?(p|div|li|tr|br|h[1-6]|ul|ol|table|section|article|td|th|dt|dd|header|main)\b[^>]*>/gi, '\n')
    .split('\n')
    .map(clean)
    .filter(Boolean)

  const found = new Map<string, ParsedBid>()
  let closedSection = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.length < 40 && CLOSED_HEADING.test(line)) { closedSection = true; continue }
    if (line.length < 40 && OPEN_HEADING.test(line) && !BID_RE.test(line.replace(OPEN_HEADING, ''))) { closedSection = false; continue }
    if (line.length < 40 && OPEN_HEADING.test(line)) closedSection = false
    // "Proposals Due: September 18, 2026" under an untitled heading: the lines just above name the bid.
    const dueLine = DUE_LINE.test(line) && DATE_RE.test(line)
    if (dueLine && !BID_RE.test(line)) {
      const above = [lines[i - 2], lines[i - 1]].filter((x): x is string => !!x && x.length >= 8 && x.length < 160 && !NOISE.test(x) && !HEADING_NOISE.test(x) && !DUE_LINE.test(x) && !LINE_NOISE.test(x) && !PROSE_NOISE.test(x) && !/^[a-z]/.test(x))
      const dl = findDeadline(line)
      if (above.length === 0 || !dl) continue
      const title = (above.length === 2 && above[0].length < 90 ? above.join(' - ') : above[above.length - 1]).slice(0, 200)
      // The page's own heading ("Request for Proposal - Org Name") is the page, not a bid on it.
    if (pageTitle && pageTitle.includes(title.toLowerCase())) continue
    addBid(title, line, pageUrl, anchors, closedSection || CLOSED_WORD.test(line), dl, now, boardId, found)
      continue
    }
    if (!BID_RE.test(line) || line.length < 12 || line.length > 150 || NOISE.test(line) || LINE_NOISE.test(line) || HEADING_NOISE.test(line) || /^[a-z]/.test(line) || PROSE_NOISE.test(line) || NOISE.test(line.split(' | ')[0])) continue

    // Title: the line, trimmed of a trailing "Due ..." clause so the same bid reads the same each week.
    const dl = findDeadline([line, lines[i + 1] ?? '', lines[i + 2] ?? ''].join(' | '))
    const title = line.replace(/\s*[-–|(]?\s*(?:due|deadline|closes?|closing)\b.*$/i, '').replace(DATE_RE, '').replace(/[\s\-–|:,(]+$/, '').trim() || line
    if (title.length < 8 || NOISE.test(title) || tokens(title).size < 2) continue
    addBid(title, line, pageUrl, anchors, closedSection || CLOSED_WORD.test(line), dl, now, boardId, found)
  }
  return [...found.values()]
}

/** The link on a board's home page most likely to lead to its procurement page. */
export function procurementLinkCandidates(html: string, baseUrl: string, limit = 3): string[] {
  const base = new URL(baseUrl)
  const scored: { url: string; score: number }[] = []
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = absolute(decode(m[1]), baseUrl)
    if (!url) continue
    let u: URL
    try { u = new URL(url) } catch { continue }
    if (u.host !== base.host || /\.(pdf|docx?|xlsx?|jpe?g|png)$/i.test(u.pathname)) continue
    const blob = `${u.pathname} ${clean(m[2])}`
    let score = 0
    if (/procure|\brfps?\b|\brfqs?\b|solicitation|request(?:s)? for (?:proposal|quote)|\bbids?\b/i.test(blob)) score += 5
    else if (/vendor|contract(?:ing)? opportunit|funding opportunit|doing business/i.test(blob)) score += 2
    if (score) scored.push({ url: u.toString().split('#')[0], score })
  }
  const seen = new Set<string>()
  return scored
    .sort((a, b) => b.score - a.score)
    .filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
    .slice(0, limit)
    .map((s) => s.url)
}

/** Does robots.txt allow this path for us (or for everyone)? Longest matching rule wins; Allow beats Disallow on a tie. */
export function robotsAllows(robotsTxt: string, path: string, agent = 'nextchapterbidfinder'): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = []
  let cur: (typeof groups)[number] | null = null
  let lastWasAgent = false
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line)
    if (!m) continue
    const k = m[1].toLowerCase(), v = m[2].trim()
    if (k === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur) }
      cur.agents.push(v.toLowerCase()); lastWasAgent = true
    } else {
      lastWasAgent = false
      if (cur && (k === 'allow' || k === 'disallow') && v) cur.rules.push({ allow: k === 'allow', path: v })
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.includes(a)))
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules)
  let best: { allow: boolean; len: number } | null = null
  for (const r of rules) {
    const pat = r.path.replace(/\$$/, '')
    const hit = r.path.endsWith('$') ? path === pat : path.startsWith(pat.replace(/\*/g, ''))
    if (hit && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) best = { allow: r.allow, len: r.path.length }
  }
  return best ? best.allow : true
}
