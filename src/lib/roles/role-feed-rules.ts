// The words and choices on a member's role feed (/dashboard/network/role-feed). Pure, so it is tested without the database.

import type { RoleDef } from '@/lib/seo/role-pages'
import { rolesForMember } from './resources-rules'

export const ROLE_FEED_PATH = '/dashboard/network/role-feed'

const DAY = 86_400_000

/** The roles a member holds or aims for, as the feed link and the feed page both see them. Null when they have none. */
export function memberRoleFeed(p: { resumeLatestJobTitle: string | null; targetRoleType: string | null; confidentialSearchMode?: boolean | null }): { name: string; href: string } | null {
  if (p.confidentialSearchMode) return null
  const role = rolesForMember([p.resumeLatestJobTitle, p.targetRoleType])[0]
  return role ? { name: role.short, href: `${ROLE_FEED_PATH}?role=${role.slug}` } : null
}

/** Which of the member's roles the page shows: the one asked for when it is theirs, else the first. */
export function pickFeedRole(asked: string | undefined, p: { resumeLatestJobTitle: string | null; targetRoleType: string | null }): RoleDef | null {
  const roles = rolesForMember([p.resumeLatestJobTitle, p.targetRoleType])
  return roles.find((r) => r.slug === asked) ?? roles[0] ?? null
}

/** Why the member is in the network, for the header. */
export function becauseLine(role: RoleDef, p: { resumeLatestJobTitle: string | null; targetRoleType: string | null }): string {
  const held = rolesForMember([p.resumeLatestJobTitle]).some((r) => r.slug === role.slug)
  return held ? `your résumé title is ${role.spelled}` : `your target role is ${role.spelled}`
}

export interface FeedHeadline {
  kind: 'changed' | 'quiet' | 'none'
  title: string
  why: string
  /** The one primary action. */
  action: { label: string; href: string }
}

const jobsHref = (q: string) => `/jobs?q=${encodeURIComponent(q)}`

/**
 * The page's one headline and one action, from what was filed. A change inside a week leads; with none, the page says so and
 * gives the date of the last one; a role with no SEC seat leads with its open jobs.
 */
export function feedHeadline(
  role: RoleDef,
  turnover: { label: string; items: { company: string; date: Date }[] } | null,
  openJobs: number,
  now = new Date(),
): FeedHeadline {
  const jobs = { label: `See ${openJobs.toLocaleString('en-US')} open ${role.short} jobs`, href: jobsHref(role.spelled) }
  if (!turnover || turnover.items.length === 0) {
    return { kind: 'none', title: `${openJobs.toLocaleString('en-US')} ${role.short} jobs are open now.`, why: 'Each was checked against the employer’s own career site within the last week.', action: jobs }
  }
  const week = filedThisWeek(turnover.items, now)
  if (week.length > 0) {
    const companies = [...new Set(week.map((i) => i.company))]
    return {
      kind: 'changed',
      title: `${week.length} ${turnover.label} ${week.length === 1 ? 'seat' : 'seats'} changed hands this week.`,
      why: 'Companies that change this seat often hire around the new leader.',
      action: { label: companies.length === 1 ? `See jobs at ${companies[0]}` : 'See jobs at these companies', href: jobsHref(companies[0]) },
    }
  }
  const last = turnover.items[0]
  const days = Math.max(1, Math.round((now.getTime() - last.date.getTime()) / DAY))
  return { kind: 'quiet', title: `No ${turnover.label} seats changed hands this week.`, why: `We watch SEC filings and news reports. The last change was ${days} days ago, at ${last.company}.`, action: jobs }
}

/** The filings from the last seven days, newest first as given. */
export function filedThisWeek<T extends { date: Date }>(items: T[], now = new Date()): T[] {
  return items.filter((i) => now.getTime() - i.date.getTime() <= 7 * DAY)
}
