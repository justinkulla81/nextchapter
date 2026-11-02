import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { JoinBand, Section, TopicShell } from '@/components/topics/blocks'
import { CatalogNote, CourseGrid } from '@/components/ai-courses/blocks'
import { canonical } from '@/lib/seo/canonical'
import { titleMeta } from '@/lib/seo/title'
import { getPublicCatalog } from '@/lib/learning/public-catalog'
import { sponsorCourses, sponsorPageIndexable } from '@/lib/learning/public-catalog-shared'
import { itemListJsonLd } from '@/lib/learning/public-catalog-seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ sponsor: string }> }): Promise<Metadata> {
  const slug = (await params).sponsor
  const catalog = await getPublicCatalog()
  const courses = sponsorCourses(catalog, slug)
  if (courses.length === 0) return { title: 'AI courses', robots: { index: false, follow: true } }
  const name = courses[0].sponsor
  return {
    title: titleMeta(`${name} AI courses by level`),
    description: `${courses.length} AI courses from ${name}, sorted from beginner to advanced, with the profession each is written for.`,
    robots: { index: sponsorPageIndexable(catalog, slug), follow: true },
    ...canonical(`/ai-courses/from/${slug}`),
  }
}

export default async function SponsorPage({ params }: { params: Promise<{ sponsor: string }> }) {
  const slug = (await params).sponsor
  const courses = sponsorCourses(await getPublicCatalog(), slug)
  if (courses.length === 0) redirect('/ai-courses')
  const name = courses[0].sponsor
  const path = `/ai-courses/from/${slug}`
  return (
    <TopicShell
      trail={[{ name: 'AI courses', path: '/ai-courses' }, { name, path }]}
      title={`${name} AI courses`}
      intro={`${courses.length} ${courses.length === 1 ? 'course' : 'courses'} from ${name}, beginner first.`}
      jsonLd={[itemListJsonLd(`${name} AI courses`, path, courses)]}
    >
      <Section id="courses" title={`All ${name} courses`}>
        <CourseGrid courses={courses} source={`ai_courses_from_${slug}`} />
        <CatalogNote />
      </Section>
      <JoinBand source={`ai_courses_from_${slug}`} what="which AI skills your target jobs ask for and which courses close your gap" />
    </TopicShell>
  )
}
