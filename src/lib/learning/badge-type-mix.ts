// "Well-rounded learning" nudge for the New Skills progressive-unlock card —
// same shape as computeRequiredMix (references) / computeOutreachRelationshipMix
// (networking). Grouped into three real kinds of learning signal rather than
// exposing all 5 badgeType values directly: structured coursework,
// hands-on/applied practice, and public credibility. badgeType is a plain
// string column (see LearningBadge.badgeType), not a Prisma enum, so this
// matches on the same known string values LearningBadgeList's
// BADGE_TYPE_LABEL does.
export interface BadgeTypeMixStatus {
  hasStructuredLearning: boolean
  hasAppliedPractice: boolean
  hasPublicCredibility: boolean
  satisfied: boolean
}

const STRUCTURED_LEARNING_TYPES = ['course_completed', 'certification']
const APPLIED_PRACTICE_TYPES = ['ai_project']
const PUBLIC_CREDIBILITY_TYPES = ['conference_talk', 'published']

export function computeBadgeTypeMix(badgeTypes: string[]): BadgeTypeMixStatus {
  const hasStructuredLearning = badgeTypes.some((t) => STRUCTURED_LEARNING_TYPES.includes(t))
  const hasAppliedPractice = badgeTypes.some((t) => APPLIED_PRACTICE_TYPES.includes(t))
  const hasPublicCredibility = badgeTypes.some((t) => PUBLIC_CREDIBILITY_TYPES.includes(t))
  return {
    hasStructuredLearning,
    hasAppliedPractice,
    hasPublicCredibility,
    satisfied: hasStructuredLearning && hasAppliedPractice && hasPublicCredibility,
  }
}
