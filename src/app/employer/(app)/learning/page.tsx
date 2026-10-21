import type { Metadata } from 'next'
import Link from 'next/link'
import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { learningReport, orgProgramTypes } from '@/lib/employer/staff-programs'
import { PROGRAM_TYPE_BLURB } from '@/lib/employer/program-type'
import { NotOnProgram, StatTile, showCell } from '@/components/employer/StaffStats'
import { AddCourseForm, CourseActiveToggle } from '@/components/employer/StaffProgramForms'
import { CohortAiGapPanel } from '@/components/skills/CohortAiGapPanel'
import { buttonVariants } from '@/components/ui/button'
import { captureServerEvent } from '@/lib/posthog/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Learning' }

export default async function EmployerLearningPage() {
  const orgUser = await requireOutplacementRole(['ADMIN', 'VIEWER'])
  if (!(await orgProgramTypes(orgUser.orgId)).has('LEARNING')) return <NotOnProgram program="Learning" what={PROGRAM_TYPE_BLURB.LEARNING} />
  const r = await learningReport(orgUser.orgId)
  const isAdmin = orgUser.role === 'ADMIN'
  captureServerEvent(orgUser.userId, 'org_ai_gap_viewed', { orgId: orgUser.orgId, surface: 'learning', shown: r.aiGap !== null, counted: r.aiGap?.counted ?? 0 })

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Learning</p>
        <h1 className="text-2xl font-semibold tracking-tight">Skills for the roles ahead</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Each person gets a skills plan for their role and the next one, with your courses first. You see counts only, once at least 10 people have joined.
        </p>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/employer/enroll" className={cn(buttonVariants())}>
              Enroll people
            </Link>
            <a href="#courses" className="text-sm text-muted-foreground underline underline-offset-4">
              Add a course you cover
            </a>
          </div>
        )}
      </div>

      <section aria-labelledby="learning-participation" className="space-y-3">
        <h2 id="learning-participation" className="text-lg font-semibold">
          Participation
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Joined" value={r.joined} of={r.enrolled} />
          <StatTile label="Active in the last 30 days" value={r.active30} />
          <StatTile label="Started one of your courses" value={r.started} />
          <StatTile label="Finished one of your courses" value={r.completed} />
        </div>
      </section>

      <CohortAiGapPanel gap={r.aiGap} who="people" />

      {r.byTeam.length > 0 && (
        <section aria-labelledby="learning-teams" className="space-y-3">
          <h2 id="learning-teams" className="text-lg font-semibold">
            By team
          </h2>
          <p className="text-sm text-muted-foreground">Teams are the group you enrolled people with. Teams under 10 people are pooled.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-1 font-medium">Team</th>
                  <th className="px-2 py-1 font-medium">Joined</th>
                  <th className="px-2 py-1 font-medium">Started a course</th>
                  <th className="px-2 py-1 font-medium">Finished a course</th>
                </tr>
              </thead>
              <tbody>
                {r.byTeam.map((t) => (
                  <tr key={t.label} className="border-t border-border tabular-nums">
                    <td className="px-2 py-1">{t.label}</td>
                    <td className="px-2 py-1">{t.joined}</td>
                    <td className="px-2 py-1">{showCell(t.started)}</td>
                    <td className="px-2 py-1">{showCell(t.completed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section id="courses" aria-labelledby="learning-courses" className="space-y-4">
        <div>
          <h2 id="learning-courses" className="text-lg font-semibold">
            Courses you cover
          </h2>
          <p className="text-sm text-muted-foreground">These show first in each person’s skills plan when they match the skills that person needs.</p>
        </div>
        {r.courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No courses yet. Until you add some, people see NextChapter’s course suggestions.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {r.courses.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {c.title}
                    {!c.isActive && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">Hidden</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{[c.provider, c.covered].filter(Boolean).join(' · ') || 'No provider set'}</p>
                </div>
                <div className="flex items-center gap-4 text-sm tabular-nums">
                  <span className="text-muted-foreground">
                    {showCell(c.started)} started · {showCell(c.completed)} finished
                  </span>
                  {isAdmin && <CourseActiveToggle courseId={c.id} title={c.title} isActive={c.isActive} />}
                </div>
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-base font-semibold">Add a course</h3>
            <AddCourseForm />
          </div>
        )}
      </section>
    </div>
  )
}
