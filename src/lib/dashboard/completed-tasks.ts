import type { CandidateProfile, Reference, WorkSample, Resume, CommunityPost } from '@prisma/client'

export const TASKS_REQUIRED_TO_REGENERATE_REPORT = 10

type ProfileWithActivity = CandidateProfile & {
  resumes: Resume[]
  workSamples: WorkSample[]
  references: Reference[]
  communityPosts: CommunityPost[]
}

// "Tasks" = action-plan checklist items confirmed, plus concrete profile-
// building activity — everything already tracked on CandidateProfile and its
// relations, so this needs no new schema. Salary + work authorization share
// one confirmation form, so they only count once (matches ActionPlanCard's
// salaryAndWorkAuthDone).
export function countCompletedTasks(profile: ProfileWithActivity): number {
  const checklistFlags = [
    profile.profileConfirmedAt !== null,
    profile.industryConfirmedAt !== null,
    profile.functionConfirmedAt !== null,
    profile.salaryConfirmedAt !== null && profile.workAuthConfirmedAt !== null,
    profile.networkingListSubmittedAt !== null,
    profile.askedForHelpAt !== null,
    profile.linkedInConfirmedAt !== null,
  ].filter(Boolean).length

  const activityCounts =
    profile.resumes.length +
    profile.workSamples.length +
    profile.references.length +
    profile.communityPosts.length

  return checklistFlags + activityCounts
}
