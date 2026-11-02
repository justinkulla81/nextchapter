import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { LEARNING_PROVIDERS } from '@/lib/constants/learning-partners'
import { LINK } from '@/components/topics/blocks'
import { catalogFunctionByName, coursePath, functionPath, levelInfo, type PublicCourse } from '@/lib/learning/public-catalog-shared'

const CARD = 'rounded-xl border border-border bg-white p-5'

const LEVEL_STYLE: Record<PublicCourse['level'], string> = {
  BEGINNER: 'bg-emerald-50 text-emerald-800',
  INTERMEDIATE: 'bg-sky-50 text-sky-800',
  ADVANCED: 'bg-violet-50 text-violet-800',
}

export const providerInfo = (provider: string) =>
  LEARNING_PROVIDERS[provider] ?? { name: provider, designation: 'INCLUDED_FOR_QUALITY' as const, designationNote: null }

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t)

/** One course: our page for it first, the provider's own page as the outbound step. `source` names the page for analytics. */
export function CourseCard({ course, source }: { course: PublicCourse; source: string }) {
  const p = providerInfo(course.provider)
  return (
    <li className={CARD}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{course.sponsor}</p>
      <h3 className="mt-1 text-base font-semibold text-navy">
        <Link href={coursePath(course)} className="hover:underline">{course.title}</Link>
      </h3>
      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
        <span className={`rounded-full px-2 py-0.5 ${LEVEL_STYLE[course.level]}`}>{levelInfo(course.level).label}</span>
        <span className="rounded-full bg-off-white px-2 py-0.5 text-foreground">{course.free ? 'Free' : 'Check cost'}</span>
        {course.category === 'CERTIFICATION' && <span className="rounded-full bg-off-white px-2 py-0.5 text-foreground">Certification</span>}
        {course.functions.slice(0, 3).map((f) => {
          const info = catalogFunctionByName(f)
          return info ? <Link key={f} href={functionPath(info)} className="rounded-full bg-off-white px-2 py-0.5 text-foreground hover:underline">{f}</Link> : null
        })}
        {course.functions.length === 0 && <span className="rounded-full bg-off-white px-2 py-0.5 text-foreground">Any role</span>}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{clip(course.description, 190)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <TrackedLink
          href={course.url}
          rel="nofollow"
          event="course_outbound_clicked"
          properties={{ source, course: course.slug, level: course.level, provider: course.provider, free: course.free }}
          className={LINK}
        >
          Take it on {p.name}
        </TrackedLink>
        <Link href={coursePath(course)} className="text-muted-foreground hover:text-foreground hover:underline">Details</Link>
      </div>
    </li>
  )
}

export function CourseGrid({ courses, source }: { courses: PublicCourse[]; source: string }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => <CourseCard key={c.slug} course={c} source={source} />)}
    </ul>
  )
}

/** The line every list page carries: levels and functions are ours, cost is the provider's. */
export function CatalogNote() {
  return (
    <p className="mt-6 max-w-3xl text-xs text-muted-foreground">
      Levels and functions are NextChapter&apos;s guidance, read from each course&apos;s own description; the provider may label them differently or not at all. Cost, dates and content are set by the provider, so check its page before you enroll.
      Providers marked &quot;Partner&quot; have a relationship with NextChapter; the others are included because the course is good.
    </p>
  )
}

export function Disclosure({ provider }: { provider: string }) {
  const p = providerInfo(provider)
  return (
    <p className="text-xs text-muted-foreground">
      {p.name}: {p.designation === 'PARTNER' ? 'NextChapter partner.' : 'Included for quality.'} {p.designationNote ?? ''}
    </p>
  )
}
