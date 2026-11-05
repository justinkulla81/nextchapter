// The words and choices on a member's role feed (/dashboard/network/role-feed). Pure, so it is tested without the database.

import type { RoleDef } from '@/lib/seo/role-pages'
import { rolesForMember } from './resources-rules'

export const ROLE_FEED_PATH = '/dashboard/network/role-feed'

const DAY = 86_400_000

/** The roles a member holds or aims for, as the feed link and the feed page both see them. Null when they have none. */
export function memberRoleFeed(p: { resumeLatestJobTitle: string | null; targetRoleType: string | null; confidentialSearchMode?: boolean | null }, left: ReadonlySet<string> = new Set()): { name: string; href: string } | null {
  if (p.confidentialSearchMode) return null
  const role = rolesForMember([p.resumeLatestJobTitle, p.targetRoleType]).find((r) => !left.has(r.slug))
  return role ? { name: role.short, href: `${ROLE_FEED_PATH}?role=${role.slug}` } : null
}

/** Which of the member's roles the page shows: the one asked for when it is theirs, else the first. */
export function pickFeedRole(asked: string | undefined, p: { resumeLatestJobTitle: string | null; targetRoleType: string | null }, left: ReadonlySet<string> = new Set()): RoleDef | null {
  // A role the member has left is not offered again; they come back by joining from the role page.
  const roles = rolesForMember([p.resumeLatestJobTitle, p.targetRoleType]).filter((r) => !left.has(r.slug))
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
  /** Null when the count could not be read: the page then says nothing about how many are open. */
  openJobs: number | null,
  now = new Date(),
): FeedHeadline {
  const jobs =
    openJobs != null && openJobs > 0
      ? { label: `See ${openJobs.toLocaleString('en-US')} open ${role.short} jobs`, href: jobsHref(role.spelled) }
      : { label: `Search ${role.short} jobs`, href: jobsHref(role.spelled) }
  if (!turnover || turnover.items.length === 0) {
    return openJobs != null && openJobs > 0
      ? { kind: 'none', title: `${openJobs.toLocaleString('en-US')} ${role.short} jobs are open now.`, why: 'Each was checked against the employer’s own career site within the last week.', action: jobs }
      : { kind: 'none', title: `Your ${role.short} search starts here.`, why: 'Search open roles, then see who recruits for them below.', action: jobs }
  }
  const week = filedThisWeek(turnover.items, now)
  if (week.length > 0) {
    const companies = [...new Set(week.map((i) => i.company))]
    return {
      kind: 'changed',
      title: `${week.length} ${turnover.label} ${week.length === 1 ? 'seat' : 'seats'} changed hands this week.`,
      why: companies.length > 1 ? `Companies that change this seat often hire around the new leader. Each is listed below with its own open jobs.` : 'Companies that change this seat often hire around the new leader.',
      action: { label: `See jobs at ${companies[0]}`, href: jobsHref(companies[0]) },
    }
  }
  const last = turnover.items[0]
  const days = Math.max(1, Math.round((startOfDayUtc(now) - startOfDayUtc(last.date)) / DAY))
  return { kind: 'quiet', title: `No ${turnover.label} seats changed hands this week.`, why: `We watch SEC filings and news reports. The last change was ${days} ${days === 1 ? 'day' : 'days'} ago, at ${last.company}.`, action: jobs }
}

const startOfDayUtc = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

/** The filings from the last seven calendar days (today and the six before it, UTC), as given. A filing is dated to the day, not the hour. */
export function filedThisWeek<T extends { date: Date }>(items: T[], now = new Date()): T[] {
  const from = startOfDayUtc(now) - 6 * DAY
  return items.filter((i) => startOfDayUtc(i.date) >= from)
}
