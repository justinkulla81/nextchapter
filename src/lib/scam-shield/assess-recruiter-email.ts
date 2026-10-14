// Fake-recruiter / fake-job detection for one inbound email. Pure — no I/O —
// so the same rules run in the Gmail sync, the tests, and anywhere else.
//
// The core idea is the one a careful person uses by hand: does the email
// come from, and link to, a domain that actually belongs to the company it
// claims to be from? A real Optavise recruiter writes from an Optavise
// address and books through Optavise's own careers site or a known
// scheduling/ATS service. The fake one wrote from `ourrecruitingteam.org`
// and sent a booking link on `usweb04.org` — neither has anything to do with
// Optavise. Everything else here (urgency, requests for ID or money,
// off-platform chat) corroborates; none of it fires an alert alone.
//
// This is a heuristic, not a verdict. It is tuned so a lone weak signal
// (a recruiter using a personal Gmail, a staffing firm writing for a client)
// stays below the alert line.

import { extractDomain } from '@/lib/email-tracking/email-address'

export type ScamLevel = 'none' | 'suspicious' | 'likely_fake'

export type ScamSignalCode =
  | 'sender_domain_mismatch'
  | 'link_domain_mismatch'
  | 'sender_link_split'
  | 'lookalike_domain'
  | 'display_name_spoof'
  | 'reply_to_mismatch'
  | 'freemail_recruiter'
  | 'auth_failed'
  | 'odd_domain_shape'
  | 'urgency'
  | 'sensitive_info_request'
  | 'money_request'
  | 'off_platform_chat'
  | 'too_good_to_be_true'

export interface ScamSignal {
  code: ScamSignalCode
  weight: number
  // One plain-language sentence, written for the candidate.
  detail: string
}

export interface ScamAssessment {
  level: ScamLevel
  score: number
  claimedCompany: string | null
  // Registrable domains that look wrong (sender, reply-to, links).
  flaggedDomains: string[]
  signals: ScamSignal[]
}

export interface AssessInput {
  from: string
  replyTo?: string
  subject: string
  body: string
  // Every URL found in the message (hrefs and bare links).
  linkUrls: string[]
  // Raw Authentication-Results header, when the mail provider added one.
  authResults?: string
}

export const LIKELY_FAKE_THRESHOLD = 60
export const SUSPICIOUS_THRESHOLD = 30

const NONE: ScamAssessment = { level: 'none', score: 0, claimedCompany: null, flaggedDomains: [], signals: [] }

export const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'aol.com',
  'proton.me', 'protonmail.com', 'mail.com', 'gmx.com', 'yandex.com', 'zoho.com',
])

// Real employers legitimately send candidates to these: ATS, scheduling,
// video, and identity hosts. A link here says nothing about the company, so
// it is neither a match nor a mismatch.
export const TRUSTED_HOSTS = new Set([
  'greenhouse.io', 'greenhouse-mail.io', 'lever.co', 'myworkday.com', 'myworkdayjobs.com', 'ashbyhq.com',
  'smartrecruiters.com', 'linkedin.com', 'lnkd.in', 'indeed.com', 'workablemail.com', 'workable.com', 'icims.com',
  'bamboohr.com', 'comeet.co', 'jobvite.com', 'breezy.hr', 'applytojob.com', 'recruitee.com', 'teamtailor.com',
  'avature.net', 'taleo.net', 'successfactors.com', 'successfactors.eu', 'oraclecloud.com', 'ultipro.com',
  'paylocity.com', 'dayforce.com', 'adp.com', 'eightfold.ai', 'hirevue.com', 'goodtime.io', 'gem.com',
  'calendly.com', 'cal.com', 'zoom.us', 'zoom.com', 'google.com', 'microsoft.com', 'office.com', 'teams.microsoft.com',
  'glassdoor.com', 'ziprecruiter.com', 'wellfound.com', 'dice.com', 'monster.com', 'usajobs.gov',
])

export const SUSPICIOUS_TLDS = new Set(['xyz', 'top', 'click', 'icu', 'shop', 'cfd', 'sbs', 'rest', 'buzz', 'cyou', 'monster', 'gq', 'tk', 'ml', 'ga', 'cf'])

// Words added to a real brand to make a lookalike ("optavise-careers.com").
const LOOKALIKE_FILLER = /(careers?|jobs?|hiring|talent|recruit(?:ing|ment|ers?)?|hr|apply|portal|team|staff(?:ing)?)/

const JOB_CONTEXT = /\b(recruit(?:er|ing|ment)?|interview|position|role|opportunity|opening|hiring|candidate|application|resume|r[eé]sum[eé]|career|job)\b/i

const AGENCY_STYLE = /\b(on behalf of|our client|my client|representing a|retained (?:by|search)|search firm|staffing)\b/i

export const URGENCY = /\b(time[- ]sensitive|act (?:now|fast|immediately)|immediately|urgent(?:ly)?|within (?:the next )?\d+ ?(?:hours?|hrs?|minutes?)|by (?:end of day|tonight|tomorrow)|before you book|expires? (?:today|soon|tonight)|last chance|respond (?:asap|today))\b/i

export const SENSITIVE_INFO =
  /\b(social security|ssn|bank account|routing number|account number|direct deposit|debit card|credit card|passport|driver'?s licen[sc]e|copy of your id|photo of your id|government[- ]issued id|date of birth)\b/i

export const MONEY_REQUEST =
  /\b(gift cards?|cashier'?s check|wire transfer|western union|bitcoin|crypto(?:currency)?|zelle|processing fee|training fee|registration fee|background check fee|application fee|starter kit|pay for (?:your )?(?:equipment|training|software|laptop)|purchase (?:your )?(?:own )?(?:equipment|laptop|software)|reimburse(?:d|ment)? you|we(?:'|’)ll send you a check|deposit(?:ing)? (?:a|the) check)\b/i

export const OFF_PLATFORM =
  /\b(telegram|whats ?app|signal app|wechat|text (?:us|me|our (?:hr|recruiter))|chat[- ]based interview|interview (?:will be )?(?:conducted )?(?:via|on|over) (?:telegram|whats ?app|google chat|hangouts|skype|text))\b/i

export const TOO_GOOD =
  /\b(no experience (?:needed|required|necessary)|earn \$?\d[\d,]*\s*(?:\/|per |a )\s*(?:hour|week|day)|\$\d[\d,]*\s*(?:\/|per |a )\s*(?:hour|week)|you(?:'|’)?ve been (?:selected|chosen|hired)|you are hired|immediate(?:ly)? start|work from home)\b/i

// Phrases that introduce or follow a company name: "interview with
// Optavise", "recruiter for Optavise", "Optavise is hiring", "Optavise CIO
// interview". Phrases match case-insensitively; the name itself is then read
// as up to three capitalized words next to the phrase.
const NAME_AFTER: RegExp[] = [
  /\b(?:interview|role|position|opportunity|opening|career|job|offer)s?[ \t]+(?:at|with)[ \t]+/gi,
  /\b(?:recruiter|recruiting|talent acquisition|hr|hiring manager|representative)[ \t]+(?:at|for|with|from)[ \t]+/gi,
  /\bjoin(?:ing)?[ \t]+(?:the[ \t]+)?(?:team[ \t]+at[ \t]+)?/gi,
]
const NAME_BEFORE: RegExp[] = [
  /[ \t]+(?:is hiring|is looking for|is seeking|is expanding|recruiting team|talent team|careers team|hr team|hiring team)\b/gi,
  /[ \t]+(?:CIO|CFO|CEO|COO|CTO|CMO|VP|Director|Manager|Engineer|Analyst)[ \t]+(?:interview|role|position)\b/gi,
]

const CAP_WORD = /^[A-Z][\w&'.-]*$/

function capitalizedWordsAfter(text: string, index: number): string[] {
  const words: string[] = []
  for (const raw of text.slice(index).split('\n')[0].split(/[ \t]+/).slice(0, 3)) {
    const endsSentence = /[.,;:!?]$/.test(raw)
    const word = raw.replace(/[.,;:!?]+$/, '')
    if (!CAP_WORD.test(word)) break
    words.push(word)
    if (endsSentence) break
  }
  return words
}

function capitalizedWordsBefore(text: string, index: number): string[] {
  const words: string[] = []
  for (const raw of text.slice(Math.max(0, index - 60), index).split('\n').pop()!.split(/[ \t]+/).reverse().slice(0, 3)) {
    if (!raw) continue
    if (!CAP_WORD.test(raw)) break
    words.unshift(raw)
    if (/[.,;:!?]$/.test(raw)) break
  }
  return words
}

// Capitalized words that are never a company name when they head a match.
const NOT_A_COMPANY = new Set([
  'the', 'our', 'your', 'my', 'this', 'that', 'a', 'an', 'we', 'i', 'hi', 'hello', 'dear', 'team', 'hiring', 'recruiting',
  'recruiter', 'talent', 'hr', 'human', 'resources', 'company', 'organization', 'firm', 'client', 'monday', 'tuesday',
  'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december', 'linkedin', 'indeed', 'zoom', 'google', 'microsoft',
  'teams', 'thanks', 'regards', 'best', 'sincerely', 'please', 'senior', 'junior', 'lead', 'chief', 'executive',
])

const COMPANY_TRAILING = /\s+(?:inc|llc|ltd|corp|corporation|co|company|group|team|careers|talent|recruiting|hr|hiring)\.?$/i

// Registrable ("root") domain: last two labels, three for common
// country-code second levels. Deliberately small — a public-suffix list is
// not worth a dependency for a heuristic.
const SECOND_LEVEL_CC = new Set(['co.uk', 'org.uk', 'com.au', 'co.nz', 'co.in', 'com.br', 'co.za', 'com.mx', 'co.jp'])

export function rootDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.')
  if (labels.length <= 2) return labels.join('.')
  const lastTwo = labels.slice(-2).join('.')
  return SECOND_LEVEL_CC.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo
}

export function rootLabel(root: string): string {
  return root.split('.')[0]
}

export function tld(root: string): string {
  return root.split('.').slice(-1)[0]
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

function cleanCompany(words: string[]): string | null {
  const kept = words.filter((w) => !NOT_A_COMPANY.has(w.toLowerCase().replace(/[^a-z]/g, '')))
  if (kept.length === 0) return null
  const name = kept.join(' ').replace(COMPANY_TRAILING, '').replace(/[.,;:!?]+$/, '').trim()
  return name.length >= 3 ? name : null
}

export function findClaimedCompany(from: string, subject: string, body: string): string | null {
  const text = `${subject}\n${body}`
  for (const pattern of NAME_AFTER) {
    for (const m of text.matchAll(pattern)) {
      const name = cleanCompany(capitalizedWordsAfter(text, m.index + m[0].length))
      if (name) return name
    }
  }
  for (const pattern of NAME_BEFORE) {
    for (const m of text.matchAll(pattern)) {
      const name = cleanCompany(capitalizedWordsBefore(text, m.index))
      if (name) return name
    }
  }
  // "Jane Doe | Optavise Talent" / "Optavise Recruiting" display names.
  const display = from.replace(/<[^>]+>/, '').replace(/["']/g, '').trim()
  const fromDisplay = display.match(/(?:[|@•-]\s*|^)([A-Z][\w&'-]+(?:\s+[A-Z][\w&'-]+)?)\s+(?:Talent|Recruiting|Careers|Hiring|HR)\b/)
  if (fromDisplay && !NOT_A_COMPANY.has(fromDisplay[1].toLowerCase())) return fromDisplay[1].trim()
  return null
}

// Does this registrable domain plausibly belong to the company? The brand
// must be the whole domain label ("optavise.com") or the label with a
// short, ordinary qualifier ("optavisehealth.com" counts; handled leniently
// by also matching the first word of a multi-word name).
export function domainBelongsTo(root: string, company: string): boolean {
  const label = normalize(rootLabel(root))
  const full = normalize(company)
  if (!full) return false
  if (label === full) return true
  const first = normalize(company.split(/\s+/)[0])
  if (first.length >= 4 && label === first) return true
  // "optavisehealth" / "optavise-group": brand is a prefix and the rest is not
  // recruiting filler (that shape is the lookalike signal, handled separately).
  if (label.startsWith(full) && !LOOKALIKE_FILLER.test(label.slice(full.length))) return true
  return false
}

export function isLookalike(root: string, company: string): boolean {
  const label = normalize(rootLabel(root))
  const full = normalize(company)
  if (full.length < 5 || label === full) return false
  if (label.includes(full) && LOOKALIKE_FILLER.test(label.replace(full, ''))) return true
  return Math.abs(label.length - full.length) <= 2 && levenshtein(label, full) <= 2
}

export function extractUrlsFromText(text: string): string[] {
  return (text.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ''))
}

export function assessRecruiterEmail(input: AssessInput): ScamAssessment {
  const text = `${input.subject}\n${input.body}`
  if (!JOB_CONTEXT.test(text)) return NONE

  const senderDomain = extractDomain(input.from)
  if (!senderDomain) return NONE
  const senderRoot = rootDomain(senderDomain)
  const senderIsFree = FREE_MAIL.has(senderRoot)
  const senderIsTrusted = TRUSTED_HOSTS.has(senderRoot)

  const company = findClaimedCompany(input.from, input.subject, input.body)
  const agencyStyle = AGENCY_STYLE.test(text)

  const signals: ScamSignal[] = []
  const flagged = new Set<string>()
  const add = (code: ScamSignalCode, weight: number, detail: string) => signals.push({ code, weight, detail })

  const linkRoots = Array.from(
    new Set(input.linkUrls.map(hostOf).filter((h): h is string => !!h).map(rootDomain)),
  ).filter((r) => !TRUSTED_HOSTS.has(r))

  // 1. Sender domain vs. the company it claims to be.
  if (company && !senderIsTrusted && !senderIsFree) {
    if (isLookalike(senderRoot, company)) {
      add('lookalike_domain', 40, `The sender's domain, ${senderRoot}, imitates ${company}'s name without being ${company}'s domain.`)
      flagged.add(senderRoot)
    } else if (!domainBelongsTo(senderRoot, company) && !agencyStyle) {
      add('sender_domain_mismatch', 30, `The email claims to be about ${company} but came from ${senderRoot}, which isn't ${company}'s domain.`)
      flagged.add(senderRoot)
    }
  }
  if (senderIsFree && company && !agencyStyle) {
    add('freemail_recruiter', 15, `A recruiter for ${company} wrote from a personal ${senderRoot} address instead of a company address.`)
  }

  // 2. Display name says one thing, the address another.
  const display = input.from.replace(/<[^>]+>/, '').toLowerCase()
  if (company && !senderIsTrusted && normalize(display).includes(normalize(company)) && !domainBelongsTo(senderRoot, company) && !senderIsFree) {
    add('display_name_spoof', 20, `The sender's name shows "${company}" but the address behind it is ${senderRoot}.`)
    flagged.add(senderRoot)
  }

  // 3. Where the links go.
  const strayLinks = linkRoots.filter((r) => r !== senderRoot)
  const mismatchedLinks = company ? strayLinks.filter((r) => !domainBelongsTo(r, company)) : []
  if (mismatchedLinks.length > 0 && company) {
    add('link_domain_mismatch', 30, `The link${mismatchedLinks.length > 1 ? 's go' : ' goes'} to ${mismatchedLinks.slice(0, 2).join(' and ')}, which ${mismatchedLinks.length > 1 ? "aren't" : "isn't"} ${company}'s domain.`)
    mismatchedLinks.forEach((r) => flagged.add(r))
  }
  if (strayLinks.length > 0 && !senderIsFree && !senderIsTrusted) {
    const stray = strayLinks.filter((r) => !company || !domainBelongsTo(r, company))
    if (stray.length > 0) {
      add('sender_link_split', company ? 15 : 20, `The email comes from ${senderRoot} but its link points to a different site (${stray[0]}).`)
      stray.forEach((r) => flagged.add(r))
    }
  }
  if (company) {
    const lookalikeLink = linkRoots.find((r) => isLookalike(r, company))
    if (lookalikeLink && !signals.some((s) => s.code === 'lookalike_domain')) {
      add('lookalike_domain', 40, `A link goes to ${lookalikeLink}, which imitates ${company}'s name.`)
      flagged.add(lookalikeLink)
    }
  }

  // 4. Reply-To pointing somewhere other than the sender.
  if (input.replyTo) {
    const replyDomain = extractDomain(input.replyTo)
    if (replyDomain) {
      const replyRoot = rootDomain(replyDomain)
      if (replyRoot !== senderRoot && !TRUSTED_HOSTS.has(replyRoot) && !TRUSTED_HOSTS.has(senderRoot)) {
        add('reply_to_mismatch', 20, `Replies would go to ${replyRoot}, not the address that wrote to you.`)
        flagged.add(replyRoot)
      }
    }
  }

  // 5. Mail-provider authentication failures (SPF / DKIM / DMARC).
  if (input.authResults && /\b(?:spf|dkim|dmarc)=fail\b/i.test(input.authResults)) {
    add('auth_failed', 35, "Your mail provider couldn't confirm the sender is who they say they are (a failed sender check).")
  }

  // 6. Shape of the domains involved.
  for (const root of [senderRoot, ...linkRoots]) {
    if (TRUSTED_HOSTS.has(root) || FREE_MAIL.has(root)) continue
    const label = rootLabel(root)
    if (SUSPICIOUS_TLDS.has(tld(root)) || /(?:web|mail|secure|portal|login|hr|apply)\d{1,4}$/.test(label)) {
      add('odd_domain_shape', 10, `${root} has the look of a throwaway domain.`)
      flagged.add(root)
      break
    }
  }

  // 7. What the email asks for or promises.
  if (URGENCY.test(text)) add('urgency', 10, 'It pushes you to act quickly, a common pressure tactic.')
  if (SENSITIVE_INFO.test(text)) add('sensitive_info_request', 35, 'It asks for sensitive personal or financial information.')
  if (MONEY_REQUEST.test(text)) add('money_request', 40, 'It involves you paying money, buying equipment, or handling a check or gift cards.')
  if (OFF_PLATFORM.test(text)) add('off_platform_chat', 20, 'It moves the conversation to a messaging app, which real recruiters rarely require.')
  if (TOO_GOOD.test(text)) add('too_good_to_be_true', 15, 'It promises a job or pay with little or no vetting.')

  const score = signals.reduce((sum, s) => sum + s.weight, 0)
  const level: ScamLevel = score >= LIKELY_FAKE_THRESHOLD ? 'likely_fake' : score >= SUSPICIOUS_THRESHOLD ? 'suspicious' : 'none'

  return {
    level,
    score,
    claimedCompany: company,
    flaggedDomains: Array.from(flagged),
    signals: signals.sort((a, b) => b.weight - a.weight),
  }
}
