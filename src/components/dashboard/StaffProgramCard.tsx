import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { INTERNAL_ROLE_STATUS, staffProgramsForCandidate } from '@/lib/employer/staff-programs'

// For someone on their current employer's Growth or Learning program: what
// it gives them, and the privacy line. The employer sees counts only.
export async function StaffProgramCard({ candidateId }: { candidateId: string }) {
  let programs: Awaited<ReturnType<typeof staffProgramsForCandidate>> = []
  try {
    programs = await staffProgramsForCandidate(candidateId)
  } catch (error) {
    console.error('Failed to load employer Growth/Learning programs:', error)
  }
  if (!programs.length) return null
  const orgIds = [...new Set(programs.map((p) => p.orgId))]
  const [roles, courses] = await Promise.all([
    prisma.exclusiveJobPosting.count({ where: { orgScopeId: { in: programs.filter((p) => p.programType === 'GROWTH').map((p) => p.orgId) }, status: INTERNAL_ROLE_STATUS, archivedAt: null } }),
    prisma.orgCourse.count({ where: { orgId: { in: programs.filter((p) => p.programType === 'LEARNING').map((p) => p.orgId) }, isActive: true } }),
  ])
  const org = programs[0].orgName
  const name = orgIds.length === 1 ? programs[0].name : 'Your employer’s program'
  const growth = programs.some((p) => p.programType === 'GROWTH')
  const learning = programs.some((p) => p.programType === 'LEARNING')
  const tiles = [
    ...(growth
      ? [
          { href: '/dashboard/in-work?tab=prep', label: 'Review and raise prep', what: 'Log wins as they happen and walk into your review ready.' },
          { href: '/dashboard/in-work?tab=promotion', label: 'Promotion plan', what: 'The gaps to your next level and a 30-60-90 plan.' },
          { href: '/dashboard/internal-roles', label: `Roles at ${org}`, what: roles ? `${roles} open now, only for people at ${org}.` : `Roles ${org} posts for its own people.` },
          { href: '/dashboard/pivot-paths', label: 'Career pivot paths', what: 'Where people with your background moved next.' },
        ]
      : []),
    ...(learning
      ? [
          { href: '/dashboard/learning', label: 'Your skills plan', what: 'The skills your role and next role ask for, and how to build them.' },
          { href: '/dashboard/company-courses', label: `Courses ${org} covers`, what: courses ? `${courses} listed.` : 'Listed here as they’re added.' },
        ]
      : []),
  ]
  return (
    <section aria-labelledby="staff-program" className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 id="staff-program" className="text-base font-semibold">
          {name}
        </h2>
        <p className="text-xs text-muted-foreground">
          Provided by {org}. {org} sees counts across everyone, never your activity, and never that you’re looking around.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="block h-full rounded-md border border-border p-3 text-sm hover:border-primary">
              <span className="font-medium">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.what}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// On Learn new skills: a pointer to the courses an employer covers.
export async function CompanyCoursesCallout({ candidateId }: { candidateId: string }) {
  let programs: Awaited<ReturnType<typeof staffProgramsForCandidate>> = []
  try {
    programs = (await staffProgramsForCandidate(candidateId)).filter((p) => p.programType === 'LEARNING')
  } catch {
    return null
  }
  if (!programs.length) return null
  const count = await prisma.orgCourse.count({ where: { orgId: { in: programs.map((p) => p.orgId) }, isActive: true } })
  if (!count) return null
  return (
    <Link href="/dashboard/company-courses" className="block rounded-lg border border-border bg-card p-3 text-sm hover:border-primary">
      <span className="font-medium">
        {count} course{count === 1 ? '' : 's'} {programs[0].orgName} covers
      </span>
      <span className="block text-xs text-muted-foreground">Start with these: your employer pays for them.</span>
    </Link>
  )
}
