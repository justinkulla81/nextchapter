import type { Prisma } from '@prisma/client'

// Owner rule: internships only appear in Higher Ed portals. They are stored in
// their own table (InternshipPosting, see ./data.ts), but a few can still reach
// ExclusiveJobPosting through an admin, employer or institution form. Every
// member-facing read of that table keeps them out: by the crawler's
// employment type here, and by title in memory (isInternshipJob, work-type.ts).

/** ExclusiveJobPosting.employmentType values that mean an internship. */
export const INTERNSHIP_EMPLOYMENT_TYPES = ['internship', 'co_op', 'coop'] as const

/** Rows not typed as an internship (a NULL type is kept — NOT IN alone would drop it). */
export function notInternshipWhere(): Prisma.ExclusiveJobPostingWhereInput {
  return { OR: [{ employmentType: null }, { employmentType: { notIn: [...INTERNSHIP_EMPLOYMENT_TYPES] } }] }
}
