import type { Course, CourseCategory } from '@prisma/client'
import { ChevronDown } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createCourse, updateCourse, toggleCourseActive, deleteCourse, addFoundCourse, dismissFoundCourse, postFoundCourseToX } from './actions'
import { loadScanState, type Candidate } from '@/lib/learning/course-scan/run'
import { linkedinCoursePost, xCoursePost } from '@/lib/learning/course-scan/posts'
import { CHANNELS } from '@/lib/social/channels'
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
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-brand">
            Edit
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3">
            <CourseForm action={updateCourse.bind(null, course.id)} existing={course} />
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

function FoundCourses({ items, xReady }: { items: Candidate[]; xReady: boolean }) {
  const waiting = items.filter((c) => !c.addedAt)
  const added = items.filter((c) => c.addedAt)
  if (items.length === 0) return null
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold tracking-tight">New courses found by the weekly scan ({waiting.length})</h2>
      <p className="text-sm text-muted-foreground">
        Found at Google, Anthropic, DeepLearning.AI and Microsoft. The function and level are a first guess from the title; check them, then add. Nothing is in the
        catalog or posted until you act. Adding one drafts the X and LinkedIn posts below.
      </p>
      {waiting.map((c) => (
        <Card key={c.url}>
          <CardContent className="space-y-2 pt-6">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{c.sponsor}</p>
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">{c.title}</a>
            <p className="text-sm text-muted-foreground">
              {c.functions.length ? c.functions.join(', ') : 'Any function'} · {COURSE_SKILL_LEVEL_LABELS[c.skillLevel]} · {c.free ? 'Free' : 'Check cost'} · {c.source}
            </p>
            {c.description && <p className="text-sm">{c.description}</p>}
            <div className="flex gap-2">
              <form action={addFoundCourse.bind(null, c.url)}><SubmitButton size="sm">Add to catalog</SubmitButton></form>
              <form action={dismissFoundCourse.bind(null, c.url)}><SubmitButton variant="ghost" size="sm">Dismiss</SubmitButton></form>
            </div>
          </CardContent>
        </Card>
      ))}
      {added.length > 0 && <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Added: posts to publish</h3>}
      {added.map((c) => (
        <Card key={c.url}>
          <CardContent className="space-y-3 pt-6">
            <p className="font-medium">{c.title}</p>
            <div>
              <p className="text-xs font-medium text-muted-foreground">X</p>
              <p className="text-sm whitespace-pre-wrap">{xCoursePost(c)}</p>
              {c.xPostedAt ? (
                <p className="text-xs text-muted-foreground">Posted to X {new Date(c.xPostedAt).toLocaleDateString('en-US')}</p>
              ) : xReady ? (
                <form action={postFoundCourseToX.bind(null, c.url)} className="mt-1"><SubmitButton size="sm">Post to X</SubmitButton></form>
              ) : (
                <p className="text-xs text-muted-foreground">X posting is off (needs the X keys and X_POSTING_ENABLED=1); copy the text instead.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">LinkedIn (copy and post; there is no LinkedIn posting connection yet)</p>
              <p className="text-sm whitespace-pre-wrap">{linkedinCoursePost(c)}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default async function CoursesAdminPage() {
  await requireAdmin()

  const found = (await loadScanState().catch(() => null))?.pending ?? []
  const xReady = !!CHANNELS.find((ch) => ch.id === 'x')?.ready()
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

      <FoundCourses items={found} xReady={xReady} />

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
