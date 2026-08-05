export interface CalendarClassificationResult {
  eventType: 'INTERVIEW' | 'NETWORKING_CALL' | 'NEEDS_REVIEW'
  confidence: 'high' | 'low'
}

export interface CalendarEventContext {
  durationMinutes: number | null
  startHour: number | null // 0-23, in the calendar's own local time as Google encodes it
}

// A title that's nothing but 2-4 short Title-Case name segments joined by a
// person-vs-person delimiter ("Justin / Steve", "Pat/Justin (NextChapter)",
// "Justin Kulla | Deb Liu") reads as a 1:1 (or small-group) meeting someone
// set up with a real person — not a personal calendar entry. A trailing
// parenthetical (a company/context tag) is stripped before splitting.
// "Julien: Ortho appt @5:30pm" correctly fails: the second segment isn't
// name-shaped.
const NAME_SEGMENT = /^[A-Z][A-Za-z.'-]*(?:\s[A-Z][A-Za-z.'-]*){0,2}$/

function looksLikeNameToNameMeeting(title: string): boolean {
  const stripped = title.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const segments = stripped.split(/\s*(?:\/|\||<>|:)\s*/).filter(Boolean)
  if (segments.length < 2 || segments.length > 4) return false
  return segments.every((s) => NAME_SEGMENT.test(s))
}

// Restricting to a standard 30/60-min slot inside the business day is what
// keeps this from firing on personal calendar noise that happens to have a
// slash in the title — a real scheduled meeting looks like this; a family
// pickup or an evening plan usually doesn't.
function isBusinessHoursSlot(context: CalendarEventContext): boolean {
  return (
    (context.durationMinutes === 30 || context.durationMinutes === 60) &&
    context.startHour !== null &&
    context.startHour >= 8 &&
    context.startHour < 18
  )
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
// The attendeeCount>=2-and-not-declined gate upstream (sync-google-calendar.ts)
// already filters out solo blocks, which is what keeps broader words like
// "meeting" or "appointment" safe here — a real personal appointment rarely
// has a second invited attendee on the calendar.
const NETWORKING_PATTERNS: RegExp[] = [
  /\bcoffee\b/i,
  /\blunch\b/i,
  /\bbreakfast\b/i,
  /\bmeetup\b/i,
  /\bmeeting\b/i,
  /\bchat\b/i,
  /\bintro(duction)?\b/i,
  /\bconversation\b/i,
  /\bconnection\b/i,
  /\bnetworking\b/i,
  /\bcatch[- ]?up\b/i,
  /\bappointment\b/i,
]

function matchesAny(title: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(title))
}

export function classifyCalendarEvent(
  title: string,
  context: CalendarEventContext = { durationMinutes: null, startHour: null }
): CalendarClassificationResult {
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
  if (looksLikeNameToNameMeeting(title) && isBusinessHoursSlot(context)) {
    return { eventType: 'NETWORKING_CALL', confidence: 'high' }
  }
  return { eventType: 'NEEDS_REVIEW', confidence: 'low' }
}
