import type { Metadata } from 'next'
import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { LINK, Section, TopicShell } from '@/components/topics/blocks'
import { InterestForm } from '@/components/ai-retraining/InterestForm'
import { canonical } from '@/lib/seo/canonical'
import { titleMeta } from '@/lib/seo/title'
import { getPublicCatalog } from '@/lib/learning/public-catalog'
import { providerInfo } from '@/components/ai-courses/blocks'
import { CHECKED_PROGRAMS, ONLINE_PICKS, PROGRAMS_CHECKED_ON, REVIEWED_ON } from '@/lib/learning/ai-retraining'
import { coursePath, levelInfo, type PublicCourse } from '@/lib/learning/public-catalog-shared'

export const dynamic = 'force-dynamic'

const TITLE = 'Best AI retraining programs, online and in person'
const DESCRIPTION = 'The AI courses we rate highest, the college and public programs we have checked, and a place to register your interest by function and industry.'

export const metadata: Metadata = { title: titleMeta(TITLE), description: DESCRIPTION, ...canonical('/ai-retraining') }

const CARD = 'rounded-xl border border-border bg-white p-5'

export default async function AiRetrainingPage({ searchParams }: { searchParams: Promise<{ confirmed?: string }> }) {
  const { confirmed } = await searchParams
  const catalog = await getPublicCatalog()
  const picks = ONLINE_PICKS.flatMap((p) => {
    const course = catalog.find((c) => p.match.test(c.title))
    return course ? [{ course: p.sponsor ? { ...course, sponsor: p.sponsor } : course, ...p }] : []
  })
  return (
    <TopicShell
      trail={[{ name: 'AI courses', path: '/ai-courses' }, { name: 'AI retraining', path: '/ai-retraining' }]}
      title="Best AI retraining programs, online and in person"
      intro="Start with the online courses we rate highest. Then see the college and public programs we have checked, and register your interest so we can tell you what fits your work."
    >
      <div className="mt-8"><InterestForm source="ai_retraining_page" confirmed={confirmed === '1'} /></div>

      <Section id="online" title="Best online AI courses" note={`Rated A (top pick) or B (good) in our review of ${REVIEWED_ON}. Self-paced, so you can start today.`}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {picks.map(({ course, grade, why }) => <PickCard key={course.slug} course={course} grade={grade} why={why} />)}
        </ul>
        <p className="mt-4 text-sm"><Link href="/ai-courses" className={LINK}>All AI courses, by level and profession</Link></p>
      </Section>

      <Section id="programs" title="College and public programs" note={`Programs we opened and read on ${PROGRAMS_CHECKED_ON}. We list only what each program's own page states.`}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {CHECKED_PROGRAMS.map((p) => (
            <li key={p.id} className={CARD}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{p.provider} · {p.where}</p>
              <h3 className="mt-1 text-base font-semibold text-navy">{p.name}</h3>
              <dl className="mt-3 space-y-1 text-sm">
                <div><dt className="inline font-semibold text-foreground">Format: </dt><dd className="inline text-muted-foreground">{p.format}</dd></div>
                <div><dt className="inline font-semibold text-foreground">Cost: </dt><dd className="inline text-muted-foreground">{p.cost}</dd></div>
                <div><dt className="inline font-semibold text-foreground">When: </dt><dd className="inline text-muted-foreground">{p.when}</dd></div>
                <div><dt className="inline font-semibold text-foreground">Who can join: </dt><dd className="inline text-muted-foreground">{p.who}</dd></div>
                <div><dt className="inline font-semibold text-foreground">How to join: </dt><dd className="inline text-muted-foreground">{p.how}</dd></div>
              </dl>
              <p className="mt-3 text-sm">
                <TrackedLink href={p.url} rel="nofollow" event="ai_retraining_program_clicked" properties={{ program: p.id, source: 'ai_retraining_page' }} className={LINK}>Program page</TrackedLink>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="in-person" title="In person" note="Does in-person AI retraining exist? Yes, but it is thin.">
        <div className="max-w-3xl space-y-3 text-sm text-muted-foreground">
          <p>Most AI retraining is online. The in-person programs we found are mainly at community colleges, run as evening cohorts or non-credit certificates, and they are tied to a place: many are open only to residents of one city or state, and few are on a fixed national schedule.</p>
          <p>We have not yet confirmed an in-person program from its own page that we can recommend, so we do not list one. If you register your interest and choose &quot;In person&quot; with your state, we use it to decide which states to look at first, and we will tell you when we have confirmed one near you.</p>
          <p>Your nearest <Link href="/places" className={LINK}>American Job Center</Link> can also tell you about training funded by your state, and some of it covers AI skills.</p>
        </div>
      </Section>

      <Section id="how" title="How we choose">
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Online courses come from our catalog. We opened each course page on {REVIEWED_ON} and graded it on whether it is current, from a credible provider, hands-on or assessed, and a fit for working adults. A is a top pick, B is good.</li>
          <li>No one pays to be on this page.</li>
          <li>Cost, dates and content are set by the provider and change, so check the provider&apos;s page before you enrol. Levels and functions are our reading of each course&apos;s own description.</li>
        </ul>
      </Section>
    </TopicShell>
  )
}

function PickCard({ course, grade, why }: { course: PublicCourse; grade: 'A' | 'B'; why: string }) {
  const p = providerInfo(course.provider)
  return (
    <li className={CARD}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{course.sponsor}</p>
      <h3 className="mt-1 text-base font-semibold text-navy"><Link href={coursePath(course)} className="hover:underline">{course.title}</Link></h3>
      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
        <span className={`rounded-full px-2 py-0.5 ${grade === 'A' ? 'bg-emerald-50 text-emerald-800' : 'bg-sky-50 text-sky-800'}`}>{grade === 'A' ? 'Top pick' : 'Good'}</span>
        <span className="rounded-full bg-off-white px-2 py-0.5 text-foreground">{levelInfo(course.level).label}</span>
        <span className="rounded-full bg-off-white px-2 py-0.5 text-foreground">{course.free ? 'Free' : 'Check cost'}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{why}</p>
      <p className="mt-3 text-sm">
        <TrackedLink href={course.url} rel="nofollow" event="course_outbound_clicked" properties={{ source: 'ai_retraining_page', course: course.slug, level: course.level, provider: course.provider, free: course.free }} className={LINK}>
          Take it on {p.name}
        </TrackedLink>
      </p>
    </li>
  )
}
