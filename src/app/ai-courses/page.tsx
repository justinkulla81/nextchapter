import type { Metadata } from 'next'
import Link from 'next/link'
import { Chips, JoinBand, Section, TopicShell } from '@/components/topics/blocks'
import { CatalogNote, CourseGrid } from '@/components/ai-courses/blocks'
import { LevelFinder } from '@/components/ai-courses/LevelFinder'
import { canonical } from '@/lib/seo/canonical'
import { titleMeta } from '@/lib/seo/title'
import { getPublicCatalog } from '@/lib/learning/public-catalog'
import { CATALOG_FUNCTIONS, LEVELS, coursesForFunction, freePath, functionPath, levelPath, sortByLevel, sponsorPageIndexable, sponsorPath, sponsorSlug } from '@/lib/learning/public-catalog-shared'
import { GENERAL_FAQ, faqJsonLd, itemListJsonLd } from '@/lib/learning/public-catalog-seo'

export const dynamic = 'force-dynamic'

const TITLE = 'AI courses by level and profession'
const DESCRIPTION = 'Free and paid AI courses for finance, legal, HR, marketing, sales, operations and more, sorted by level from beginner to advanced. Find yours in a minute.'

export const metadata: Metadata = { title: titleMeta(TITLE), description: DESCRIPTION, ...canonical('/ai-courses') }

export default async function AiCoursesHub() {
  const catalog = await getPublicCatalog()
  const all = sortByLevel(catalog)
  const free = catalog.filter((c) => c.free).length
  const sponsors = [...new Map(catalog.map((c) => [sponsorSlug(c.sponsor), c.sponsor])).entries()]
    .filter(([slug]) => sponsorPageIndexable(catalog, slug))
    .map(([, name]) => ({ href: sponsorPath(name), label: name, detail: String(catalog.filter((c) => c.sponsor === name).length) }))
    .sort((a, b) => Number(b.detail) - Number(a.detail))
  return (
    <TopicShell
      trail={[{ name: 'AI courses', path: '/ai-courses' }]}
      title="AI courses for working professionals, by level and profession"
      intro={`${catalog.length} AI courses and certifications from Google, Microsoft, Anthropic, universities and more, ${free} of them free. Pick your AI level, then your profession, and start with the course that fits your work.`}
      jsonLd={[itemListJsonLd(TITLE, '/ai-courses', all), faqJsonLd(GENERAL_FAQ)]}
    >
      <div className="mt-8"><LevelFinder source="ai_courses_hub" /></div>

      <Section id="levels" title="Start with your AI level" note="Three levels, based on what you already do with AI, not on what you know.">
        <div className="grid gap-4 sm:grid-cols-3">
          {LEVELS.map((l) => (
            <Link key={l.slug} href={levelPath(l)} className="rounded-xl border border-border bg-white p-5 hover:border-navy">
              <p className="text-lg font-semibold text-navy">{l.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{l.who}</p>
              <p className="mt-3 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Start with:</span> {l.before}</p>
              <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground">You will be able to:</span> {l.after}</p>
              <p className="mt-3 text-sm font-medium text-brand">{catalog.filter((c) => c.level === l.level).length} courses</p>
            </Link>
          ))}
        </div>
      </Section>

      <Section id="functions" title="Find courses for your profession" note="Courses written for a specific job come first, then general AI courses that fit any role.">
        <Chips
          kind="ai_courses_function"
          event="ai_courses_link_clicked"
          items={CATALOG_FUNCTIONS.map((f) => ({ href: functionPath(f), label: f.name, detail: String(coursesForFunction(catalog, f.name).length) }))}
        />
        <p className="mt-4 text-sm"><Link href={freePath()} className="text-brand underline underline-offset-4">Only the {free} free courses</Link></p>
      </Section>

      <Section id="all" title="Every course, beginner first">
        <CourseGrid courses={all} source="ai_courses_hub" />
        <CatalogNote />
      </Section>

      {sponsors.length > 0 && (
        <Section id="providers" title="Courses by provider">
          <Chips kind="ai_courses_sponsor" event="ai_courses_link_clicked" items={sponsors} />
        </Section>
      )}

      <Section id="faq" title="Questions people ask">
        <dl className="space-y-4">
          {GENERAL_FAQ.map((f) => (
            <div key={f.q}>
              <dt className="text-sm font-semibold text-navy">{f.q}</dt>
              <dd className="mt-1 max-w-3xl text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <JoinBand source="ai_courses_hub" what="which AI skills your target jobs ask for and which courses close your gap" />
    </TopicShell>
  )
}
