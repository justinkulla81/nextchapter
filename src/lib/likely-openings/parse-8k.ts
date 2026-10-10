// Rule-based reader for 8-K Item 5.02 ("Departure of Directors or Certain
// Officers; Election of Directors; Appointment of Certain Officers"). Pure
// functions — no network, no database — so the tests can feed fixture text.
//
// Rules first: the filings are formulaic legal prose ("notified the Company
// of her decision to resign as Chief Financial Officer"). Sections the rules
// flag get a Claude Haiku second read (llm-read.ts) for the judgment calls —
// division presidents, merger boilerplate — with these rules as the fallback.

import { ROLE_PATTERNS, ROLE_LABELS, type OfficerRole } from './roles'

export interface Item502Read {
  /** Roles that are, or are about to be, open: departed with no permanent successor named, or filled only by an interim. */
  openings: OfficerRole[]
  /** Roles a permanent new person was appointed to. */
  appointed: OfficerRole[]
  /** Roles filled by an interim/acting appointment (subset of openings). */
  interim: OfficerRole[]
  /** The filing says a search is under way. */
  searchUnderway: boolean
}

const DEPARTURE_RE =
  /\b(resign(?:s|ed|ing|ation)?|retire(?:s|d|ment)?|retiring|depart(?:s|ed|ing|ure)?|step(?:s|ped|ping)? down|terminat(?:e|ed|es|ing|ion)|separat(?:e|ed|es|ing|ion)|will leave|leaving|no longer serve|cease(?:s|d)? to serve|transition(?:ing)? out|removed|stepping down)\b/i
const APPOINTMENT_RE =
  /\b(appoint(?:s|ed|ing|ment)?|named(?! executive officers?)|elect(?:s|ed|ion)?|promot(?:e|ed|ion)|hired|succeed(?:s|ed|ing)?\s+(?:[A-Z][\w.'-]*,?\s+){1,5}as\b|to serve as|will serve as|will become|has become)\b/i
const SEARCH_RE =
  /\b(commenced|begun|began|initiated|launch(?:ed)?|conduct(?:ing)?|engaged? an? (?:executive )?search firm)\b[^.]{0,80}\bsearch\b|\bsearch (?:for|process)\b[^.]{0,60}\b(successor|replacement|permanent)\b|\bidentify(?:ing)? a (?:permanent )?(successor|replacement)\b/i
// Sentences that are about someone's past career, not an event in this
// filing ("He previously served as Chief Financial Officer of Acme").
const BIOGRAPHY_RE =
  /\b(previously|prior to (?:joining|that|this)|has served|had served|served as|from \d{4} (?:to|until)|since (?:january|february|march|april|may|june|july|august|september|october|november|december)? ?\d{4}|age \d{2}|biograph|earlier in (?:his|her|their) career|holds? a (?:bachelor|master|b\.?s|m\.?b\.?a))\b/i
const COMPENSATION_RE =
  /\b(in the event (?:of|that)|upon (?:a |any |such |his |her |their |the executive's )?(?:qualifying )?termination|if (?:his|her|their|the executive's) employment|change (?:in|of) control|without cause|for good reason|eligible to receive|entitled to|severance (?:plan|policy|agreement))\b/i
const PROMOTION_RE = /\b(promot(?:e|ed|ion)|currently serv(?:es|ing) as|current (?:executive vice president and )?chief)\b/i
const CONTINUES_RE = /\bcontinue(?:s|d)? to serve\b|\bwill remain\b/i
// "...previously disclosed..." recaps an old event; not news.
const OLD_NEWS_RE = /\bpreviously (?:disclosed|reported|announced)\b/i
// The title someone holds before an appointment ("Jane Doe, the Company's
// current President and Chief Operating Officer, as Chief Executive Officer").
const PRIOR_TITLE_RE =
  /\b(?:current|currently(?: serves as| serving as)?|presently|formerly|who (?:has )?serve[sd]? as)\s+((?:the\s+)?(?:company's\s+)?(?:[a-z,&]+\s+){0,4})$/i
// A role named only as someone's boss or office ("Senior Advisor to the
// Chief Executive Officer", "reporting to the CEO", "Office of the CEO").
const RELATIONAL_RE = /\b(?:to|of|reporting to|reports to|report to)\s+(?:the\s+)?(?:company's\s+)?$/i
const SUCCESSOR_NAMED_RE = /\b(?:his|her|their) successor,?\s+(?:mr|ms|mrs|dr)\.?\s/i
const INTERIM_RE = /\b(interim|acting|temporary)\s+(?:[a-z]+\s+){0,3}$/i

/** HTML -> readable text: drop scripts/styles/inline-XBRL header, tags and entities, collapse whitespace. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<ix:header>[\s\S]*?<\/ix:header>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&(rsquo|lsquo|#8217|#8216|#x2019);/gi, "'")
    .replace(/&(rdquo|ldquo|#8220|#8221|#x201c|#x201d);/gi, '"')
    .replace(/&(mdash|ndash|#8212|#8211);/gi, '-')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[   ]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The Item 5.02 section of an 8-K's text: from an "Item 5.02" heading to the
 * next "Item N.NN" heading or the signature block. The cover page and table
 * of contents also say "Item 5.02", so take the longest candidate section.
 */
export function extractItem502(text: string): string | null {
  const starts = [...text.matchAll(/\bitem\s*5\.02\b/gi)].map((m) => m.index ?? 0)
  if (starts.length === 0) return null
  let best = ''
  for (const start of starts) {
    const rest = text.slice(start + 9)
    const end = rest.search(/\b[Ii][Tt][Ee][Mm]\s*(?!5\.02)\d\.\d{2}\b|\bSIGNATURES?\b|\bPursuant to the requirements of the Securities Exchange Act\b/)
    const section = (end === -1 ? rest : rest.slice(0, end)).trim()
    if (section.length > best.length) best = section
  }
  // Strip the item's own long title so its words ("Departure", "Appointment")
  // never count as events.
  best = best.replace(
    /^\.?\s*departure of directors or (?:certain )?officers;?\s*election of directors;?\s*appointment of (?:certain )?officers;?\s*(?:and\s*)?compensatory arrangements of certain officers\.?/i,
    ''
  )
  return best.trim() || null
}

function splitSentences(section: string): string[] {
  // Abbreviations that end in a period mid-sentence in these filings.
  const guarded = section
    .replace(/\b(Mr|Ms|Mrs|Dr|Inc|Corp|Co|Ltd|Jr|Sr|No|U\.S|St)\./g, '$1<dot>')
    .replace(/\b([A-Z])\.(?=\s+[A-Z])/g, '$1<dot>') // initials: "K. Christopher Farkas"
  return guarded
    .split(/(?<=[.;])\s+(?=[A-Z("])/)
    .map((s) => s.replace(/<dot>/g, '.').trim())
    .filter(Boolean)
}

interface RoleHit {
  role: OfficerRole
  index: number
  interim: boolean
  prior: boolean
}

function isPriorTitle(before: string): boolean {
  const m = before.match(PRIOR_TITLE_RE)
  // "current Chief Operating Officer, as [Chief Executive Officer]" — the
  // chain crossed into the new title.
  return !!m && !/\b(as|to)\b/i.test(m[1])
}

function findRoles(sentence: string): RoleHit[] {
  const hits: RoleHit[] = []
  const taken: [number, number][] = []
  for (const { role, re } of ROLE_PATTERNS) {
    re.lastIndex = 0
    for (const m of sentence.matchAll(re)) {
      const index = m.index ?? 0
      const end = index + m[0].length
      if (taken.some(([a, b]) => index < b && end > a)) continue
      taken.push([index, end])
      const before = sentence.slice(Math.max(0, index - 60), index)
      // The text right before this role, back to the previous role mention
      // ("President and" before "Chief Operating Officer" still counts as
      // the same prior-title phrase).
      if (RELATIONAL_RE.test(before)) continue
      hits.push({ role, index, interim: INTERIM_RE.test(before), prior: isPriorTitle(before) })
    }
  }
  return hits.sort((a, b) => a.index - b.index)
}

/** Read one Item 5.02 section into opened / appointed roles. */
export function readItem502(section: string): Item502Read {
  const departed = new Set<OfficerRole>()
  const appointed = new Set<OfficerRole>()
  const interim = new Set<OfficerRole>()
  const vacatedByPromotion = new Set<OfficerRole>()
  const searchUnderway = SEARCH_RE.test(section)

  for (const sentence of splitSentences(section)) {
    const roles = findRoles(sentence)
    if (roles.length === 0) continue
    // Employment-agreement terms ("upon a termination without cause, the
    // CEO will receive...") describe what would happen, not a departure.
    const dep = COMPENSATION_RE.test(sentence) || OLD_NEWS_RE.test(sentence) ? null : DEPARTURE_RE.exec(sentence)
    // "will continue to serve as principal accounting officer" is no change.
    const app = CONTINUES_RE.test(sentence) ? null : APPOINTMENT_RE.exec(sentence)
    // A pure biography sentence has no event of its own; but "Ms. X, who
    // has served as CFO since 2019, will retire" still has one, so only skip
    // when nothing in the sentence is a departure or appointment.
    if (BIOGRAPHY_RE.test(sentence) && !dep && !app) continue
    if (!dep && !app) continue

    if (app && !dep) {
      // Roles named after the appointment verb are what the person was
      // appointed to; roles before it are usually their current title.
      // Exception: a promotion vacates the title held before it ("Jane
      // Doe, currently Chief Financial Officer, was promoted to CEO" opens
      // the CFO seat).
      const promotion = PROMOTION_RE.test(sentence)
      for (const hit of roles) {
        if (hit.prior) {
          vacatedByPromotion.add(hit.role)
          continue
        }
        if (hit.index < app.index) {
          if (promotion && !hit.interim) vacatedByPromotion.add(hit.role)
          continue
        }
        if (hit.interim) interim.add(hit.role)
        else appointed.add(hit.role)
      }
      continue
    }

    if (dep && !app) {
      // "...effective upon the appointment of her successor, Ms. Roe" — the
      // seat is already filled.
      const filled = SUCCESSOR_NAMED_RE.test(sentence)
      for (const hit of roles) (filled ? appointed : departed).add(hit.role)
      continue
    }

    // Both in one sentence: "X will step down as CEO and Y has been
    // appointed CEO" / "the Board appointed Y as Interim CFO following X's
    // resignation". Interim roles are openings either way; a role that
    // appears after the appointment verb is the appointment, the rest
    // departures.
    if (!app || !dep) continue
    for (const hit of roles) {
      if (hit.interim) interim.add(hit.role)
      else if (SUCCESSOR_NAMED_RE.test(sentence)) appointed.add(hit.role)
      else if (hit.index > app.index && (app.index > dep.index || hit.index < dep.index)) appointed.add(hit.role)
      else departed.add(hit.role)
    }
  }

  for (const role of vacatedByPromotion) if (!appointed.has(role)) departed.add(role)
  // A role with a permanent successor named is filled, not open — unless the
  // only "appointment" to it was interim.
  const openings = new Set<OfficerRole>()
  for (const role of departed) if (!appointed.has(role)) openings.add(role)
  for (const role of interim) if (!appointed.has(role)) openings.add(role)
  // An interim appointment is not a permanent one.
  for (const role of interim) appointed.delete(role)

  return {
    openings: [...openings],
    appointed: [...appointed],
    interim: [...interim].filter((r) => openings.has(r)),
    searchUnderway,
  }
}

function roleList(roles: OfficerRole[]): string {
  const labels = roles.map((r) => ROLE_LABELS[r])
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

export interface ExecSignalDraft {
  signalType: 'EXEC_DEPARTURE' | 'EXEC_APPOINTMENT'
  roles: OfficerRole[]
  summary: string
}

/** The "why this matters" sentence that follows a signal's lead sentence. */
export function signalTail(signalType: ExecSignalDraft['signalType'], read: Item502Read): string {
  if (signalType === 'EXEC_DEPARTURE') {
    return read.interim.length > 0
      ? 'An interim is covering while they look for a permanent hire.'
      : read.searchUnderway
        ? 'The company says a search is under way.'
        : 'A search for a replacement usually follows.'
  }
  return read.appointed.includes('CEO')
    ? 'New chief executives often rebuild the leadership team in their first year.'
    : 'New leaders often bring in or reshape the senior team under them.'
}

/**
 * Turn a read into at most two signals: an opening (departure, or interim
 * fill) and a leadership change (permanent appointment). Summaries are plain
 * language for candidates — no filing jargon. `lead` replaces the
 * rule-written first sentence (the Haiku pass supplies one).
 */
export function execSignalsFrom(companyName: string, read: Item502Read, lead?: string): ExecSignalDraft[] {
  const out: ExecSignalDraft[] = []
  if (read.openings.length > 0) {
    const first = lead ?? `${companyName}'s ${roleList(read.openings)} ${read.openings.length > 1 ? 'are' : 'is'} leaving.`
    // A written lead that already mentions the search or interim needs no tail.
    const covered = lead !== undefined && /\b(search|searching|interim|acting|successor)\b/i.test(lead)
    out.push({ signalType: 'EXEC_DEPARTURE', roles: read.openings, summary: covered ? first : `${first} ${signalTail('EXEC_DEPARTURE', read)}` })
  }
  if (read.appointed.length > 0) {
    const first = lead ?? `${companyName} named a new ${roleList(read.appointed)}.`
    out.push({ signalType: 'EXEC_APPOINTMENT', roles: read.appointed, summary: `${first} ${signalTail('EXEC_APPOINTMENT', read)}` })
  }
  return out
}

// Filers that are investment vehicles with no staff of their own: funds,
// ETFs, BDCs (file numbers 814-), commodity pools and blank-check shells.
export function isNonOperating8kFiler(name: string, sics: string[], fileNums: string[]): boolean {
  if (/\b(fund|etf|trust\s+(?:i+|series)|acquisition corp(?:oration)?|capital acquisition)\b/i.test(name)) return true
  if (sics.some((s) => ['6221', '6726', '6770'].includes(s))) return true
  if (fileNums.some((f) => f.startsWith('814-'))) return true
  return false
}
