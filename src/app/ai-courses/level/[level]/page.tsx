import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Chips, JoinBand, Section, TopicShell } from '@/components/topics/blocks'
import { CatalogNote, CourseGrid } from '@/components/ai-courses/blocks'
import { LevelFinder } from '@/components/ai-courses/LevelFinder'
import { canonical } from '@/lib/seo/canonical'
import { titleMeta } from '@/lib/seo/title'
import { getPublicCatalog } from '@/lib/learning/public-catalog'
import { CATALOG_FUNCTIONS, coursesForFunction, functionLevelPageIndexable, functionLevelPath, levelBySlug, levelPath, sortByLevel } from '@/lib/learning/public-catalog-shared'
import { GENERAL_FAQ, faqJsonLd, itemListJsonLd } from '@/lib/learning/public-catalog-seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }): Promise<Metadata> {
  const l = levelBySlug((await params).level)
  if (!l) return { title: 'AI courses', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`${l.heading}: free and paid`),
    description: `${l.who} ${l.after}`.slice(0, 160),
    ...canonical(levelPath(l)),
  }
}

export default async function LevelPage({ params }: { params: Promise<{ level: string }> }) {
  const l = levelBySlug((await params).level)
  if (!l) redirect('/ai-courses')
  const catalog = await getPublicCatalog()
  const courses = sortByLevel(catalog.filter((c) => c.level === l.level))
  const faq = [
    { q: `Who are ${l.label.toLowerCase()} AI courses for?`, a: l.who },
    { q: `What do I need before a ${l.label.toLowerCase()} AI course?`, a: l.before },
    { q: `What can I do after a ${l.label.toLowerCase()} AI course?`, a: l.after },
    ...GENERAL_FAQ.slice(0, 2),
  ]
  return (
    <TopicShell
      trail={[{ name: 'AI courses', path: '/ai-courses' }, { name: l.label, path: levelPath(l) }]}
      title={l.heading}
      intro={`${courses.length} ${l.label.toLowerCase()} courses and certifications. ${l.who} Before you start: ${l.before.charAt(0).toLowerCase()}${l.before.slice(1)}`}
      jsonLd={[itemListJsonLd(l.heading, levelPath(l), courses), faqJsonLd(faq)]}
    >
      <Section id="courses" title={`${l.label} courses`}>
        <CourseGrid courses={courses} source={`ai_courses_level_${l.slug}`} />
        <CatalogNote />
      </Section>
      <Section id="by-function" title={`${l.label} courses by profession`}>
        <Chips
          kind="ai_courses_level_function"
          event="ai_courses_link_clicked"
          items={CATALOG_FUNCTIONS.filter((f) => functionLevelPageIndexable(catalog, f.name, l.level)).map((f) => ({ href: functionLevelPath(f, l), label: f.name, detail: String(coursesForFunction(catalog, f.name, { level: l.level }).length) }))}
        />
      </Section>
      <div className="mt-12"><LevelFinder source={`ai_courses_level_${l.slug}`} /></div>
      <Section id="faq" title="Questions people ask">
        <dl className="space-y-4">
          {faq.map((f) => (
            <div key={f.q}><dt className="text-sm font-semibold text-navy">{f.q}</dt><dd className="mt-1 max-w-3xl text-sm text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
      </Section>
      <JoinBand source={`ai_courses_level_${l.slug}`} what="which AI skills your target jobs ask for and which courses close your gap" />
    </TopicShell>
  )
}
