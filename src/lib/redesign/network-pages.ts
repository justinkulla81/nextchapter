// Plain-words copy for the redesigned Network pages (docs/candidate-redesign.md). Every line says
// why, uses positive wording and sentence case. Pure, so it is tested without the database.

export type NetworkPartKey = 'close' | 'know' | 'alumni' | 'industry' | 'recruiters'

/** The small switches across the top of each circle page, closest circle first. */
export const NETWORK_PARTS: { key: NetworkPartKey; label: string; href: string }[] = [
  { key: 'close', label: 'Close circle', href: '/dashboard/supporters' },
  { key: 'know', label: 'People you know', href: '/dashboard/network/contacts' },
  { key: 'alumni', label: 'Alumni and groups', href: '/dashboard/groups' },
  { key: 'industry', label: 'Industry and function', href: '/dashboard/community' },
  { key: 'recruiters', label: 'Recruiters', href: '/dashboard/recruiter-requests' },
]

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function contactsIntro(total: number): string {
  if (total === 0) return 'Most jobs come through someone you already know. Add the people you know and we tell you who to write to first.'
  return `${plural(total, 'person', 'people')} you know. Most jobs come through someone like them, so each one is worth a note.`
}

export function thisWeekIntro(count: number): string {
  if (count === 0) return 'Add a few people you know and we pick who to write to first, with a draft ready.'
  return `${plural(count, 'conversation')} worth having this week. Each has a draft you can edit and send in a minute.`
}

export function followUpsIntro(count: number): string {
  if (count === 0) return 'Nothing is waiting on you right now. A quick reply keeps a good conversation going.'
  return `${count} ${count === 1 ? 'item is' : 'items are'} waiting for a word from you. A quick reply keeps the conversation going.`
}

export type FollowUpKind = 'starred-contact' | 'needs-follow-up' | 'unanswered-application' | 'stale-contact'

/** The one reason to act on a follow-up, in plain words. */
export function followUpWhy(kind: FollowUpKind): string {
  switch (kind) {
    case 'starred-contact':
      return 'You starred this person as someone who could help, and you have not written yet.'
    case 'needs-follow-up':
      return 'They wrote to you or met with you recently, and a reply is the next step.'
    case 'unanswered-application':
      return 'It has been a couple of weeks since you applied. A short note can move it along.'
    case 'stale-contact':
      return 'It has been a while since you spoke. A hello keeps the relationship warm.'
  }
}

export function followUpActionLabel(kind: FollowUpKind): string {
  switch (kind) {
    case 'starred-contact':
    case 'stale-contact':
      return 'Write to them'
    case 'needs-follow-up':
      return 'Reply'
    case 'unanswered-application':
      return 'Follow up'
  }
}

export function referencesIntro(completed: number, target: number): string {
  if (completed >= target) return `${plural(completed, 'person', 'people')} vouched for you. That reads as a pattern to hiring managers, not a one-off.`
  if (completed === 0) return 'A real reference is one of the strongest things a hiring manager can read. Ask the first person today.'
  return `${completed} of ${target} references are in. Real testimony from three people reads as a pattern to a hiring manager.`
}

export type ReferenceStatusKey = 'REQUESTED' | 'REMINDER_SENT' | 'COMPLETED' | 'DECLINED' | 'EXPIRED'

/** Said as what happens next, not as a status tag. */
export function referenceStatusText(status: ReferenceStatusKey): string {
  switch (status) {
    case 'REQUESTED':
      return 'Waiting for their reply'
    case 'REMINDER_SENT':
      return 'Reminder sent, waiting for their reply'
    case 'COMPLETED':
      return 'Done. A thank-you note is a nice touch'
    case 'DECLINED':
      return 'They could not this time. Another person may be a better fit'
    case 'EXPIRED':
      return 'The link ran out. You can ask again'
  }
}

export function recruiterRequestsIntro(count: number): string {
  if (count === 0) return 'Recruiters who place people like you can ask to meet you. You decide every time, and they see nothing until you say yes.'
  return `${plural(count, 'recruiter')} asked to meet you. They see nothing about you until you say yes.`
}

export function groupsIntro(count: number): string {
  if (count === 0) return 'Schools, past employers and programs are warm doors. People there want to help you, and you decide what any group can see.'
  return `${plural(count, 'group')}. Each one can share jobs, learning and people, and you decide what any group can see about you.`
}

export function communityIntro(tab: 'community' | 'messages'): string {
  return tab === 'messages'
    ? 'Everything from people in your network and your groups, in one place.'
    : 'People in your field. Good for learning how others got hired, and for being found.'
}

export function coachingIntro(onPlan: boolean, hasCoach: boolean): string {
  if (hasCoach) return 'Your coach reviews your plan and keeps you accountable week to week.'
  if (onPlan) return 'A coach reviews your plan and keeps you accountable week to week. Answer a few questions and we match you.'
  return 'A coach reviews your plan and keeps you accountable week to week. Enter a code from your coach, or see your options.'
}

export function supportersIntro(count: number): string {
  if (count === 0) return 'People do better with someone in their corner. You choose who, and exactly what each person can see.'
  return 'People do better with someone in their corner. They get one short note a week about your effort, in numbers only.'
}
