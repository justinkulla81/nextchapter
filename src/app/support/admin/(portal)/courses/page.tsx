import type { Course, CourseCategory } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createCourse, updateCourse, toggleCourseActive, deleteCourse } from './actions'
import { CourseForm } from '@/components/admin/CourseForm'
import { ConfirmForm } from '@/components/admin/ConfirmForm'
import { COURSE_SKILL_LEVELS, COURSE_SKILL_LEVEL_LABELS } from '@/lib/constants/course-skill-level'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'

export const maxDuration = 30

const CATEGORY_LABELS: Record<CourseCategory, string> = {
  AI_TRAINING: 'AI Training',
  BUSINESS_SKILLS: 'Business Skills',
  CERTIFICATION: 'Certifications',
  FUNCTION_TRAINING: 'Function Training',
  SPEAKING: 'Public Speaking',
}

function CourseCard({ course }: { course: Course }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {course.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- admin-provided external URL
              <img src={course.logoUrl} alt="" className="mt-0.5 size-8 shrink-0 rounded object-contain" />
            )}
            <div>
              {course.sponsor && (
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{course.sponsor}</p>
              )}
              <p className="font-medium">
                {course.title}
                {!course.isActive && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Inactive
                  </span>
                )}
                {course.free && (
                  <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                    Free
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
              {course.category === 'CERTIFICATION' && course.targetFunctions.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">For: {course.targetFunctions.join(', ')}</p>
              )}
              {course.category === 'FUNCTION_TRAINING' && course.keywords.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Keywords: {course.keywords.join(', ')}</p>
              )}
              {course.requiresManagementSignal && (
                <p className="mt-1 text-xs text-muted-foreground">Requires management signal</p>
              )}
              {course.excludeIfHasMBA && <p className="mt-1 text-xs text-muted-foreground">Hidden from MBA holders</p>}
              <a
                href={course.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block truncate text-xs text-primary underline underline-offset-4"
              >
                {course.url}
              </a>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <form action={toggleCourseActive.bind(null, course.id, course.isActive)}>
              <SubmitButton variant="ghost" size="sm">
                {course.isActive ? 'Deactivate' : 'Activate'}
              </SubmitButton>
            </form>
            <ConfirmForm
              action={deleteCourse.bind(null, course.id)}
              confirmMessage={`Delete "${course.title}"? This can't be undone.`}
            >
              <SubmitButton variant="ghost" size="sm">
                Delete
              </SubmitButton>
            </ConfirmForm>
          </div>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-brand">Edit</summary>
          <div className="mt-3">
            <CourseForm action={updateCourse.bind(null, course.id)} existing={course} />
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

export default async function CoursesAdminPage() {
  await requireAdmin()

  const courses = await prisma.course.findMany({
    orderBy: [{ category: 'asc' }, { skillLevel: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
        <p className="mt-1 text-muted-foreground">
          The full Learning-page catalog, grouped by category. AI Training is further gated by skill level — a
          candidate&apos;s self-reported AI-skill confidence picks which level shows by default, so keep the
          Beginner tier well-stocked since most candidates land there. Certifications, Function Training, Business
          Skills, and Public Speaking use their own targeting fields instead (set them per course via Edit).
        </p>
      </div>

      <CourseForm action={createCourse} />

      {(Object.keys(CATEGORY_LABELS) as CourseCategory[]).map((category) => {
        const categoryCourses = courses.filter((c) => c.category === category)
        return (
          <div key={category} className="space-y-4">
            <h2 className="text-base font-semibold tracking-tight">
              {CATEGORY_LABELS[category]} ({categoryCourses.length})
            </h2>
            {categoryCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courses in this category yet.</p>
            ) : category === 'AI_TRAINING' ? (
              COURSE_SKILL_LEVELS.map((level) => {
                const levelCourses = categoryCourses.filter((c) => c.skillLevel === level)
                if (levelCourses.length === 0) return null
                return (
                  <div key={level} className="space-y-3">
                    <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                      {COURSE_SKILL_LEVEL_LABELS[level]} ({levelCourses.length})
                    </h3>
                    <div className="space-y-3">
                      {levelCourses.map((course) => (
                        <CourseCard key={course.id} course={course} />
                      ))}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="space-y-3">
                {categoryCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
