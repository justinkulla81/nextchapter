import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { staffProgramsForCandidate } from '@/lib/employer/staff-programs'
import { captureServerEvent } from '@/lib/posthog/server'
import { CourseStatusButtons } from '@/components/dashboard/staff/StaffButtons'
import type { CourseStatus } from './actions'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'
import { RowList } from '@/components/candidate/RowList'
import { EmptyCard } from '@/components/candidate/EmptyCard'

export const metadata: Metadata = { title: 'Company courses' }

export default async function CompanyCoursesPage() {
  const profile = await getDashboardProfile()
  const programs = (await staffProgramsForCandidate(profile.id)).filter((p) => p.programType === 'LEARNING')
  if (!programs.length) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Company courses"
          intro="When your employer offers NextChapter Learning, the courses they cover show up here, free to you."
          action={<ActionLink variant="primary" href="/dashboard/learning" event="company_courses_skills_plan_opened" props={{ hasPrograms: false }}>See your skills plan</ActionLink>}
        />
        <EmptyCard title="Nothing is covered by an employer yet" why="Your skills plan has the courses that would do the most for your search." />
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

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Courses ${names} covers`}
        intro={`Mark where you are on each one. ${names} sees how many people started or finished a course, never who.`}
        action={<ActionLink variant="primary" href="/dashboard/learning" event="company_courses_skills_plan_opened" props={{ hasPrograms: true, courses: courses.length }}>See your skills plan</ActionLink>}
      />
      {courses.length === 0 ? (
        <EmptyCard title={`${names} has not listed any courses yet`} why="Your skills plan has NextChapter’s suggestions in the meantime." />
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
