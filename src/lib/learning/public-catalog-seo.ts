// Titles, descriptions and structured data for the /ai-courses pages. Pure; tested in src/test/public-catalog.test.ts.
import { SITE_URL } from '@/lib/seo/facts'
import { coursePath, levelInfo, type PublicCourse } from '@/lib/learning/public-catalog-shared'

export function itemListJsonLd(name: string, path: string, courses: PublicCourse[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url: `${SITE_URL}${path}`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: courses.length,
      itemListElement: courses.slice(0, 50).map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}${coursePath(c)}`, name: c.title })),
    },
  }
}

export function courseJsonLd(c: PublicCourse) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: c.title,
    description: c.description,
    url: `${SITE_URL}${coursePath(c)}`,
    sameAs: c.url,
    provider: { '@type': 'Organization', name: c.sponsor },
    educationalLevel: levelInfo(c.level).label,
    isAccessibleForFree: c.free,
    inLanguage: 'en',
  }
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  }
}

/** The plain-language questions people ask before picking an AI course. Answers describe how this catalog works. */
export const GENERAL_FAQ: { q: string; a: string }[] = [
  {
    q: 'Which AI course should I take first?',
    a: 'Start at the level that matches what you already do. If you use an AI assistant most days and write your own prompts, begin at intermediate; if you have not used one for real work yet, begin at beginner. Then pick the course for your own function, because a course on your own work is the best proof you can use AI.',
  },
  {
    q: 'Are these AI courses free?',
    a: 'Many are free, and each course is marked free or "check cost". Prices and free trials are set by the provider and change, so confirm on the provider\'s page before you enroll.',
  },
  {
    q: 'How do you decide a course\'s level and function?',
    a: 'We read each course\'s own description and place it on our three-level ladder and in the functions it is written for. Providers often use their own labels or none, so treat ours as guidance. Beginner needs no earlier AI experience, intermediate assumes you already use an AI assistant at work, and advanced assumes you work with AI tools in depth.',
  },
  {
    q: 'Do I need to know how to code?',
    a: 'Mostly no. Most courses here are written for people who use AI tools in their job. A few teach how to build AI systems and do need programming; their descriptions say so, and the provider\'s page lists prerequisites.',
  },
]
