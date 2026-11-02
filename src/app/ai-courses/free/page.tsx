import type { Metadata } from 'next'
import { JoinBand, Section, TopicShell } from '@/components/topics/blocks'
import { CatalogNote, CourseGrid } from '@/components/ai-courses/blocks'
import { LevelFinder } from '@/components/ai-courses/LevelFinder'
import { canonical } from '@/lib/seo/canonical'
import { titleMeta } from '@/lib/seo/title'
import { getPublicCatalog } from '@/lib/learning/public-catalog'
import { freePath, sortByLevel } from '@/lib/learning/public-catalog-shared'
import { itemListJsonLd } from '@/lib/learning/public-catalog-seo'

export const dynamic = 'force-dynamic'

const TITLE = 'Free AI courses by level and profession'
export const metadata: Metadata = {
  title: titleMeta(TITLE),
  description: 'AI courses marked free by their providers, sorted from beginner to advanced, for finance, legal, HR, marketing, sales and more. Confirm cost on the provider\'s page.',
  ...canonical(freePath()),
}

export default async function FreeCoursesPage() {
  const courses = sortByLevel((await getPublicCatalog()).filter((c) => c.free))
  return (
    <TopicShell
      trail={[{ name: 'AI courses', path: '/ai-courses' }, { name: 'Free', path: freePath() }]}
      title="Free AI courses"
      intro={`${courses.length} AI courses their providers offer at no cost, beginner first. Free offers can change, so confirm on the provider's page before you start.`}
      jsonLd={[itemListJsonLd(TITLE, freePath(), courses)]}
    >
      <Section id="courses" title="Free courses, beginner first">
        <CourseGrid courses={courses} source="ai_courses_free" />
        <CatalogNote />
      </Section>
      <div className="mt-12"><LevelFinder source="ai_courses_free" /></div>
      <JoinBand source="ai_courses_free" what="which AI skills your target jobs ask for and which courses close your gap" />
    </TopicShell>
  )
}
