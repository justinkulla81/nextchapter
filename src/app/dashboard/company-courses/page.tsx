import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { staffProgramsForCandidate } from '@/lib/employer/staff-programs'
import { captureServerEvent } from '@/lib/posthog/server'
import { CourseStatusButtons } from '@/components/dashboard/staff/StaffButtons'
import type { CourseStatus } from './actions'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'
import { RowList } from '@/components/candidate/RowList'

export const metadata: Metadata = { title: 'Company courses' }

export default async function CompanyCoursesPage() {
  const profile = await getDashboardProfile()
  const programs = (await staffProgramsForCandidate(profile.id)).filter((p) => p.programType === 'LEARNING')
  const redesign = isRedesignOn(profile.email)
  if (!programs.length) {
    if (redesign) {
      return (
        <div className="space-y-8">
          <PageHeader
            title="Company courses"
            intro="When your employer offers NextChapter Learning, the courses they cover show up here, free to you."
            action={<ActionLink variant="primary" href="/dashboard/learning" event="company_courses_skills_plan_opened" props={{ hasPrograms: false }}>See your skills plan</ActionLink>}
          />
          <p className="rounded-2xl border border-border p-6 text-base text-ink">Nothing is covered by an employer yet. Your skills plan has the courses that would do the most for your search.</p>
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Company courses</h1>
        <p className="text-sm text-muted-foreground">
          When your employer offers NextChapter Learning, the courses they cover show up here. Your own skills plan is in{' '}
          <Link href="/dashboard/learning" className="underline underline-offset-4">
            Learn new skills
          </Link>
          .
        </p>
      </div>
    )
  }
  const courses = await prisma.orgCourse.findMany({
    where: { orgId: { in: programs.map((p) => p.orgId) }, isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, orgId: true, title: true, provider: true, url: true, skills: true, covered: true, note: true },
  })
  const progress = new Map(
    (await prisma.orgCourseProgress.findMany({ where: { candidateId: profile.id, courseId: { in: courses.map((c) => c.id) } }, select: { courseId: true, status: true } })).map((p) => [p.courseId, p.status as CourseStatus])
  )
  const orgName = new Map(programs.map((p) => [p.orgId, p.orgName]))
  captureServerEvent(profile.id, 'company_courses_viewed', { courses: courses.length, started: progress.size })
  const names = [...new Set(programs.map((p) => p.orgName))].join(' and ')

  if (redesign) {
    return (
      <div className="space-y-8">
        <PageHeader
          title={`Courses ${names} covers`}
          intro={`Mark where you are on each one. ${names} sees how many people started or finished a course, never who.`}
          action={<ActionLink variant="primary" href="/dashboard/learning" event="company_courses_skills_plan_opened" props={{ hasPrograms: true, courses: courses.length }}>See your skills plan</ActionLink>}
        />
        {courses.length === 0 ? (
          <p className="rounded-2xl border border-border p-6 text-base text-ink">{names} has not listed any courses yet. Your skills plan has NextChapter’s suggestions in the meantime.</p>
        ) : (
          <RowList
            label="Courses your employer covers"
            items={courses.map((c) => ({
              key: c.id,
              title: c.title,
              href: c.url ?? undefined,
              why: c.skills.length > 0 ? `Builds ${c.skills.join(', ')}.` : undefined,
              fact: [c.provider, c.covered, programs.length > 1 ? orgName.get(c.orgId) : null].filter(Boolean).join(' · ') || undefined,
              actions: <CourseStatusButtons courseId={c.id} title={c.title} status={progress.get(c.id) ?? 'NONE'} />,
              detailLabel: c.note ? 'A note from your employer' : undefined,
              detail: c.note ? <p className="whitespace-pre-line">{c.note}</p> : undefined,
            }))}
          />
        )}
        <p className="text-sm text-muted-foreground">
          Courses matched to your target role are in your skills plan.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Courses {names} covers</h1>
        <p className="text-sm text-muted-foreground">
          Mark where you are on each one. {names} sees how many people started or finished a course, never who. For courses matched to your target role, see{' '}
          <Link href="/dashboard/learning" className="underline underline-offset-4">
            your skills plan
          </Link>
          .
        </p>
      </div>
      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{names} hasn’t listed any courses yet. Your skills plan has NextChapter’s suggestions in the meantime.</p>
      ) : (
        <ul className="space-y-3">
          {courses.map((c) => (
            <li key={c.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {c.title}
                      </a>
                    ) : (
                      c.title
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground">{[c.provider, c.covered, programs.length > 1 ? orgName.get(c.orgId) : null].filter(Boolean).join(' · ')}</p>
                </div>
                <CourseStatusButtons courseId={c.id} title={c.title} status={progress.get(c.id) ?? 'NONE'} />
              </div>
              {c.skills.length > 0 && <p className="text-xs text-muted-foreground">Builds: {c.skills.join(', ')}</p>}
              {c.note && <p className="whitespace-pre-line text-sm">{c.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
