// The first seven days: one small step a day, each worth a few minutes, each
// pointing at a place that already exists. The aim is a first win in the first
// ten minutes and a person in the member's corner by the end of day one.

export interface FirstWeekStep {
  day: number
  title: string
  why: string
  minutes: number
  href: string
  cta: string
}

export const FIRST_WEEK: FirstWeekStep[] = [
  { day: 1, title: 'Invite one person to keep you going', why: 'People who have someone in their corner keep going. They get one short note a week, effort only.', minutes: 5, href: '/dashboard/supporters', cta: 'Invite a supporter' },
  { day: 2, title: 'Save your first job', why: 'Seeing real roles makes the search feel concrete, and it teaches us what fits you.', minutes: 5, href: '/dashboard/find-my-job', cta: 'Find a job' },
  { day: 3, title: 'Send one message to someone you know', why: 'Most roles come through people. One short note is the start.', minutes: 10, href: '/dashboard/network', cta: 'Open this week’s people' },
  { day: 4, title: 'Ask one person to be a reference', why: 'References are proof a résumé cannot give, and they open your next unlock.', minutes: 5, href: '/dashboard/references', cta: 'Request a reference' },
  { day: 5, title: 'Answer a few work-style questions', why: 'Your answers make job matches say why they fit how you work.', minutes: 5, href: '/dashboard/skills-assessments', cta: 'Answer the questions' },
  { day: 6, title: 'Join a group that fits you', why: 'A school, a past employer or a program gives you people from day one.', minutes: 3, href: '/dashboard/groups', cta: 'See my groups' },
  { day: 7, title: 'See what your effort has built', why: 'Your dossier has been growing all week. Here is what recruiters will be able to see.', minutes: 3, href: '/dashboard/stats', cta: 'See my progress' },
]

// Day 1 is the day registration completed. Null once the week is over.
export function firstWeekStep(registrationCompletedAt: Date | null, now = new Date()): FirstWeekStep | null {
  if (!registrationCompletedAt) return null
  const day = Math.floor((now.getTime() - registrationCompletedAt.getTime()) / 86_400_000) + 1
  return FIRST_WEEK.find((s) => s.day === day) ?? null
}
