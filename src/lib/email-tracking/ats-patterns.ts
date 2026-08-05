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

export function matchThankYou(subject: string, bodyPreview: string): PatternMatch {
  const text = `${subject} ${bodyPreview}`
  if (testAny(text, THANK_YOU_HIGH_CONFIDENCE)) return { matched: true, confidence: 'high' }
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
