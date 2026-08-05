// Prompt 76 — real pattern libraries per category, not one generic
// classifier. ATS systems are formulaic: application confirmations and
// rejections are almost always auto-generated with predictable phrasing, so
// those get dedicated high-confidence patterns rather than relying on
// general-purpose classification for every message. Rejections are
// prioritized for the highest confidence of the inbound categories — both
// the easiest (most standardized phrasing) and the one with the most value
// attached, since it's what triggers Victoria's supportive reframe.

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
const REJECTION_LOW_CONFIDENCE = [/unfortunately/i, /other applicants/i, /keep your resume on file/i]

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

const RECRUITER_OUTREACH_HIGH_CONFIDENCE = [
  /i('m| am) a recruiter (at|with)/i,
  /came across your (profile|resume|background)/i,
  /reaching out (about|regarding) (an?|the) (opportunity|role|opening)/i,
  /would you be (open|interested) (to|in) (a conversation|learning more|exploring)/i,
]
const RECRUITER_SENDER_DOMAIN_HINTS = [/careers@/i, /recruiting@/i, /talent@/i, /recruiter@/i]

export function matchRecruiterOutreach(subject: string, bodyPreview: string, fromAddress: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, RECRUITER_OUTREACH_HIGH_CONFIDENCE) || testAny(fromAddress, RECRUITER_SENDER_DOMAIN_HINTS)) {
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

// This whole feature never reads the message body (see the Gmail connect
// copy: "never the message body"), so classification runs on the subject
// line alone. A real thank-you note commonly carries the phrase in the
// body and just a bare subject like "Thank You" — with no body to check,
// that subject on its own is otherwise unclassifiable and falls to Needs
// Review. Match it directly rather than lose it.
const THANK_YOU_BARE_SUBJECT = /^thanks?( you)?[!.]{0,3}$/i

export function matchThankYou(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, THANK_YOU_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
  if (THANK_YOU_BARE_SUBJECT.test(subject.trim())) return { matched: true, confidence: 'high' }
  return { matched: false, confidence: 'low' }
}

const FOLLOW_UP_HIGH_CONFIDENCE = [
  /following up on (my|our) (application|conversation|previous email)/i,
  /wanted to follow up (on|regarding)/i,
  /circling back (on|regarding)/i,
]

export function matchFollowUp(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, FOLLOW_UP_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
  return { matched: false, confidence: 'low' }
}

// Distinct from a follow-up on a specific prior exchange — "still
// interested, checking in" language with no reference to a particular
// earlier conversation.
const CHECK_IN_HIGH_CONFIDENCE = [
  /still (very )?interested in (the|this) (role|position|opportunity)/i,
  /(just )?checking in (to see|on) (if|whether)/i,
  /wanted to (check in|reconnect) (about|regarding) my application/i,
]

export function matchCheckIn(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, CHECK_IN_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
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

// Same reasoning as THANK_YOU_BARE_SUBJECT above — with no body to read, a
// bare "Coffee" or "Lunch?" subject on a real invite has nothing else to
// match against.
const NETWORKING_OUTREACH_BARE_SUBJECT = /^(coffee|lunch|coffee chat|grab (a )?(coffee|lunch))[!.?]{0,3}$/i

export function matchNetworkingOutreach(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, NETWORKING_OUTREACH_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
  if (NETWORKING_OUTREACH_BARE_SUBJECT.test(subject.trim())) return { matched: true, confidence: 'high' }
  if (testAny(text, NETWORKING_OUTREACH_LOW_CONFIDENCE)) return { matched: true, confidence: 'low' }
  return { matched: false, confidence: 'low' }
}
