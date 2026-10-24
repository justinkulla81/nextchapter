// The controlled vocabulary of topics a coach can confirm and a member can accept. Pure and client-safe.
//
// Every topic here changes something the member sees the moment they accept it: today that is their Learn page
// (src/lib/coach/accepted-topics.ts adds a "From your coach" section to the learning plan, matched on `keywords`).
// Topics that would only change Jobs or Network are deliberately not in the list until those pages read accepted
// topics too, so the "If you accept" line never promises more than the app does.

export interface CoachTopic {
  key: string
  /** Shown to the coach and the member. Sentence case. */
  label: string
  /** The member-facing "If you accept" line: what changes, and where. */
  effect: string
  /** Words matched (lowercase, substring) against a course's title, description and keywords. */
  keywords: readonly string[]
}

export const COACH_TOPICS: readonly CoachTopic[] = [
  { key: 'panel_interviews', label: 'Panel interview practice', effect: 'Learn: courses on panel and group interviews appear in your learning plan, with why each fits.', keywords: ['panel interview', 'group interview', 'interview'] },
  { key: 'executive_presence', label: 'Executive presence', effect: 'Learn: courses on executive presence and leading a room appear in your learning plan.', keywords: ['executive presence', 'presence', 'influence'] },
  { key: 'salary_negotiation', label: 'Negotiating pay', effect: 'Learn: courses on negotiating an offer appear in your learning plan.', keywords: ['negotiat'] },
  { key: 'public_speaking', label: 'Speaking and presenting', effect: 'Learn: courses on presenting and public speaking appear in your learning plan.', keywords: ['public speaking', 'presenting', 'presentation'] },
  { key: 'storytelling', label: 'Telling your story', effect: 'Learn: courses on career storytelling and narrative appear in your learning plan.', keywords: ['storytelling', 'narrative', 'personal brand'] },
  { key: 'ai_tools', label: 'Working with AI tools', effect: 'Learn: AI training for your level appears in your learning plan.', keywords: ['ai ', 'artificial intelligence', 'generative'] },
  { key: 'networking_skills', label: 'Networking conversations', effect: 'Learn: courses on reaching out and networking appear in your learning plan.', keywords: ['networking', 'outreach'] },
  { key: 'leadership', label: 'Leading teams', effect: 'Learn: leadership and management courses appear in your learning plan.', keywords: ['leadership', 'managing', 'management'] },
  { key: 'financial_skills', label: 'Finance skills', effect: 'Learn: finance and modeling courses appear in your learning plan.', keywords: ['financial', 'finance', 'modeling'] },
  { key: 'linkedin_profile', label: 'Your LinkedIn profile', effect: 'Learn: courses on building a strong profile appear in your learning plan.', keywords: ['linkedin', 'profile'] },
]

export const TOPIC_KEYS: readonly string[] = COACH_TOPICS.map((t) => t.key)

const BY_KEY = new Map(COACH_TOPICS.map((t) => [t.key, t]))

export function topicByKey(key: string): CoachTopic | null {
  return BY_KEY.get(key) ?? null
}

export function isTopicKey(key: string): boolean {
  return BY_KEY.has(key)
}

export type TopicStatus = 'suggested' | 'confirmed' | 'accepted' | 'dismissed'

/**
 * The topic state machine. The coach moves suggested -> confirmed (and back, before the member decides). The
 * member moves a confirmed topic to accepted or dismissed, and may change their mind later between those two.
 * Nobody can skip the coach: a suggested topic is never the member's to accept.
 */
const TRANSITIONS: Record<TopicStatus, readonly TopicStatus[]> = {
  suggested: ['confirmed'],
  confirmed: ['suggested', 'accepted', 'dismissed'],
  accepted: ['dismissed'],
  dismissed: ['accepted'],
}

export type Actor = 'coach' | 'member'

export function canMoveTopic(from: TopicStatus, to: TopicStatus, actor: Actor): boolean {
  if (!TRANSITIONS[from].includes(to)) return false
  const memberStates: TopicStatus[] = ['accepted', 'dismissed']
  if (memberStates.includes(to)) return actor === 'member'
  return actor === 'coach'
}

/** Keywords for a set of accepted topic keys, deduplicated. Unknown keys are ignored. */
export function keywordsForTopics(keys: readonly string[]): string[] {
  return Array.from(new Set(keys.flatMap((k) => topicByKey(k)?.keywords ?? [])))
}
