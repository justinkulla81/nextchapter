import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Chips, JoinBand, Section, TopicShell } from '@/components/topics/blocks'
import { CatalogNote, CourseGrid } from '@/components/ai-courses/blocks'
import { LevelFinder } from '@/components/ai-courses/LevelFinder'
import { canonical } from '@/lib/seo/canonical'
import { titleMeta } from '@/lib/seo/title'
import { functionByName } from '@/lib/seo/topics'
import { getPublicCatalog } from '@/lib/learning/public-catalog'
import { LEVELS, catalogFunctionBySlug, coursesForFunction, functionLevelPageIndexable, functionLevelPath, functionPageIndexable, functionPath, sortByLevel } from '@/lib/learning/public-catalog-shared'
import { GENERAL_FAQ, faqJsonLd, itemListJsonLd } from '@/lib/learning/public-catalog-seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ function: string }> }): Promise<Metadata> {
  const f = catalogFunctionBySlug((await params).function)
  if (!f) return { title: 'AI courses', robots: { index: false, follow: true } }
  const catalog = await getPublicCatalog()
  return {
    title: titleMeta(`AI courses for ${f.people}`),
    description: `AI courses and certifications for ${f.people}, sorted from beginner to advanced. ${f.blurb}`.slice(0, 160),
    robots: { index: functionPageIndexable(catalog, f.name), follow: true },
    ...canonical(functionPath(f)),
  }
}

export default async function FunctionCoursesPage({ params }: { params: Promise<{ function: string }> }) {
  const f = catalogFunctionBySlug((await params).function)
  if (!f) redirect('/ai-courses')
  const catalog = await getPublicCatalog()
  const specific = coursesForFunction(catalog, f.name)
  const general = sortByLevel(catalog.filter((c) => c.functions.length === 0 && c.category === 'AI_TRAINING'))
  const jobs = functionByName(f.name)
  const faq = [
    { q: `Which AI course should ${f.people} take first?`, a: `Start at your own level, then choose a course written for ${f.people} if there is one at that level. ${specific.length > 0 ? `This page lists ${specific.length} written for the work, then the general AI courses that fit any role.` : 'This function has few courses written for it so far, so begin with the general AI courses below.'}` },
    GENERAL_FAQ[1],
    GENERAL_FAQ[2],
  ]
  const levelLinks = LEVELS.filter((l) => functionLevelPageIndexable(catalog, f.name, l.level))
  return (
    <TopicShell
      trail={[{ name: 'AI courses', path: '/ai-courses' }, { name: f.name, path: functionPath(f) }]}
      title={`AI courses for ${f.people}`}
      intro={`${f.blurb} ${specific.length} ${specific.length === 1 ? 'course is' : 'courses are'} written for ${f.people}; the general AI courses further down fit any role.`}
      jsonLd={[itemListJsonLd(`AI courses for ${f.people}`, functionPath(f), [...specific, ...general]), faqJsonLd(faq)]}
    >
      {levelLinks.length > 0 && (
        <Section id="by-level" title={`${f.name} courses by level`}>
          <Chips kind="ai_courses_function_level" event="ai_courses_link_clicked" items={levelLinks.map((l) => ({ href: functionLevelPath(f, l), label: l.label, detail: String(coursesForFunction(catalog, f.name, { level: l.level }).length) }))} />
        </Section>
      )}
      <div className="mt-10"><LevelFinder source={`ai_courses_function_${f.slug}`} defaultFunction={f.slug} /></div>
      {specific.length > 0 && (
        <Section id="specific" title={`Written for ${f.people}`}>
          <CourseGrid courses={specific} source={`ai_courses_function_${f.slug}`} />
        </Section>
      )}
      <Section id="general" title="General AI courses that fit any role" note="Start here if no course above matches your level yet.">
        <CourseGrid courses={general} source={`ai_courses_function_${f.slug}_general`} />
        <CatalogNote />
      </Section>
      {jobs && <p className="mt-8 text-sm"><Link href={`/functions/${jobs.slug}`} className="text-brand underline underline-offset-4">See open {f.name} jobs and which skills they name</Link></p>}
      <Section id="faq" title="Questions people ask">
        <dl className="space-y-4">
          {faq.map((x) => <div key={x.q}><dt className="text-sm font-semibold text-navy">{x.q}</dt><dd className="mt-1 max-w-3xl text-sm text-muted-foreground">{x.a}</dd></div>)}
        </dl>
      </Section>
      <JoinBand source={`ai_courses_function_${f.slug}`} what={`which AI skills ${f.name.toLowerCase()} jobs ask for and which courses close your gap`} />
    </TopicShell>
  )
}
