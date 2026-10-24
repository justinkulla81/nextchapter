import 'server-only'
import { prisma } from '@/lib/prisma'
import { coursesForTopics, type AcceptedTopic } from '@/lib/coach/accepted-topics-match'
import { firstNameOf } from '@/lib/coach/session-notes'

// The one place accepted coach topics are read. A topic is "accepted" when the member pressed Accept on a topic
// their coach confirmed (CoachSessionTopic.status = 'accepted'); dismissing it later removes it from this list on
// the next read, so accepting and dismissing both take effect immediately and nothing is cached.
//
// Readers today: the learning plan (src/lib/learning/build-learning-plan.ts adds a "From your coach" section).
// Jobs and Network do not read these yet, which is why src/lib/coach/topics.ts only offers topics that change
// the Learn page. A new reader calls getAcceptedTopics(candidateId) and uses `key` (the controlled vocabulary).

export async function getAcceptedTopics(candidateId: string): Promise<AcceptedTopic[]> {
  try {
    const rows = await prisma.coachSessionTopic.findMany({
      where: { candidateId, status: 'accepted' },
      orderBy: { acceptedAt: 'desc' },
      select: { topic: true, acceptedAt: true, session: { select: { coach: { select: { fullName: true } } } } },
    })
    const seen = new Set<string>()
    const out: AcceptedTopic[] = []
    for (const r of rows) {
      if (seen.has(r.topic)) continue
      seen.add(r.topic)
      out.push({ key: r.topic, coachFirstName: firstNameOf(r.session.coach.fullName) })
    }
    return out
  } catch (error) {
    // The table may not exist yet; recommendations must still load without it.
    console.error('Failed to read accepted coach topics:', error)
    return []
  }
}

export { coursesForTopics }
