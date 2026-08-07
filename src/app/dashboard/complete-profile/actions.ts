'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'

export type OptionalQuestionsState = { error?: string } | undefined

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

// The 7 optional job-search-activity fields first asked in onboarding
// (CircumstancesForm) — until now they had no way to be answered
// afterward if skipped, even though ANSWER_OPTIONAL_QUESTIONS has always
// been a real one-time Search Action. This is that missing form's action,
// mirroring updateCircumstances's parsing for the same fields exactly.
export async function answerOptionalQuestions(
  _prevState: OptionalQuestionsState,
  formData: FormData
): Promise<OptionalQuestionsState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }
  const candidateId = profile.id

  const jobsAppliedBucket = (formData.get('jobsAppliedBucket') as string) || null
  const interviewsReceivedRaw = formData.get('interviewsReceivedCount')
  const interviewsReceivedCount = interviewsReceivedRaw ? Number(interviewsReceivedRaw) : null
  const networkingLevelRaw = formData.get('networkingLevel')
  const networkingLevel = networkingLevelRaw ? Number(networkingLevelRaw) : null
  const learnedNewSkillsLevelRaw = formData.get('learnedNewSkillsLevel')
  const learnedNewSkillsLevel = learnedNewSkillsLevelRaw ? Number(learnedNewSkillsLevelRaw) : null
  const triedPartTimeOrConsultingRaw = formData.get('triedPartTimeOrConsulting') as string | null
  const triedPartTimeOrConsulting =
    triedPartTimeOrConsultingRaw === 'yes' ? true : triedPartTimeOrConsultingRaw === 'no' ? false : null
  const triedExecutiveCoachingRaw = formData.get('triedExecutiveCoaching') as string | null
  const triedExecutiveCoaching =
    triedExecutiveCoachingRaw === 'yes' ? true : triedExecutiveCoachingRaw === 'no' ? false : null
  const connectedWithRecruitersRaw = formData.get('connectedWithRecruiters') as string | null
  const connectedWithRecruiters =
    connectedWithRecruitersRaw === 'yes' ? true : connectedWithRecruitersRaw === 'no' ? false : null
  const recruiterConnectionCountRaw = formData.get('recruiterConnectionCount')
  const recruiterConnectionCount =
    connectedWithRecruiters && recruiterConnectionCountRaw ? Number(recruiterConnectionCountRaw) : null

  const allAnswered = [
    jobsAppliedBucket,
    interviewsReceivedCount,
    networkingLevel,
    learnedNewSkillsLevel,
    triedPartTimeOrConsulting,
    triedExecutiveCoaching,
    connectedWithRecruiters,
  ].every((f) => f !== null)
  if (!allAnswered) {
    return { error: 'Please answer every question — they only take a minute.' }
  }

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      jobsAppliedBucket,
      interviewsReceivedCount,
      networkingLevel,
      learnedNewSkillsLevel,
      triedPartTimeOrConsulting,
      triedExecutiveCoaching,
      connectedWithRecruiters,
      recruiterConnectionCount,
    },
  })

  revalidatePath('/dashboard/complete-profile')
  revalidatePath('/dashboard')
}
