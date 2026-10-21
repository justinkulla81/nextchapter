import type { CurrentJobStatus } from '@prisma/client'
import { FindResources } from '@/components/dashboard/find/FindResources'
import { GENERAL_JOB_BOARDS, getIndustryJobBoards } from '@/lib/constants/industry-job-boards'
import { getGuidesForSlot } from '@/lib/constants/guides'
import { labelBoards } from '@/lib/jobs/find-resources'

// The redesigned Resources part, fed from the member's profile. Nothing here is fetched: boards and guides are
// constants chosen by the member's target industries and situation, so it has no loading or error state of its own.
export function FindResourcesSection({
  profile,
}: {
  profile: {
    targetIndustries: string[]
    resumeBookOptIn: boolean
    recruiterVisibilityConfirmedAt: Date | null
    recruiterDatabaseOptIn: boolean
    currentJobStatus: CurrentJobStatus | null
  }
}) {
  const boards = labelBoards(GENERAL_JOB_BOARDS, getIndustryJobBoards(profile.targetIndustries))
  return (
    <FindResources
      boards={boards}
      resumeOptedIn={profile.resumeBookOptIn}
      recruiter={{ confirmed: !!profile.recruiterVisibilityConfirmedAt, optedIn: profile.recruiterDatabaseOptIn }}
      guides={getGuidesForSlot('find-my-job', profile.currentJobStatus)}
    />
  )
}
