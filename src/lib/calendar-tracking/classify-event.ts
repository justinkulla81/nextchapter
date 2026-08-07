import { matchRecruiterRoleMention } from '@/lib/text/recruiter-role'

export interface CalendarClassificationResult {
  eventType: 'INTERVIEW' | 'NETWORKING_CALL' | 'LEARNING' | 'NOT_JOB_SEARCH' | 'NEEDS_REVIEW'
  confidence: 'high' | 'low'
}

export interface CalendarEventContext {
  durationMinutes: number | null
  startHour: number | null // 0-23, in the calendar's own local time as Google encodes it
  isWeekday: boolean | null // Mon-Fri in the calendar's own local date
  isRecurring: boolean // true for any instance of a recurring event (Google's recurringEventId)
  // Whether a real person besides the candidate was actually invited — the
  // real sync caller (sync-google-calendar.ts) already requires this before
  // an event reaches classification at all (see its attendeeCount check), so
  // in practice this is always true here; kept as an explicit input rather
  // than assumed so this function stays correct if ever called elsewhere
  // without that precondition. A real invitee is strong corroboration on its
  // own — someone actually scheduled time with another person.
  hasOtherAttendees: boolean
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

// The name-to-name guess (weakest signal — no real keyword to go on) is
// restricted to a standard 30/60-min weekday business-hours slot, so it
// doesn't fire on personal calendar noise that happens to have a slash in
// the title. Real job-search meetings very rarely land outside this window
// unless they carry an explicit keyword, which is handled separately below.
function isBusinessHoursSlot(context: CalendarEventContext): boolean {
  return (
    (context.durationMinutes === 30 || context.durationMinutes === 60) &&
    context.startHour !== null &&
    context.startHour >= 8 &&
    context.startHour < 18 &&
    context.isWeekday === true
  )
}

// Same window, without the exact-30/60-minute constraint — used for the
// weaker keyword bucket below (a lunch meeting or coffee chat isn't always
// exactly half an hour).
function isWeekdayBusinessHours(context: CalendarEventContext): boolean {
  return context.startHour !== null && context.startHour >= 8 && context.startHour < 18 && context.isWeekday === true
}

// Interview patterns — checked first and given priority: unambiguous
// hiring-process language. Scans title + description, unlike title-only
// classification before this — calendar.events.readonly's event resource
// already includes description, it just wasn't being read.
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

// Real personal-life events that a name-to-name-shaped title or a bare
// "meeting"/"appointment" could otherwise be mistaken for. Checked before
// the generic networking buckets so "Justin / Dr. Patel" or "School:
// parent-teacher conference" doesn't get guessed as a networking call just
// because it happens to land in a business-hours 30/60-min slot. Scans
// title + description + location — a personal appointment's location
// ("123 Main St Dental") is often the clearest tell.
const NOT_JOB_SEARCH_PATTERNS: RegExp[] = [
  /\bschool\b/i,
  /\bparent[- ]?teacher\b/i,
  /\bdentist\b/i,
  /\bdoctor\b/i,
  /\bdr\.\s/i,
  /\bphysical therapy\b/i,
  /\bhaircut\b/i,
  /\bgrocery\b/i,
  /\bshopping\b/i,
  /\bflight\b/i,
  /\btravel\b/i,
  /\bvacation\b/i,
  /\bpto\b/i,
  /\brecital\b/i,
  /\bsoccer\b/i,
  /\bgym\b/i,
  /\bworkout\b/i,
  /\byoga\b/i,
  /\bbirthday\b/i,
  /\bveterinar(y|ian)\b/i,
  /\boil change\b/i,
  /\bcar (service|maintenance)\b/i,
]

// Scheduled learning time — courses, webinars, certifications, blocked
// focus time explicitly labeled for learning. Tracked as its own eventType
// (not folded into networking) so the Learning page can show a real,
// calendar-verified time stat instead of only self-reported badges.
const LEARNING_PATTERNS: RegExp[] = [
  /\bwebinar\b/i,
  /\bcourse\b/i,
  /\btraining\b/i,
  /\bworkshop\b/i,
  /\bcertification\b/i,
  /\bbootcamp\b/i,
  /\btutorial\b/i,
  /\block(?:ed)?\s*(?:time\s*)?(?:for\s*)?learning\b/i,
  /\blearning\s*(block|time|session)\b/i,
  /\bstudy\s*(session|time|block)\b/i,
]

// High-confidence networking phrases and conference-style events — no
// time-of-day gate at all, since a real industry conference, meetup, or
// networking mixer is just as likely (often more likely) to fall on an
// evening or a weekend as it is during business hours.
const NETWORKING_HIGH_CONFIDENCE_NO_TIME_GATE: RegExp[] = [
  /\bconference\b/i,
  /\bsummit\b/i,
  /\bsymposium\b/i,
  /\bmeetup\b/i,
  /\bnetworking\b/i,
  /\bnetworking event\b/i,
  /\bhappy hour\b/i,
  /\bmixer\b/i,
  /\bindustry event\b/i,
  /\bpanel discussion\b/i,
  /\bnice to meet you\b/i,
]

// Bare/generic phrasing — real, but common enough in non-job-search
// invites too that it needs corroboration: a real other attendee (see
// CalendarEventContext.hasOtherAttendees — someone you actually scheduled
// time with), a normal weekday business-hours slot, or an explicit
// career/job-search-context word/recruiter role mention. Deliberately
// excludes bare "hi"/"hey"/"hello" — those show up in the description of
// almost any calendar invite regardless of topic (an auto-greeting, a
// team-meeting blurb), so they'd corroborate nothing; same reasoning as
// why THANK_YOU_BARE_SUBJECT-style bare-word matches elsewhere in this
// codebase stay narrow and specific rather than generic.
const NETWORKING_GENERIC_PATTERNS: RegExp[] = [
  /\bcoffee\b/i,
  /\blunch\b/i,
  /\bbreakfast\b/i,
  /\bmeeting\b/i,
  /\bchat\b/i,
  /\bintro(duction)?\b/i,
  /\bconversation\b/i,
  /\bconnection\b/i,
  /\bconnecting\b/i,
  /\bcatch[- ]?up\b/i,
  /\bcall\b/i,
  /\bzoom\b/i,
]

const CAREER_CONTEXT_PATTERNS: RegExp[] = [
  /\bcareer\b/i,
  /\bjob search\b/i,
  /\bjob\b/i,
  /\bopportunity\b/i,
  /\bhiring\b/i,
  /\bresume\b/i,
]

// Same reasoning as THANK_YOU_BARE_SUBJECT in ats-patterns.ts — a bare
// "Coffee" or "Lunch?" title on a real invite is common enough to match
// directly.
const NETWORKING_OUTREACH_BARE_SUBJECT = /^(coffee|lunch|coffee chat|grab (a )?(coffee|lunch))[!.?]{0,3}$/i

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text))
}

function hasCareerCorroboration(text: string): boolean {
  return matchesAny(text, CAREER_CONTEXT_PATTERNS) || matchRecruiterRoleMention(text)
}

export function classifyCalendarEvent(
  title: string,
  description = '',
  location = '',
  context: CalendarEventContext = {
    durationMinutes: null,
    startHour: null,
    isWeekday: null,
    isRecurring: false,
    hasOtherAttendees: false,
  }
): CalendarClassificationResult {
  const text = `${title} ${description}`
  const textWithLocation = `${text} ${location}`

  // "Informational interview" is networking, not a hiring-process
  // interview, despite containing the word — checked ahead of the generic
  // interview patterns so it doesn't get misrouted.
  if (/\binformational\b/i.test(text)) {
    return { eventType: 'NETWORKING_CALL', confidence: 'high' }
  }
  if (matchesAny(text, INTERVIEW_PATTERNS)) {
    return { eventType: 'INTERVIEW', confidence: 'high' }
  }
  if (matchesAny(textWithLocation, NOT_JOB_SEARCH_PATTERNS)) {
    return { eventType: 'NOT_JOB_SEARCH', confidence: 'high' }
  }
  if (matchesAny(text, LEARNING_PATTERNS)) {
    return { eventType: 'LEARNING', confidence: 'high' }
  }
  if (matchesAny(text, NETWORKING_HIGH_CONFIDENCE_NO_TIME_GATE)) {
    return { eventType: 'NETWORKING_CALL', confidence: 'high' }
  }
  if (NETWORKING_OUTREACH_BARE_SUBJECT.test(title.trim())) {
    return { eventType: 'NETWORKING_CALL', confidence: 'high' }
  }
  if (matchesAny(text, NETWORKING_GENERIC_PATTERNS)) {
    if (context.hasOtherAttendees || isWeekdayBusinessHours(context) || hasCareerCorroboration(text)) {
      return { eventType: 'NETWORKING_CALL', confidence: 'high' }
    }
    return { eventType: 'NEEDS_REVIEW', confidence: 'low' }
  }
  // A recurring instance is excluded here — a standing weekly 1:1 or team
  // sync between the same names looks identical to this heuristic (a
  // name-shaped title in a normal business-hours slot), but has no real
  // networking keyword to justify the guess. This bare fallback only fires
  // for a one-off meeting someone actually set up.
  if (looksLikeNameToNameMeeting(title) && isBusinessHoursSlot(context) && !context.isRecurring) {
    return { eventType: 'NETWORKING_CALL', confidence: 'high' }
  }
  return { eventType: 'NEEDS_REVIEW', confidence: 'low' }
}
