import 'server-only'
import type { ReferenceType } from '@prisma/client'

// Reference Check Part C — the rotating written-question pool (Assessment
// Layer spec §5.5). Position 1 (the first reference invited) always gets
// w11 (ties to Track Record verification, once that exists) + w1 (the
// general "describe a specific situation" question). Every reference after
// that gets one relationship-specific question, cycling within their type,
// plus one general question not yet used by an earlier reference in this
// same candidate's set. Assignment happens once at invite time and is
// never recomputed, so it stays stable across sessions even if a later
// reference is added or an earlier one is removed.

export interface WrittenQuestion {
  key: string
  text: string
  relationship?: 'manager' | 'peer' | 'report' | 'client'
}

const GENERAL_POOL: WrittenQuestion[] = [
  { key: 'w1', text: "Describe one specific situation that shows how they operate — what was happening, what they did, what happened next." },
  { key: 'w2', text: 'Would you work with them again, in what kind of role — and what would you not put them in charge of?' },
  { key: 'w3', text: "What's the job they'd be excellent at that they probably aren't applying for?" },
]

const RELATIONSHIP_POOL: Record<'manager' | 'peer' | 'report' | 'client', WrittenQuestion[]> = {
  manager: [
    { key: 'w4', text: 'What did you have to coach them on?', relationship: 'manager' },
    { key: 'w5', text: 'What would you have promoted them into, and what were they not ready for?', relationship: 'manager' },
  ],
  peer: [
    { key: 'w6', text: "When you needed something from them and it wasn't their priority, what happened?", relationship: 'peer' },
    { key: 'w7', text: "What do they do well that people above them probably don't see?", relationship: 'peer' },
  ],
  report: [
    { key: 'w8', text: 'What did they do for your development, specifically?', relationship: 'report' },
    { key: 'w9', text: 'When did they get in your way?', relationship: 'report' },
  ],
  client: [
    { key: 'w10', text: 'When something went wrong on their side, how did they handle it?', relationship: 'client' },
  ],
}

// Position 1's guaranteed opener — verification-tied, so it always goes to
// the first reference invited regardless of relationship type.
const W11: WrittenQuestion = {
  key: 'w11',
  text: 'The candidate described a specific accomplishment they said you could confirm. What can you confirm, add, or correct?',
}

function relationshipBucket(type: ReferenceType): 'manager' | 'peer' | 'report' | 'client' {
  switch (type) {
    case 'DIRECT_MANAGER':
    case 'SKIP_LEVEL_MANAGER':
      return 'manager'
    case 'PEER':
    case 'FACULTY_ADVISOR':
      return 'peer'
    case 'DIRECT_REPORT':
      return 'report'
    case 'CLIENT':
    case 'VENDOR':
      return 'client'
    default:
      return 'peer'
  }
}

// usedKeys = every w-key already assigned to an earlier reference in this
// candidate's set (query the DB for existing writtenQuestion1Key/2Key
// values before calling this for a new invite).
export function assignWrittenQuestions(
  inviteSequence: number,
  relationshipType: ReferenceType,
  usedKeys: Set<string>
): [WrittenQuestion, WrittenQuestion] {
  if (inviteSequence === 1) {
    return [W11, GENERAL_POOL[0]]
  }

  const bucket = relationshipBucket(relationshipType)
  const relationshipOptions = RELATIONSHIP_POOL[bucket]
  const relationshipQuestion =
    relationshipOptions.find((q) => !usedKeys.has(q.key)) ??
    relationshipOptions[(inviteSequence - 1) % relationshipOptions.length]

  const generalQuestion =
    GENERAL_POOL.slice(1).find((q) => !usedKeys.has(q.key)) ??
    GENERAL_POOL[1 + ((inviteSequence - 2) % (GENERAL_POOL.length - 1))]

  return [relationshipQuestion, generalQuestion]
}
