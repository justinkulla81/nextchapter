import 'server-only'
import { prisma } from '@/lib/prisma'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { isSearchStrategyWizardComplete } from '@/lib/search-strategy'

// Called from the end of every one of the 7 Search Strategy save actions —
// none of them award their own points anymore (see the removed
// autoCompleteEngagementAction calls in search-strategy/actions.ts and
// complete-profile/actions.ts's answerBenefitsPriorities). This is the one
// place SEARCH_STRATEGY_COMPLETE gets credited, the first time all 7 pages
// are done, regardless of which page's save happened to be the one that
// finished the set.
export async function maybeAwardSearchStrategyCompleteBonus(candidateId: string): Promise<void> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: {
      searchStrategyCompleteBonusAt: true,
      networkingLevel: true,
      learnedNewSkillsLevel: true,
      triedPartTimeOrConsulting: true,
      triedExecutiveCoaching: true,
      connectedWithRecruiters: true,
      targetRoleType: true,
      primaryFunction: true,
      targetIndustries: true,
      targetCompanySize: true,
      targetCompanyStage: true,
      remotePreference: true,
      highestLevelReached: true,
      blockers: true,
      motivations: true,
      coachingStylePreference: true,
      changePacePreference: true,
      changeReadiness: true,
      publicDisclosureComfort: true,
      contentComfortLevel: true,
      contentVenues: true,
      linkedinOpennessComfort: true,
      linkedinUsageFrequency: true,
      linkedinProfileUpToDate: true,
      networkComfortLevel: true,
      networkingOutreachTargetPerWeek: true,
      negotiationComfort: true,
      interviewComfort: true,
      benefitsPrioritiesBonusAt: true,
    },
  })
  if (!profile || profile.searchStrategyCompleteBonusAt) return
  if (!isSearchStrategyWizardComplete(profile)) return

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { searchStrategyCompleteBonusAt: new Date() },
  })
  const sprint = await getCurrentWeekSprint(candidateId)
  if (sprint) {
    const effort = estimateActionEffort({ actionType: 'SEARCH_STRATEGY_COMPLETE' })
    await autoCompleteEngagementAction(candidateId, {
      actionType: 'SEARCH_STRATEGY_COMPLETE',
      text: 'Complete your Search Strategy',
      points: effort.points,
      estimatedMinutes: effort.minutes,
    })
  }
}
