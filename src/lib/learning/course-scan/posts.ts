// Draft posts for a course the admin has added to the catalog. X text stays inside 280 characters
// (a link counts 23); LinkedIn gets the longer version. Pure; tested in src/test/course-scan.test.ts.
import { SITE_URL } from '@/lib/seo/facts'
import { LEVEL_WORD } from '@/lib/learning/course-scan/classify'
import type { CourseSkillLevel } from '@prisma/client'

export interface CourseForPost {
  title: string
  sponsor: string
  url: string
  free: boolean
  skillLevel: CourseSkillLevel
  functions: string[]
}

const audience = (fns: string[]) => (fns.length ? `${fns.join(' and ').toLowerCase()} professionals` : 'working professionals')

export function xCoursePost(c: CourseForPost): string {
  const head = `${c.free ? 'Free' : 'New'} AI course for ${audience(c.functions)}: "${c.title}" from ${c.sponsor} (${LEVEL_WORD[c.skillLevel]} level).`
  const text = `${head} ${c.url}`
  // 280 characters with the link counted as 23.
  return text.length - c.url.length + 23 <= 280 ? text : `${head.slice(0, 280 - 23 - 2)}… ${c.url}`
}

export function linkedinCoursePost(c: CourseForPost): string {
  return [
    `${c.free ? 'A free' : 'A new'} AI course for ${audience(c.functions)}: ${c.title}, from ${c.sponsor}.`,
    '',
    `We rate it ${LEVEL_WORD[c.skillLevel]} level: ${c.skillLevel === 'BEGINNER' ? 'no AI background needed' : c.skillLevel === 'INTERMEDIATE' ? 'you should already use an AI assistant day to day' : 'built for people who already work with AI tools in depth'}. The best way to show you can work with AI is to take a course in your own field and then use it on real work.`,
    '',
    c.url,
    '',
    `We add courses like this to the NextChapter Learning page, matched to your role and your AI level: ${SITE_URL}/ai-training`,
  ].join('\n')
}
