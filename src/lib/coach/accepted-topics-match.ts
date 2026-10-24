import { topicByKey } from '@/lib/coach/topics'

// Pure matching for accepted coach topics: which courses a member's accepted topics point at. Kept free of the
// database so it is tested directly (src/test/coach-accepted-topics.test.ts).

export interface AcceptedTopic {
  /** A key of the controlled vocabulary (src/lib/coach/topics.ts). */
  key: string
  coachFirstName: string
}

interface CourseLike {
  title: string
  description: string
  keywords: string[]
}

/** Courses whose title, description or keywords contain a keyword of any accepted topic, in the courses' own order. Unknown topic keys match nothing. */
export function coursesForTopics<T extends CourseLike>(courses: T[], topics: readonly AcceptedTopic[]): T[] {
  const needles = Array.from(new Set(topics.flatMap((t) => topicByKey(t.key)?.keywords ?? [])))
  if (needles.length === 0) return []
  return courses.filter((c) => {
    const hay = [c.title, c.description, ...c.keywords].join(' ').toLowerCase()
    return needles.some((n) => hay.includes(n))
  })
}

/** The one reason shown on every course in the section: whose notes the topic came from, in plain words. */
export function coachTopicReason(topics: readonly AcceptedTopic[]): string {
  const coach = topics[0]?.coachFirstName ?? 'your coach'
  return `You accepted these topics from ${coach} after your session.`
}
