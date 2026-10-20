import { NewHome } from '@/components/home/NewHome'
import { StructuredData } from '@/components/StructuredData'
import { canonical } from '@/lib/seo/canonical'
import { organizationJsonLd, organizationRef } from '@/lib/seo/jsonld'

// The page is static: the news feed and newsletter moved off the homepage (see /news).
export const revalidate = 300

export const metadata = canonical('/')

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'NextChapter',
  url: 'https://launchyournextchapter.com',
  description:
    'A resume is the least complete thing about you. NextChapter, the leading job transition platform, turns a job search into verified evidence — a Market Reality Assessment, a Resume Studio, and an Executive Dossier corroborated by the people who worked with you. Free for candidates, always.',
  publisher: organizationRef(),
}

export default function Home() {
  return (
    <>
      <StructuredData data={jsonLd} />
      <StructuredData data={organizationJsonLd()} />
      <NewHome />
    </>
  )
}
