import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { INTERNSHIP_FIELDS, INTERNSHIP_TERMS, type InternshipField, type InternshipTerm } from './fields'

// Internships for one college's Higher Ed portal (Candidate › Internships, and
// Career Services' view of the same list). The only reader of InternshipPosting:
// internships never appear on a member's board, emails or counts.
//
// A row with no institutionId is listed for every partner college; one with an
// institutionId only for that college. Access (members and staff of the college,
// demo rules) is checked by requireWorkspace() before this runs.

export interface InternshipFilters {
  field?: InternshipField
  state?: string // US 2-letter
  remote?: boolean
  term?: InternshipTerm
}

export function parseInternshipFilters(sp: Record<string, string | string[] | undefined>): InternshipFilters {
  const one = (k: string) => {
    const v = sp[k]
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined
  }
  const field = one('field')
  const term = one('term')
  const state = one('state')?.toUpperCase()
  return {
    field: field && (INTERNSHIP_FIELDS as readonly string[]).includes(field) ? (field as InternshipField) : undefined,
    term: term && (INTERNSHIP_TERMS as readonly string[]).includes(term) ? (term as InternshipTerm) : undefined,
    state: state && /^[A-Z]{2}$/.test(state) ? state : undefined,
    remote: one('remote') === '1' ? true : undefined,
  }
}

/** Live internships a college's portal can list (before the student's filters). */
export function liveInternshipWhere(institutionId: string, now = new Date()): Prisma.InternshipPostingWhereInput {
  return {
    archivedAt: null,
    AND: [
      { OR: [{ institutionId: null }, { institutionId }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { OR: [{ deadline: null }, { deadline: { gte: now } }] },
    ],
  }
}

export function internshipFilterWhere(f: InternshipFilters): Prisma.InternshipPostingWhereInput {
  return {
    ...(f.field ? { field: f.field } : {}),
    ...(f.term ? { term: f.term } : {}),
    ...(f.remote ? { remote: true } : {}),
    ...(f.state ? { locationState: f.state } : {}),
  }
}

export const INTERNSHIP_PAGE_SIZE = 100

export async function listInternships(institutionId: string, filters: InternshipFilters) {
  const base = liveInternshipWhere(institutionId)
  const where: Prisma.InternshipPostingWhereInput = { AND: [base, internshipFilterWhere(filters)] }
  const [rows, total, states] = await Promise.all([
    prisma.internshipPosting.findMany({
      where,
      // This college's own listings first, then soonest deadline, then newest.
      orderBy: [{ institutionId: { sort: 'asc', nulls: 'last' } }, { deadline: { sort: 'asc', nulls: 'last' } }, { postedAt: { sort: 'desc', nulls: 'last' } }],
      take: INTERNSHIP_PAGE_SIZE,
      select: {
        id: true, title: true, companyName: true, location: true, locationState: true, remote: true, field: true, term: true,
        termYear: true, deadline: true, url: true, salaryMin: true, salaryMax: true, payPeriod: true, postedAt: true, institutionId: true,
      },
    }),
    prisma.internshipPosting.count({ where }),
    prisma.internshipPosting.groupBy({ by: ['locationState'], where: { AND: [base, { locationState: { not: null } }] }, _count: { _all: true } }),
  ])
  return {
    rows,
    total,
    states: states
      .map((s) => ({ state: s.locationState as string, count: s._count._all }))
      .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state)),
  }
}

export type InternshipRow = Awaited<ReturnType<typeof listInternships>>['rows'][number]
