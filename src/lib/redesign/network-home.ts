// The Network landing in the redesign (docs/candidate-redesign.md): five circles from closest to widest, each
// saying where it stands and what is missing as a benefit. Pure, so it is tested without the database.

import type { CircleData, Moment } from '@/components/network/NetworkOverview'

export interface NetworkHomeInput {
  supporters: number
  hasCoach: boolean
  contacts: number
  followUpsDue: number
  alumniGroups: string[]
  communities: number
  candidatePlus: boolean
  outreachSent: number
  outreachTarget: number
  priorityStarred: number
  priorityTarget: number
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const list = (xs: string[]) => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, 2).join(', ')} and ${xs.length - 2} more`)

export function buildCircles(i: NetworkHomeInput): CircleData[] {
  return [
    {
      key: 'close',
      name: 'Your close circle',
      status: i.supporters > 0 ? `${plural(i.supporters, 'person is', 'people are')} in your corner. ${i.hasCoach ? 'You have a coach.' : 'No coach yet.'}` : i.hasCoach ? 'You have a coach. No one else is in your corner yet.' : 'No one in your corner yet.',
      gap: i.supporters === 0 ? 'People do better with someone cheering them on. You choose who, and what they see.' : !i.hasCoach ? 'A coach reviews your plan and keeps you accountable week to week.' : undefined,
      state: i.supporters > 0 ? 'active' : i.hasCoach ? 'started' : 'empty',
      action: { label: i.supporters > 0 ? 'Open your close circle' : 'Invite someone', href: '/dashboard/supporters' },
    },
    {
      key: 'know',
      name: 'People you know',
      status: i.contacts === 0 ? 'No contacts yet.' : `${plural(i.contacts, 'contact')}.${i.followUpsDue > 0 ? ` ${i.followUpsDue} ${i.followUpsDue === 1 ? 'is' : 'are'} due a follow-up.` : ''}`,
      gap: i.contacts === 0 ? 'Add the people you know and we tell you who to write to first.' : undefined,
      state: i.contacts === 0 ? 'empty' : 'active',
      action: i.followUpsDue > 0 ? { label: 'Review follow-ups', href: '/dashboard/network/follow-ups' } : { label: i.contacts === 0 ? 'Add your contacts' : 'Open your contacts', href: '/dashboard/network/contacts' },
    },
    {
      key: 'alumni',
      name: 'Alumni and groups',
      status: i.alumniGroups.length > 0 ? `${list(i.alumniGroups)}.` : 'No alumni groups matched yet.',
      gap: i.alumniGroups.length === 0 ? 'Add the schools and past employers you left off to find more people.' : undefined,
      state: i.alumniGroups.length > 0 ? 'active' : 'empty',
      action: { label: i.alumniGroups.length > 0 ? 'See your alumni groups' : 'Add schools and employers', href: i.alumniGroups.length > 0 ? '/dashboard/groups' : '/dashboard/profile' },
    },
    {
      key: 'industry',
      name: 'Industry and function',
      status: i.communities > 0 ? `${plural(i.communities, 'community', 'communities')} joined.` : 'Not joined yet.',
      gap: i.communities === 0 ? 'Communities for your field are open to you.' : undefined,
      state: i.communities > 0 ? 'active' : 'empty',
      action: { label: i.communities > 0 ? 'Open your communities' : 'Join a community', href: '/dashboard/community' },
    },
    {
      key: 'recruiters',
      name: 'Recruiters',
      status: i.candidatePlus ? 'Recruiters can find you.' : 'Recruiters can find you once you earn Candidate+.',
      gap: i.candidatePlus ? undefined : 'Candidate+ puts you in front of recruiters and hiring managers.',
      state: i.candidatePlus ? 'active' : 'locked',
      action: i.candidatePlus ? { label: 'See what recruiters see', href: '/dashboard/recruiter-report' } : { label: 'See what is left', href: '/dashboard/improve' },
    },
  ]
}

const pct = (n: number, of: number) => (of <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((n / of) * 100))))

/** Moments the member can reach from where they are, each tied to a count we actually hold. Reached ones drop off. */
export function buildMoments(i: NetworkHomeInput): Moment[] {
  const out: Moment[] = []
  if (!i.candidatePlus) {
    out.push({ key: 'outreach', title: 'Candidate+ outreach', payoff: 'Enough outreach is one of the steps that puts you in front of recruiters.', progress: `${Math.min(i.outreachSent, i.outreachTarget)} of ${i.outreachTarget} messages`, pct: pct(i.outreachSent, i.outreachTarget) })
  }
  if (i.priorityStarred < i.priorityTarget) {
    out.push({ key: 'priority', title: 'Your priority people', payoff: 'Starring the people who matter most puts them at the top of your weekly plan.', progress: `${i.priorityStarred} of ${i.priorityTarget} starred`, pct: pct(i.priorityStarred, i.priorityTarget) })
  }
  if (!i.hasCoach) {
    out.push({ key: 'coach', title: 'A coach joins your corner', payoff: 'A plan review and weekly accountability.', progress: 'No coach yet', pct: 0 })
  }
  return out
}

export function networkHeadline(i: NetworkHomeInput): string {
  return i.contacts === 0
    ? 'Build it one conversation at a time. Start with the people you already know.'
    : 'Build it one conversation at a time. Each step you take opens something new.'
}
