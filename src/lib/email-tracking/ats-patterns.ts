// Prompt 76 — real pattern libraries per category, not one generic
// classifier. ATS systems are formulaic: application confirmations and
// rejections are almost always auto-generated with predictable phrasing, so
// those get dedicated high-confidence patterns rather than relying on
// general-purpose classification for every message. Rejections are
// prioritized for the highest confidence of the inbound categories — both
// the easiest (most standardized phrasing) and the one with the most value
// attached, since it's what triggers Victoria's supportive reframe.

import { extractDomain, extractEmailAddress } from './email-address'

export interface PatternMatch {
  matched: boolean
  confidence: 'high' | 'low'
}

function testAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text))
}

// --- BULK / PROMOTIONAL PRE-FILTER ---
//
// A real rejection, offer, interview invite, or recruiter/ATS message is
// individual correspondence about one candidate's application — it never
// carries the machinery of bulk marketing mail. But plenty of unrelated bulk
// mail (retail promos, newsletters, lead-gen ad follow-ups, financial
// solicitations) happens to use phrasing that looks identical to the
// category patterns below on its own ("schedule a call", "decided to move
// forward", "would you be interested in learning more", "keep your resume
// on file" showing up in some unrelated blurb) — that's what let a CB2
// rewards promo classify as a REJECTION and a Force Management sales email
// classify as an INTERVIEW_INVITE. Gmail/Yahoo's 2024 bulk-sender rules
// require a List-Unsubscribe header on essentially all commercial bulk
// mail, and real hiring correspondence never has one, so that header (when
// Gmail exposes it) is the primary, most reliable signal; subject/body/
// sender heuristics below are a fallback for mail that omits it.
const BULK_MAIL_BODY_SIGNALS = [
  /unsubscribe/i,
  /view (this|it) (email|newsletter)? ?(in|as a) (your )?browser/i,
  /update your (email )?preferences/i,
  /you('re| are) receiving this (email|newsletter) because/i,
  /no longer wish to receive/i,
]
const PROMOTIONAL_SUBJECT_SIGNALS = [
  /exclusive offer/i,
  /\$\d+\s*(bonus|off|reward|credit)/i,
  /\d+%\s*off/i,
  /limited time/i,
]
// Matches anywhere in the local part, not just as a strict prefix — real
// production mail from "LinkedIn Job Alerts" uses
// jobalerts-noreply@linkedin.com, which the old strict-prefix version
// (^no-?reply@) never matched, letting an automated job-alert digest slip
// through as if it were a real recruiter contact.
const BULK_SENDER_LOCAL_PART =
  /(^|[.\-_])(no-?reply|donotreply|newsletter|news|deals?|offers?|promos?|promotions?|marketing|updates?|jobalerts?|job-alerts?)([.\-_@]|$)/i

// A handful of platforms whose own outbound-relay domain is never a real
// person's mailbox, regardless of subject/body phrasing — confirmed against
// real production mail where a beehiiv-hosted "138 Social Impact Jobs are
// Live + AI Bots applying for you" newsletter and dealstream.com M&A
// deal-flow blasts ("New Off-Market Businesses For Sale") both used
// "recruiting"/"search"-adjacent language that let them slip past the
// phrasing-only signals above and get flagged as real recruiter contact.
const KNOWN_BULK_SENDER_ROOT_DOMAINS = new Set(['beehiiv.com', 'dealstream.com', 'substack.com'])

// Address-only half of isLikelyBulkOrPromotional — usable anywhere only the
// address is on hand (no stored subject/body/unsubscribe-header data), e.g.
// re-checking an already-synced trackedEmailActivity row at read time. Catches
// an automated sender (LinkedIn Job Alerts, a newsletter, etc.) regardless of
// whether it's also sitting in the candidate's own contact list — a stale
// contact row from before this pattern existed shouldn't keep making every
// future digest from that address read as "a real person waiting on a
// reply."
export function isKnownBulkSenderAddress(fromAddress: string): boolean {
  if (BULK_SENDER_LOCAL_PART.test(extractEmailAddress(fromAddress))) return true
  const domain = extractDomain(fromAddress)
  const rootDomain = domain?.split('.').slice(-2).join('.')
  return !!rootDomain && KNOWN_BULK_SENDER_ROOT_DOMAINS.has(rootDomain)
}

export function isLikelyBulkOrPromotional(
  subject: string,
  bodyPreview: string,
  fromAddress: string,
  hasListUnsubscribeHeader: boolean
): boolean {
  if (hasListUnsubscribeHeader) return true
  if (testAny(bodyPreview, BULK_MAIL_BODY_SIGNALS)) return true
  if (testAny(subject, PROMOTIONAL_SUBJECT_SIGNALS)) return true
  if (BULK_SENDER_LOCAL_PART.test(extractEmailAddress(fromAddress))) return true
  const domain = extractDomain(fromAddress)
  const rootDomain = domain?.split('.').slice(-2).join('.')
  if (rootDomain && KNOWN_BULK_SENDER_ROOT_DOMAINS.has(rootDomain)) return true
  return false
}

// --- INBOUND ---

const REJECTION_HIGH_CONFIDENCE = [
  /we (have )?decided to (move forward|proceed) with (other|another) candidates?/i,
  /we regret to inform you/i,
  /will not be moving forward with your (application|candidacy)/i,
  /we('| ha)ve chosen to pursue other candidates/i,
  /after (careful|further) (consideration|review)[,]? we (have )?decided not to/i,
  /not selected for (this|the) (role|position)/i,
  /we will not be (proceeding|continuing) with your application/i,
  // "Position cancelled/withdrawn" rejections — the employer never picked
  // someone else, they stopped hiring for the role entirely. Distinct
  // phrasing from the "went with another candidate" patterns above, but
  // just as real a rejection for the candidate's own tracking purposes.
  // Confirmed against a real production miss: "At this time, we have
  // decided not to fill this position due to business needs."
  /(have )?decided not to (fill|move forward with) (this|the) (position|role)/i,
  /this position (has been|is no longer being) (filled|pursued|closed)/i,
]
// "Unfortunately" alone used to be in this list — dropped because it's a
// single common English word that matches any unrelated marketing or
// newsletter email that happens to use it, not just rejections.
const REJECTION_LOW_CONFIDENCE = [/other applicants/i, /keep your resume on file/i]

export function matchRejection(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, REJECTION_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
  if (testAny(text, REJECTION_LOW_CONFIDENCE)) return { matched: true, confidence: 'low' }
  return { matched: false, confidence: 'low' }
}

const OFFER_HIGH_CONFIDENCE = [
  /we('| a)re (excited|pleased|thrilled) to offer you/i,
  /(job|employment) offer letter/i,
  /congratulations.{0,40}(offer|position|role)/i,
  /pleased to extend (you |to you )?an offer/i,
]
const OFFER_LOW_CONFIDENCE = [/next steps.{0,30}offer/i, /compensation package/i]

export function matchOffer(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, OFFER_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
  if (testAny(text, OFFER_LOW_CONFIDENCE)) return { matched: true, confidence: 'low' }
  return { matched: false, confidence: 'low' }
}

const INTERVIEW_INVITE_HIGH_CONFIDENCE = [
  /(schedule|scheduling) (a |an )?(interview|phone screen|call)/i,
  /invite you (to|for) (an |a )?(interview|phone screen|onsite|conversation)/i,
  /next steps.{0,30}interview/i,
  /(phone|video) screen (with|scheduled)/i,
  /we'd like to (set up|schedule) a (time|call)/i,
]
const INTERVIEW_INVITE_LOW_CONFIDENCE = [/available (this week|for a call)/i, /chat about the role/i]

export function matchInterviewInvite(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, INTERVIEW_INVITE_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
  if (testAny(text, INTERVIEW_INVITE_LOW_CONFIDENCE)) return { matched: true, confidence: 'low' }
  return { matched: false, confidence: 'low' }
}

const APPLICATION_CONFIRMATION_HIGH_CONFIDENCE = [
  /thanks?( you)? for (applying|your application|your interest)/i,
  /(we('| ha)ve )?received your application/i,
  /your application (has been|was) (received|submitted|sent)/i,
  /application (confirmation|received)/i,
  // Indeed's own confirmation subject never uses any of the phrasing above —
  // it's always exactly "Indeed Application: <job title>".
  /^indeed application:/i,
  // A second, newer LinkedIn confirmation subject shape — "Your application
  // to <role> at <company>" — distinct from "your application was sent to
  // <company>" above (see guessCompanyFromConfirmationSubject's "at"
  // fallback for how the company gets pulled out of this one).
  /your application to .+ at /i,
]

export function matchApplicationConfirmation(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, APPLICATION_CONFIRMATION_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
  return { matched: false, confidence: 'low' }
}

// Confirmation subjects almost always end in the company name ("Thanks for
// applying to ARCHIMED", "your application was sent to ARCHIMED") — worth
// extracting specifically here since the sender domain never has it: these
// come from LinkedIn or a generic ATS mail relay (workablemail.com,
// greenhouse.io, ...), never the hiring company's own domain.
// │ and | are included because staffing/search firms routinely stylize
// their own name with one ("Coda Search│Staffing") — without it the suffix
// regex's end-of-string anchor never matches, and the company-name guess
// silently comes back null for an otherwise-ordinary confirmation subject.
// /i because some senders title-case the whole subject ("Thank You for
// Applying to BGBx") — confirmed against real production mail that the
// case-sensitive version silently lost the company name on those.
//
// Trailing [!.?]* absorbs sentence-ending punctuation after the company name
// ("Thanks for applying to Cohere!") — without it, the end-anchored \s*$
// never matches once anything follows the name, and the whole regex fails
// closed instead of just dropping the punctuation from the capture.
const CONFIRMATION_COMPANY_SUFFIX = /(?:applying to|application (?:has been|was) (?:received|submitted|sent) to)\s+([A-Z][\w&.,'│|-]*(?:\s[\w&.,'│|-]+){0,5})[!.?]*\s*$/i

// The "your application to <role> at <company>" subject shape names the
// company after "at" instead of after "applying to"/"sent to" — needs its
// own pattern since the company here is NOT at a fixed distance from a
// shared keyword the way the suffix pattern above assumes.
const CONFIRMATION_COMPANY_AT_SUFFIX = /\bat\s+([A-Z][\w&.,'│|-]*(?:\s[\w&.,'│|-]+){0,5})[!.?]*\s*$/i

// A third shape leads with the company name instead of ending with it —
// Ashby's own confirmation template ("Legora - Thank you for applying -
// Director of Corporate Development") puts it before a dash separator.
// Confirmed against real production mail: without this, that exact subject
// matched APPLICATION_CONFIRMATION fine but came back with a null company
// name, and syncJobPostingFromEmail's `if (!companyName) return` silently
// dropped the application — correctly detected, never shown to the
// candidate. /i because "Thank You for Applying" is sometimes title-cased.
const CONFIRMATION_COMPANY_PREFIX = /^([A-Z][\w&.,'│|-]*(?:\s[\w&.,'│|-]+){0,4})\s*[-–—:]\s*thank you for applying/i

export function guessCompanyFromConfirmationSubject(subject: string): string | null {
  const prefixMatch = subject.match(CONFIRMATION_COMPANY_PREFIX)
  if (prefixMatch) return prefixMatch[1].trim()
  const suffixMatch = subject.match(CONFIRMATION_COMPANY_SUFFIX)
  if (suffixMatch) return suffixMatch[1].trim()
  const atMatch = subject.match(CONFIRMATION_COMPANY_AT_SUFFIX)
  return atMatch ? atMatch[1].trim() : null
}

// Same phrasing as the subject-based guess above, but scanning the body
// instead — the subject-only version misses any confirmation whose subject
// never names the company at all, e.g. Indeed Apply's "Indeed Application:
// <Job Title>" (the company only appears in the body: "...were sent to
// BioUrja Advisors, LLC. Good luck!"). Bodies rarely end right after the
// company name the way subject lines do, so this stops at the next
// sentence/clause boundary instead of requiring end-of-string.
//
// Comma is deliberately excluded from the word character class (unlike the
// subject patterns above, which can keep it since they're end-anchored) —
// with it included, "BioUrja Advisors, LLC." greedily swallows its own
// comma into the captured name, so the ",\s" boundary alternative right
// below never finds a comma left to match against and the whole pattern
// fails closed. Dropping it from the class turns the comma back into a real
// terminator instead of just more name text.
const CONFIRMATION_COMPANY_MENTION_IN_BODY =
  /(?:applying to|application (?:has been|was) (?:received|submitted|sent) to|items? were sent to)\s+([A-Z][\w&.'-]*(?:\s[\w&.'-]+){0,6}?)(?:\.\s|,\s|\s+—|\s+-\s|\s*$)/

// Last-resort body fallback for confirmations whose body never uses
// "applying to"/"sent to" at all but does name the company after "at" —
// e.g. "...for the role at Hyland." — the same shape the subject-only
// CONFIRMATION_COMPANY_AT_SUFFIX above catches, just not anchored to
// end-of-string since bodies keep going after the company name. Kept as the
// very last fallback (after the "applying to" body match) since a bare "at"
// is common enough in ordinary sentences that it should only fire once
// nothing more specific has already matched.
const CONFIRMATION_COMPANY_AT_MENTION_IN_BODY = /\bat\s+([A-Z][\w&.'-]*(?:\s[\w&.'-]+){0,4}?)(?:\.\s|,\s|!|\s+—|\s+-\s|\s*$)/

export function guessCompanyFromConfirmationText(subject: string, bodyPreview: string): string | null {
  const fromSubject = guessCompanyFromConfirmationSubject(subject)
  if (fromSubject) return fromSubject
  const bodyMatch = bodyPreview.match(CONFIRMATION_COMPANY_MENTION_IN_BODY)
  if (bodyMatch) return bodyMatch[1].trim().replace(/[.,]+$/, '')
  const atMatch = bodyPreview.match(CONFIRMATION_COMPANY_AT_MENTION_IN_BODY)
  return atMatch ? atMatch[1].trim().replace(/[.,]+$/, '') : null
}

// Best-effort only — most confirmation subjects never name the role
// ("Thanks for applying to Foo"), so this only fires on the shapes that
// do ("...for the Senior PM role at Foo", "application for Product
// Manager has been received"). Returning null (common) just means no
// title shows up on that application; nothing downstream treats this as
// authoritative the way a real job-posting fetch would. Every pattern here
// is grounded in a real confirmation subject seen in production mail —
// see the pattern-specific comments below for the exact example.
const CONFIRMATION_TITLE_PATTERNS = [
  /for the ([A-Z][\w\s/&-]{2,60}?) (?:role|position) at/i,
  /application for (?:the )?([A-Z][\w\s/&-]{2,60}?) (?:role|position)?\s*(?:has been|was) (?:received|submitted|sent)/i,
  /applying (?:for|to) the ([A-Z][\w\s/&-]{2,60}?) (?:role|position)/i,
  // "Indeed Application: VP/Director of Buy-Side Advisory" — Indeed's own
  // confirmation subject leads with a fixed prefix and nothing else follows
  // the title, so a broad end-of-string capture (commas, slashes, anything)
  // is safe here in a way it wouldn't be for a subject with more after it.
  /^Indeed Application:\s*(.+)$/i,
  // "Legora - Thank you for applying - Director of Corporate Development" —
  // company-dash-thankyou-dash-title. The company itself is already pulled
  // separately by CONFIRMATION_COMPANY_PREFIX above.
  /thank you for applying\s*[-–—:]\s*(.+)$/i,
  // "We have received your application for Director (Principal), Private
  // Equity" — the reversed word order (received-then-application-then-title)
  // that CONFIRMATION_TITLE_PATTERNS[1] above doesn't cover; requires "for"
  // specifically so it doesn't also fire on "...application to <Company>"
  // subjects that have no title at all.
  /(?:have received|received) your application for (.+)$/i,
  // "We Got It: Thanks for applying for Director, Corporate Development &
  // Special Projects" — "applying for" (not "applying to a company") is
  // reliably title-shaped, unlike the ambiguous "applying to X" shape.
  /thanks for applying for (.+)$/i,
  // "Your application to Strategic Business Development Manager at
  // AscendHire" — title sits between "application to" and " at <Company>";
  // needs the " at [A-Z]" lookahead so it doesn't swallow a bare "your
  // application to <Company>" subject that has no title at all.
  /application to ([A-Z][\w\s/&-]+?) at [A-Z]/,
]

// LinkedIn's "Justin, your application was sent to <Company>" confirmation
// — by far the most common shape in real inboxes — never names the role in
// the subject at all; it's the first line of the body instead, immediately
// after the repeated "Your application was sent to <Company>" line:
//   Your application was sent to Madison Hunt
//
//   Director - M&A
//   Madison Hunt
//   New York City Metropolitan Area
// Confirmed against several real LinkedIn confirmation bodies fetched
// directly via the Gmail API — the raw text/plain part uses \r\n line
// endings (Gmail's actual wire format, not the \n-only shape a hand-typed
// test fixture would use), so this must match (?:\r?\n)+ as one logical
// line break, not \n+ alone — a \n-only version silently failed to extract
// anything from every one of these real bodies. bodyPreview's plain-text
// part (see extractBodyPreview in sync-gmail.ts) keeps the real line
// endings, so this pattern matches against it directly.
const LINKEDIN_SENT_TO_TITLE_IN_BODY = /Your application was sent to [^\r\n]+(?:\r?\n)+([^\r\n]+)(?:\r?\n)/i

// Workable's own confirmation body ("Your application for the Vice
// President, The AI Access Initiative job was submitted successfully.") —
// unlike LinkedIn's template, Workable's subject line never names the role
// at all ("Thanks for applying to <Company>"), so this is the only place
// the title shows up. Confirmed against a real Workable confirmation body
// fetched via the Gmail API. Non-greedy up to " job was submitted" so a
// title containing its own comma (as in the example above) is captured
// whole rather than truncated at the first comma.
const WORKABLE_APPLICATION_FOR_TITLE_IN_BODY = /application for (?:the )?(.+?) job was submitted/i

export function guessTitleFromConfirmationSubject(subject: string): string | null {
  for (const pattern of CONFIRMATION_TITLE_PATTERNS) {
    const match = subject.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

export function guessTitleFromConfirmationText(subject: string, bodyPreview: string): string | null {
  const fromSubject = guessTitleFromConfirmationSubject(subject)
  if (fromSubject) return fromSubject
  const linkedInMatch = bodyPreview.match(LINKEDIN_SENT_TO_TITLE_IN_BODY)
  if (linkedInMatch) return linkedInMatch[1].trim()
  const workableMatch = bodyPreview.match(WORKABLE_APPLICATION_FOR_TITLE_IN_BODY)
  return workableMatch ? workableMatch[1].trim() : null
}

// Real recruiter outreach — especially from executive-search firms — very
// rarely says "I'm a recruiter" or comes from a careers@/recruiting@ inbox;
// it comes from a named person at their firm's own domain, introducing
// themselves by practice area and asking to connect. Phrasing alone misses
// most of these, so KNOWN_RECRUITING_FIRM_DOMAINS below matches by sender
// domain instead — much more reliable for firms that email under their own
// name rather than a generic alias.
const RECRUITER_OUTREACH_HIGH_CONFIDENCE = [
  /i('m| am) a recruiter (at|with)/i,
  /came across your (profile|resume|background)/i,
  /reaching out (about|regarding) (an?|the) (opportunity|role|opening)/i,
  /would you be (open|interested) (to|in) (a conversation|learn(ing)? more|exploring)/i,
  /i focus on searches for/i,
  /(executive|retained|confidential) search/i,
  /i'?m representing a (company|client|firm)/i,
  /(starting|beginning) work on a (new )?(leadership |sustainability-focused )?role/i,
  /reach(ed| out)? to hear the latest on how things are going/i,
  /would love your (perspective|thoughts) as we('re| are) (starting|beginning)/i,
  /give me a call directly at/i,
  /new message from .* on linkedin/i,
]
const RECRUITER_SENDER_DOMAIN_HINTS = [/careers@/i, /recruiting@/i, /talent@/i, /recruiter@/i]

// Retained-search / executive-search and staffing firms whose recruiters
// email candidates directly under the firm's own domain rather than a
// generic alias — not exhaustive, just the largest and most common ones.
// Anything outside this list still gets a shot at matching on phrasing above.
const KNOWN_RECRUITING_FIRM_DOMAINS = new Set([
  'spencerstuart.com',
  'kornferry.com',
  'heidrick.com',
  'russellreynolds.com',
  'egonzehnder.com',
  'odgersberndtson.com',
  'dhrglobal.com',
  'zrgpartners.com',
  'wittkieffer.com',
  'diversifiedsearchgroup.com',
  'n2growth.com',
  'boyden.com',
  'lhh.com',
  'roberthalf.com',
  'michaelpage.com',
  'robertwalters.com',
  'randstad.com',
  'randstadusa.com',
  'manpowergroup.com',
  'adecco.com',
  'kellyservices.com',
  'insightglobal.com',
  'teksystems.com',
  'aerotek.com',
  'vaco.com',
  'addisongroup.com',
  'motionrecruitment.com',
  'jobot.com',
  'truesearch.com',
])

export function matchRecruiterOutreach(subject: string, bodyPreview: string, fromAddress: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  const domain = extractDomain(fromAddress)
  if (
    testAny(text, RECRUITER_OUTREACH_HIGH_CONFIDENCE) ||
    testAny(fromAddress, RECRUITER_SENDER_DOMAIN_HINTS) ||
    (domain && KNOWN_RECRUITING_FIRM_DOMAINS.has(domain))
  ) {
    return { matched: true, confidence: 'high' }
  }
  return { matched: false, confidence: 'low' }
}

// --- OUTBOUND (Sent) — four separate categories, never merged ---

const THANK_YOU_HIGH_CONFIDENCE = [
  /thank you (so much )?for (taking the time|the conversation|meeting( with me)?|speaking with me)/i,
  /taking the time to (speak|meet|chat|talk) with me/i,
  /(great|wonderful|enjoyed) (speaking|talking|meeting) with you (today|yesterday)/i,
  /thanks again for (the|our) (conversation|interview|chat)/i,
]

// A real thank-you note is often just a bare subject like "Thank You" with
// all the substance in the body — match the bare subject directly rather
// than rely on body phrasing alone, since a short reply's body can be just
// as terse ("Thanks again!").
const THANK_YOU_BARE_SUBJECT = /^(re:\s*)?thanks?( you)?[!.]{0,3}$/i

export function matchThankYou(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, THANK_YOU_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
  if (THANK_YOU_BARE_SUBJECT.test(subject.trim())) return { matched: true, confidence: 'high' }
  return { matched: false, confidence: 'low' }
}

// Follow-up and check-in used to be tracked as two separate categories, but
// they're the same real-world action from the candidate's side ("I
// re-reached out") and were shown as one merged stat — so this single
// matcher covers both phrasings rather than splitting hairs between
// "following up on X" and "checking in on X".
const FOLLOW_UP_HIGH_CONFIDENCE = [
  /following[\s-]?up on (my|our) (application|conversation|previous email)/i,
  /wanted to follow[\s-]?up (on|regarding)/i,
  /circling back (on|regarding)/i,
  /touch(ing)?\s*base (on|regarding|about)/i,
  /still (very )?interested in (the|this) (role|position|opportunity)/i,
  /(just )?checking in (to see|on) (if|whether)/i,
  /wanted to (check in|reconnect) (about|regarding) my application/i,
]

// Real follow-ups are very often just a short, literal subject with the
// substance (if any) in the body, and are very often replies within an
// existing thread ("Re: Interview Follow-up") — so the "Re:" prefix is
// accepted here as part of the bare-subject shape, not required.
const FOLLOW_UP_BARE_SUBJECT =
  /^(re:\s*)?(follow[\s-]?up|following[\s-]?up|check(ing)?[\s-]?in|touch(ing)?\s*base|reconnecting|circling back)[!.?]{0,3}$/i

export function matchFollowUp(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, FOLLOW_UP_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
  if (FOLLOW_UP_BARE_SUBJECT.test(subject.trim())) return { matched: true, confidence: 'high' }
  return { matched: false, confidence: 'low' }
}

const INTRO_REQUEST_HIGH_CONFIDENCE = [
  /would you be willing to introduce me/i,
  /(could|can) you (make|do) an introduction/i,
  /(would love|hoping) (for|to get) an intro(duction)? to/i,
  /connect me with/i,
  /mind introducing me/i,
]

export function matchIntroRequest(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, INTRO_REQUEST_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
  return { matched: false, confidence: 'low' }
}

// A first-time "cold" networking message has no fixed template the way a
// follow-up or thank-you does, but real search-related outreach does
// cluster around a recognizable set of phrases. High confidence requires an
// actual networking-shaped phrase; the low-confidence list is bare keywords
// ("job", "help", "connection") that show up in plenty of unrelated
// subjects too, so those get tracked (visible in Needs Review) but never
// auto-credited — see the high-confidence-only gate in sync-gmail.ts.
const NETWORKING_OUTREACH_HIGH_CONFIDENCE = [
  /\b(grab|get)\s+(a\s+)?(coffee|lunch)\b/i,
  /\b(quick|brief)\s+call\b/i,
  /pick your brain/i,
  /\b(career|job search)\s+advice\b/i,
  /\byour advice\b/i,
  /\b(starting|in the middle of)\s+(my\s+|a\s+)?job search\b/i,
  /\breaching out\b/i,
]
const NETWORKING_OUTREACH_LOW_CONFIDENCE = [
  /\bnetworking\b/i,
  /\bconnection\b/i,
  /\bfeedback\b/i,
  /\bintro(duction)?\b/i,
  /\bhelp\b/i,
  /\bjob\b/i,
  /\bnext chapter\b/i,
]

// Same reasoning as THANK_YOU_BARE_SUBJECT above — a bare "Coffee" or
// "Lunch?" subject on a real invite is common enough to match directly.
const NETWORKING_OUTREACH_BARE_SUBJECT = /^(coffee|lunch|coffee chat|grab (a )?(coffee|lunch))[!.?]{0,3}$/i

// A resume/CV/cover letter is only a networking signal when it was
// actually attached — the keywords alone show up in plenty of unrelated
// mail ("still working on my resume"), so this requires both.
const RESUME_SHARE_KEYWORDS = /\b(resume|r[ée]sum[ée]|cover letter|\bcv\b|application|applying)\b/i

// Real resume/CV/cover-letter attachments are usually named after what they
// are ("Jane_Doe_Resume.pdf") even when the email body itself says nothing
// more than "please see attached" — so a matching filename alone is enough,
// no subject/body keyword needed. Separators are normalized to spaces first
// so "_"/"-"/"." don't defeat the \b word boundaries.
const RESUME_FILENAME_KEYWORDS = /\b(resume|r[ée]sum[ée]|cv|curriculum vitae|cover ?letter)\b/i

function isResumeFilename(filename: string): boolean {
  return RESUME_FILENAME_KEYWORDS.test(filename.toLowerCase().replace(/[_\-.]+/g, ' '))
}

export function matchResumeShared(subject: string, bodyPreview: string, attachmentFilenames: string[]): boolean {
  if (attachmentFilenames.some(isResumeFilename)) return true
  return attachmentFilenames.length > 0 && RESUME_SHARE_KEYWORDS.test(`${subject} ${bodyPreview}`)
}

export function matchNetworkingOutreach(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, NETWORKING_OUTREACH_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
  if (NETWORKING_OUTREACH_BARE_SUBJECT.test(subject.trim())) return { matched: true, confidence: 'high' }
  if (testAny(text, NETWORKING_OUTREACH_LOW_CONFIDENCE)) return { matched: true, confidence: 'low' }
  return { matched: false, confidence: 'low' }
}

// Coursera/edX's own standardized completion-email phrasing — checked
// only against mail from those platforms' own domains (sync-gmail.ts), so
// this never has to guess at an arbitrary sender's "congratulations"
// email being about a course.
const COURSE_COMPLETION_PATTERNS = [
  /congratulations[,!]?\s+you('ve| have)\s+(successfully\s+)?completed/i,
  /you('ve| have)\s+successfully\s+completed/i,
  /your\s+certificate\s+(is\s+ready|has\s+been\s+issued)/i,
  /certificate\s+of\s+completion/i,
]

export function matchCourseCompletion(subject: string, bodyPreview: string): boolean {
  return testAny(`${subject} ${bodyPreview}`, COURSE_COMPLETION_PATTERNS)
}
