import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { JoinBand, Section, TopicShell } from '@/components/topics/blocks'
import { CatalogNote, CourseGrid } from '@/components/ai-courses/blocks'
import { LevelFinder } from '@/components/ai-courses/LevelFinder'
import { canonical } from '@/lib/seo/canonical'
import { titleMeta } from '@/lib/seo/title'
import { getPublicCatalog } from '@/lib/learning/public-catalog'
import { LEVELS, catalogFunctionBySlug, coursesForFunction, functionLevelPageIndexable, functionLevelPath, functionPath, levelBySlug } from '@/lib/learning/public-catalog-shared'
import { faqJsonLd, itemListJsonLd } from '@/lib/learning/public-catalog-seo'

export const dynamic = 'force-dynamic'

type P = Promise<{ function: string; level: string }>

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { function: fs, level: ls } = await params
  const f = catalogFunctionBySlug(fs)
  const l = levelBySlug(ls)
  if (!f || !l) return { title: 'AI courses', robots: { index: false, follow: true } }
  const catalog = await getPublicCatalog()
  return {
    title: titleMeta(`${l.label} AI courses for ${f.people}`),
    description: `${l.label} AI courses and certifications for ${f.people}. ${l.who}`.slice(0, 160),
    robots: { index: functionLevelPageIndexable(catalog, f.name, l.level), follow: true },
    ...canonical(functionLevelPath(f, l)),
  }
}

export default async function FunctionLevelPage({ params, searchParams }: { params: P; searchParams: Promise<{ confirmed?: string }> }) {
  const { function: fs, level: ls } = await params
  const f = catalogFunctionBySlug(fs)
  const l = levelBySlug(ls)
  if (!f) redirect('/ai-courses')
  if (!l) redirect(functionPath(f))
  const confirmed = (await searchParams).confirmed === '1'
  const catalog = await getPublicCatalog()
  const specific = coursesForFunction(catalog, f.name, { level: l.level })
  const general = coursesForFunction(catalog, f.name, { withGeneral: true, level: l.level }).filter((c) => c.functions.length === 0)
  const faq = [
    { q: `Who are ${l.label.toLowerCase()} AI courses for?`, a: l.who },
    { q: `What do I need before I start?`, a: l.before },
  ]
  return (
    <TopicShell
      trail={[{ name: 'AI courses', path: '/ai-courses' }, { name: f.name, path: functionPath(f) }, { name: l.label, path: functionLevelPath(f, l) }]}
      title={`${l.label} AI courses for ${f.people}`}
      intro={`${l.who} ${specific.length > 0 ? `${specific.length} ${specific.length === 1 ? 'course is' : 'courses are'} written for ${f.people} at this level.` : `No course is written for ${f.people} at this level yet, so the general ${l.label.toLowerCase()} courses below are the best start.`}`}
      jsonLd={[itemListJsonLd(`${l.label} AI courses for ${f.people}`, functionLevelPath(f, l), [...specific, ...general]), faqJsonLd(faq)]}
    >
      {confirmed && <p role="status" className="mt-6 rounded-lg border border-border bg-white p-4 text-sm text-navy">You are confirmed. This is your course path; bookmark it.</p>}
      {specific.length > 0 && (
        <Section id="specific" title={`Written for ${f.people}`}>
          <CourseGrid courses={specific} source={`ai_courses_${f.slug}_${l.slug}`} />
        </Section>
      )}
      <Section id="general" title={`General ${l.label.toLowerCase()} AI courses`} note="These fit any role.">
        <CourseGrid courses={general} source={`ai_courses_${f.slug}_${l.slug}_general`} />
        <CatalogNote />
      </Section>
      <p className="mt-6 text-sm">
        Other levels for {f.people}:{' '}
        {LEVELS.filter((x) => x.slug !== l.slug).map((x, i) => (
          <span key={x.slug}>{i > 0 && ', '}<Link href={functionLevelPath(f, x)} className="text-brand underline underline-offset-4">{x.label}</Link></span>
        ))}
        {' · '}<Link href={functionPath(f)} className="text-brand underline underline-offset-4">All levels</Link>
      </p>
      <div className="mt-10"><LevelFinder source={`ai_courses_${f.slug}_${l.slug}`} defaultFunction={f.slug} /></div>
      <JoinBand source={`ai_courses_${f.slug}_${l.slug}`} what={`which AI skills ${f.name.toLowerCase()} jobs ask for and which courses close your gap`} />
    </TopicShell>
  )
}
