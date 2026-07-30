export interface CalendarClassificationResult {
  eventType: 'INTERVIEW' | 'NETWORKING_CALL' | 'NEEDS_REVIEW'
  confidence: 'high' | 'low'
}

// Title-only classification — calendar.events.readonly gives us the event
// title, so unlike email (subject + a body preview) there's only one signal
// to work from. Interview patterns first and given priority: unambiguous
// hiring-process language, checked before the broader networking patterns
// so "Coffee chat interview debrief" (rare, but plausible) still lands as
// an interview.
const INTERVIEW_PATTERNS: RegExp[] = [
  /\binterview(s|ing)?\b/i,
  /\bphone screen\b/i,
  /\bhiring manager (call|chat|screen)\b/i,
  /\btechnical (screen|interview|assessment)\b/i,
  /\bpanel (interview|round)\b/i,
  /\bfinal round\b/i,
  /\bon-?site (visit|interview)\b/i,
  /\brecruiter (call|screen)\b/i,
]

// Networking-shaped 1:1s — deliberately narrower than "any call with someone"
// since a generic "Sync" or "1:1" title carries no real signal either way
// and should fall to NEEDS_REVIEW rather than being guessed as networking.
const NETWORKING_PATTERNS: RegExp[] = [
  /\bcoffee chat\b/i,
  /\bintro(duction)? call\b/i,
  /\bnetworking\b/i,
  /\bcatch[- ]?up\b/i,
]

function matchesAny(title: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(title))
}

export function classifyCalendarEvent(title: string): CalendarClassificationResult {
  // "Informational interview" is networking, not a hiring-process
  // interview, despite containing the word — checked ahead of the generic
  // interview patterns so it doesn't get misrouted.
  if (/\binformational\b/i.test(title)) {
    return { eventType: 'NETWORKING_CALL', confidence: 'high' }
  }
  if (matchesAny(title, INTERVIEW_PATTERNS)) {
    return { eventType: 'INTERVIEW', confidence: 'high' }
  }
  if (matchesAny(title, NETWORKING_PATTERNS)) {
    return { eventType: 'NETWORKING_CALL', confidence: 'high' }
  }
  return { eventType: 'NEEDS_REVIEW', confidence: 'low' }
}
