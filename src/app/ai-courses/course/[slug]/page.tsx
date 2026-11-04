import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { JoinBand, Section, TopicShell } from '@/components/topics/blocks'
import { CourseGrid, Disclosure, providerInfo } from '@/components/ai-courses/blocks'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { canonical } from '@/lib/seo/canonical'
import { fitDescription } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'
import { getPublicCatalog } from '@/lib/learning/public-catalog'
import { catalogFunctionByName, coursePath, functionLevelPath, functionPath, levelInfo, levelPath, relatedCourses } from '@/lib/learning/public-catalog-shared'
import { courseJsonLd } from '@/lib/learning/public-catalog-seo'
import { SECONDARY_ACTION } from '@/components/ui/secondary-action'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug
  const c = (await getPublicCatalog()).find((x) => x.slug === slug)
  if (!c) return { title: 'AI courses', robots: { index: false, follow: true } }
  const l = levelInfo(c.level)
  return {
    title: titleMeta(`${c.title}: ${l.label.toLowerCase()} AI course`),
    description: fitDescription(`${c.description} ${l.label} level, ${c.free ? 'free' : 'check cost'}, from ${c.sponsor}.`, 160),
    ...canonical(coursePath(c)),
  }
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const catalog = await getPublicCatalog()
  const c = catalog.find((x) => x.slug === slug)
  if (!c) redirect('/ai-courses')
  const l = levelInfo(c.level)
  const p = providerInfo(c.provider)
  const fns = c.functions.map(catalogFunctionByName).filter((f): f is NonNullable<typeof f> => !!f)
  const related = relatedCourses(catalog, c)
  const source = `ai_course_${c.slug}`
  return (
    <TopicShell
      trail={[{ name: 'AI courses', path: '/ai-courses' }, { name: c.title, path: coursePath(c) }]}
      title={c.title}
      intro={`${l.label} AI course from ${c.sponsor}. ${c.free ? 'Free.' : 'Check cost on the provider\'s page.'}`}
      jsonLd={[courseJsonLd(c)]}
    >
      <div className="mt-6 max-w-3xl rounded-xl border border-border bg-white p-6">
        <p className="text-base text-foreground">{c.description}</p>
        <div className="mt-5">
          <TrackedLink
            href={c.url}
            rel="nofollow"
            event="course_outbound_clicked"
            properties={{ source, course: c.slug, level: c.level, provider: c.provider, free: c.free }}
            className={SECONDARY_ACTION}
          >
            Take it on {p.name}
          </TrackedLink>
        </div>
        <div className="mt-4"><Disclosure provider={c.provider} /></div>
      </div>

      <Section id="fit" title="Is this the right course for you?" note="Level and function are NextChapter's guidance, read from the course description; the provider may label them differently.">
        <dl className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Level</dt><dd className="mt-1 text-sm text-foreground"><Link href={levelPath(l)} className="font-semibold text-brand underline underline-offset-4">{l.label}</Link>. {l.who}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Before you start</dt><dd className="mt-1 text-sm text-foreground">{l.before}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Who it is for</dt><dd className="mt-1 text-sm text-foreground">
            {fns.length > 0 ? fns.map((f, i) => <span key={f.slug}>{i > 0 && ', '}<Link href={functionLevelPath(f, l)} className="text-brand underline underline-offset-4">{f.people}</Link></span>) : 'Any role'}
          </dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">After the course</dt><dd className="mt-1 text-sm text-foreground">{l.after}</dd></div>
          {c.skills.length > 0 && <div className="sm:col-span-2"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI skills it builds</dt><dd className="mt-1 text-sm text-foreground">{c.skills.join(', ')}</dd></div>}
        </dl>
        {fns.length > 0 && <p className="mt-4 text-sm"><Link href={functionPath(fns[0])} className="text-brand underline underline-offset-4">All AI courses for {fns[0].people}</Link></p>}
      </Section>

      {related.length > 0 && (
        <Section id="next" title="Related courses">
          <CourseGrid courses={related} source={`${source}_related`} />
        </Section>
      )}
      <JoinBand source={source} what="which AI skills your target jobs ask for and whether this course closes your gap" />
    </TopicShell>
  )
}
