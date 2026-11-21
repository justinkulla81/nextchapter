// Which programs an alum sees across a university's schools (owner, 2026-11-21): the institution's own programs, their
// own school's, and other schools' programs those schools opened to everyone. Client-safe and pure.

import type { Prisma } from '@prisma/client'

/** The Prisma filter for programs one alum can see. No school known: institution-wide and opened programs only. */
export function programsVisibleTo(memberSchool: string | null | undefined): Prisma.ProgramWhereInput {
  return {
    OR: [{ school: null }, { openToOtherSchools: true }, ...(memberSchool ? [{ school: { equals: memberSchool, mode: 'insensitive' as const } }] : [])],
  }
}

/** The same rule for one program, for lists already read. Exported for tests. */
export function programVisibleTo(p: { school: string | null; openToOtherSchools: boolean }, memberSchool: string | null | undefined): boolean {
  return !p.school || p.openToOtherSchools || (!!memberSchool && p.school.toLowerCase() === memberSchool.toLowerCase())
}

/** "From the Tepper School of Business" when a program is another school's, for the card. */
export function otherSchoolLabel(p: { school: string | null }, memberSchool: string | null | undefined): string | null {
  if (!p.school) return null
  return memberSchool && p.school.toLowerCase() === memberSchool.toLowerCase() ? null : `From ${p.school}, open to all alumni`
}
