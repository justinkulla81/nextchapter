// The early-career checklists: the first-job checklist for new grads and the
// growth checklist for people 2 to 5 years in. Pure and client-safe.
//
// Every item points at a page that already exists (résumé, LinkedIn, learning,
// interview prep, groups, offers), so this is a plan over the portal, not a
// parallel set of tools. Some items are detected from the profile (school
// added, résumé uploaded); the rest the member checks off, and that list is
// stored on CandidateProfile.earlyCareerChecklistDone.

import type { EarlyCareerAudience } from './audience'

export type ChecklistItem = {
  id: string
  title: string
  why: string
  href: string
  linkLabel: string
}

export const FIRST_JOB_CHECKLIST: ChecklistItem[] = [
  {
    id: 'education',
    title: 'Add your school, degree and graduation year',
    why: 'Employers hiring new grads filter by school, major and class year, and it connects you with your alumni here.',
    href: '/dashboard/early-career#education',
    linkLabel: 'Add your school',
  },
  {
    id: 'target_roles',
    title: 'Pick two or three target roles',
    why: 'Start from your major. A short list makes every résumé line and every application sharper.',
    href: '/dashboard/early-career#roles',
    linkLabel: 'See roles for your major',
  },
  {
    id: 'resume',
    title: 'Build your first résumé',
    why: 'No full-time job yet is normal. Internships, projects, coursework, campus jobs and leadership all count.',
    href: '/dashboard/resume',
    linkLabel: 'Open résumé',
  },
  {
    id: 'linkedin',
    title: 'Set up your LinkedIn',
    why: 'A photo, a headline naming the role you want, and your school. Recruiters search there first.',
    href: '/dashboard/linkedin',
    linkLabel: 'Open LinkedIn tips',
  },
  {
    id: 'skills',
    title: 'Start one free course for a skill your target role asks for',
    why: 'One finished course you can name in an interview beats five you started.',
    href: '/dashboard/learning',
    linkLabel: 'Find a course',
  },
  {
    id: 'employers',
    title: 'List 10 employers you would like to work for',
    why: 'Track them and you will see their entry-level openings the day they post.',
    href: '/dashboard/companies',
    linkLabel: 'Browse companies',
  },
  {
    id: 'alumni_call',
    title: 'Ask an alum for a 20-minute informational interview',
    why: 'Most first jobs come through someone. Alumni are the people most likely to say yes.',
    href: '/dashboard/groups',
    linkLabel: 'Find your alumni',
  },
  {
    id: 'interview_prep',
    title: 'Practice behavioral, case or technical questions',
    why: 'Entry-level interviews test how you think and work with people more than what you have done.',
    href: '/dashboard/interview-prep',
    linkLabel: 'Practice interviews',
  },
  {
    id: 'pay',
    title: 'Know the starting pay for your target role',
    why: 'So you can tell a fair first offer from a low one.',
    href: '/dashboard/early-career#pay',
    linkLabel: 'See starting pay',
  },
  {
    id: 'offer',
    title: 'Before you accept, compare and negotiate your first offer',
    why: 'Most employers expect a polite ask. Even a small raise on your first salary compounds for years.',
    href: '/dashboard/early-career#offer',
    linkLabel: 'Read the first-offer guide',
  },
]

export const EARLY_GROWTH_CHECKLIST: ChecklistItem[] = [
  {
    id: 'wins',
    title: 'Write down three wins with numbers',
    why: 'Your résumé, your review and your next interview all run on the same three stories.',
    href: '/dashboard/strengths',
    linkLabel: 'Open my story',
  },
  {
    id: 'next_level',
    title: 'Name the gap to the next level',
    why: 'Senior or manager: ask what the next level does that you do not do yet, then close one gap at a time.',
    href: '/dashboard/early-career#promotion',
    linkLabel: 'See the path up',
  },
  {
    id: 'resume',
    title: 'Refresh your résumé to lead with results',
    why: 'Two to five years in, results matter more than coursework. Move school to the bottom.',
    href: '/dashboard/resume',
    linkLabel: 'Open résumé',
  },
  {
    id: 'pay',
    title: 'Check your pay against the market',
    why: 'Early-career pay moves fastest when you change jobs or ask with data.',
    href: '/dashboard/early-career#pay',
    linkLabel: 'See market pay',
  },
  {
    id: 'skills',
    title: 'Close one skill gap for the next level',
    why: 'Pick the skill your next-level job postings ask for most.',
    href: '/dashboard/learning',
    linkLabel: 'Find a course',
  },
  {
    id: 'sponsor',
    title: 'Find a mentor or sponsor two levels up',
    why: 'A sponsor speaks for you in rooms you are not in. That is how early promotions happen.',
    href: '/dashboard/network',
    linkLabel: 'Open network',
  },
  {
    id: 'alumni_call',
    title: 'Have one coffee chat with an alum in a role you want next',
    why: 'Learn what the job is really like and who is hiring before it is posted.',
    href: '/dashboard/groups',
    linkLabel: 'Find your alumni',
  },
  {
    id: 'grad_school',
    title: 'Decide whether grad school is worth it for you',
    why: 'For some paths it is required; for many it is not. Decide on purpose, not by default.',
    href: '/dashboard/early-career#grad-school',
    linkLabel: 'Read the guide',
  },
]

export function checklistFor(audience: EarlyCareerAudience): ChecklistItem[] {
  return audience === 'NEW_GRAD' ? FIRST_JOB_CHECKLIST : EARLY_GROWTH_CHECKLIST
}

export const ALL_CHECKLIST_IDS = new Set([...FIRST_JOB_CHECKLIST, ...EARLY_GROWTH_CHECKLIST].map((i) => i.id))

/** What the profile already proves, so the member never checks off what we can see. */
export type ChecklistSignals = {
  hasEducation: boolean
  hasResume: boolean
  hasLinkedIn: boolean
  hasTargetRole: boolean
  trackedCompanies: number
}

export function autoDoneIds(s: ChecklistSignals): string[] {
  const done: string[] = []
  if (s.hasEducation) done.push('education')
  if (s.hasResume) done.push('resume')
  if (s.hasLinkedIn) done.push('linkedin')
  if (s.hasTargetRole) done.push('target_roles')
  if (s.trackedCompanies >= 10) done.push('employers')
  return done
}

export type ChecklistRow = ChecklistItem & { done: boolean; auto: boolean }

export function checklistRows(audience: EarlyCareerAudience, markedDone: string[], signals: ChecklistSignals): ChecklistRow[] {
  const auto = new Set(autoDoneIds(signals))
  const marked = new Set(markedDone)
  return checklistFor(audience).map((item) => ({
    ...item,
    auto: auto.has(item.id),
    done: auto.has(item.id) || marked.has(item.id),
  }))
}

/** The first open item: the one thing to do next. */
export function nextItem(rows: ChecklistRow[]): ChecklistRow | null {
  return rows.find((r) => !r.done) ?? null
}
