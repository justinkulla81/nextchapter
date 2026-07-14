import type { CandidateProfile, Reference, WorkSample, Resume, CommunityPost } from '@prisma/client'
import { markNetworkingListSubmitted } from '@/app/dashboard/actions'

export interface SetupChecklistItem {
  key: string
  label: string
  completed: boolean
  ctaLabel: string
  href?: string // navigate to another page
  action?: () => Promise<void> // or complete inline via a server action (mutually exclusive with href)
}

type ChecklistCandidate = CandidateProfile & {
  references: Reference[]
  workSamples: WorkSample[]
  resumes: Resume[]
  communityPosts: CommunityPost[]
}

// Fixed order, not sorted by point value like scoreToNextSteps — this is a
// persistent checklist for optional site sections, not a rotating top-3 of
// score-boosting actions. See src/components/dashboard/SetupChecklist.tsx.
export function getSetupChecklistItems(candidate: ChecklistCandidate): SetupChecklistItem[] {
  return [
    {
      key: 'make-profile-public',
      label: 'Make your profile Public or Semi-Public',
      completed: candidate.privacyTier === 'PUBLIC' || candidate.privacyTier === 'SEMI_PUBLIC',
      href: '/dashboard/privacy',
      ctaLabel: 'Update privacy',
    },
    {
      key: 'request-references',
      label: 'Request references',
      completed: candidate.references.some((r) => r.status === 'COMPLETED'),
      href: '/dashboard/references',
      ctaLabel: 'Request references',
    },
    {
      key: 'upload-work-sample',
      label: 'Upload a work sample',
      completed: candidate.workSamples.length > 0,
      href: '/dashboard/work-samples',
      ctaLabel: 'Upload a sample',
    },
    {
      key: 'upload-resume',
      label: 'Upload your resume',
      completed: candidate.resumes.length > 0,
      href: '/dashboard/resume',
      ctaLabel: 'Upload resume',
    },
    {
      key: 'first-community-post',
      label: 'Make your first Community Board post',
      completed: candidate.communityPosts.length > 0,
      href: '/dashboard/community',
      ctaLabel: 'Visit Community Board',
    },
    {
      key: 'networking-list',
      label: 'Build a list of 25 people you know and can network with',
      completed: candidate.networkingListSubmittedAt !== null,
      action: markNetworkingListSubmitted,
      ctaLabel: 'Mark complete',
    },
  ]
}
