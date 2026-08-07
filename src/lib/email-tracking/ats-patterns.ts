// Prompt 76 — real pattern libraries per category, not one generic
// classifier. ATS systems are formulaic: application confirmations and
// rejections are almost always auto-generated with predictable phrasing, so
// those get dedicated high-confidence patterns rather than relying on
// general-purpose classification for every message. Rejections are
// prioritized for the highest confidence of the inbound categories — both
// the easiest (most standardized phrasing) and the one with the most value
// attached, since it's what triggers Victoria's supportive reframe.

import { extractDomain } from './email-address'

export interface PatternMatch {
  matched: boolean
  confidence: 'high' | 'low'
}

function testAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text))
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
const CONFIRMATION_COMPANY_SUFFIX = /(?:applying to|application (?:has been|was) (?:received|submitted|sent) to)\s+([A-Z][\w&.,'-]*(?:\s[\w&.,'-]+){0,5})\s*$/

export function guessCompanyFromConfirmationSubject(subject: string): string | null {
  const match = subject.match(CONFIRMATION_COMPANY_SUFFIX)
  return match ? match[1].trim() : null
}

// Best-effort only — most confirmation subjects never name the role
// ("Thanks for applying to Foo"), so this only fires on the shapes that
// do ("...for the Senior PM role at Foo", "application for Product
// Manager has been received"). Returning null (common) just means no
// title shows up on that application; nothing downstream treats this as
// authoritative the way a real job-posting fetch would.
const CONFIRMATION_TITLE_PATTERNS = [
  /for the ([A-Z][\w\s/&-]{2,60}?) (?:role|position) at/i,
  /application for (?:the )?([A-Z][\w\s/&-]{2,60}?) (?:role|position)?\s*(?:has been|was) (?:received|submitted|sent)/i,
  /applying (?:for|to) the ([A-Z][\w\s/&-]{2,60}?) (?:role|position)/i,
]

export function guessTitleFromConfirmationSubject(subject: string): string | null {
  for (const pattern of CONFIRMATION_TITLE_PATTERNS) {
    const match = subject.match(pattern)
    if (match) return match[1].trim()
  }
  return null
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
  /would you be (open|interested) (to|in) (a conversation|learning more|exploring)/i,
  /i focus on searches for/i,
  /(executive|retained) search/i,
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
