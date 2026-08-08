import 'server-only'
import type { ShareRecipientType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import type { HireabilityGrade } from '@/lib/scoring/grade'
import { normalizeGradeSnapshot } from '@/lib/scoring/hireability-grade'
import { sanitizeRoleTitle, selectDisplayedWorkHistory } from '@/lib/work-history/sanitize'

export type ShareStatus = 'active' | 'expired' | 'revoked' | 'not_found'

interface SharedWorkHistoryItem {
  companyName: string
  roleTitle: string
  startDate: Date
  endDate: Date | null
  isCurrent: boolean
  keyAchievement: string | null
}

interface SharedReference {
  refereeName: string
  strengthSummary: string | null
  wouldHireAgain: boolean | null
}

export interface SharedProfileView {
  status: ShareStatus
  candidateName: string
  recipientType: ShareRecipientType | null
  activeProcess: boolean
  includeExtras: string[]
  targetRoleType: string | null
  targetIndustries: string[]
  highestLevelReached: string | null
  yearsExperience: number | null
  primaryFunction: string | null
  knownFor: string | null
  coreStatement: string | null
  workHistory: SharedWorkHistoryItem[]
  resumeSignedUrl: string | null
  references: SharedReference[]
  targetCompMin: number | null
  hireabilityGrade: HireabilityGrade | null
  gapExplanation: string | null
}

const NOT_ACTIVE = (status: ShareStatus, candidateName: string): SharedProfileView => ({
  status,
  candidateName,
  recipientType: null,
  activeProcess: false,
  includeExtras: [],
  targetRoleType: null,
  targetIndustries: [],
  highestLevelReached: null,
  yearsExperience: null,
  primaryFunction: null,
  knownFor: null,
  coreStatement: null,
  workHistory: [],
  resumeSignedUrl: null,
  references: [],
  targetCompMin: null,
  hireabilityGrade: null,
  gapExplanation: null,
})

export async function getSharedProfileView(token: string): Promise<SharedProfileView> {
  const share = await prisma.profileShare.findUnique({
    where: { token },
    include: {
      candidate: {
        include: {
          workHistory: { orderBy: { startDate: 'desc' } },
          resumes: { orderBy: { uploadedAt: 'desc' }, take: 1 },
          references: { where: { status: 'COMPLETED' } },
          narratives: { orderBy: { generatedAt: 'asc' }, take: 1 },
          hireabilityReports: { orderBy: { generatedAt: 'desc' }, take: 1 },
        },
      },
    },
  })

  if (!share) return NOT_ACTIVE('not_found', 'This candidate')

  const candidate = share.candidate
  const candidateName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'This candidate'

  let status: ShareStatus = 'active'
  if (share.revokedAt) status = 'revoked'
  else if (share.expiresAt && share.expiresAt < new Date()) status = 'expired'

  // Log the attempt even on an inactive link, so the candidate can see
  // someone tried an old or revoked link.
  await prisma.profileShare.update({
    where: { id: share.id },
    data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  })

  if (status !== 'active') return NOT_ACTIVE(status, candidateName)

  const workHistory: SharedWorkHistoryItem[] = selectDisplayedWorkHistory(candidate.workHistory).map((w) => ({
    companyName: w.companyName,
    roleTitle: sanitizeRoleTitle(w.roleTitle),
    startDate: w.startDate,
    endDate: w.endDate,
    isCurrent: w.isCurrent,
    keyAchievement: w.keyAchievement,
  }))

  const base = {
    status,
    candidateName,
    recipientType: share.recipientType,
    activeProcess: share.activeProcess,
    includeExtras: share.includeExtras,
    targetRoleType: candidate.targetRoleType,
    targetIndustries: candidate.targetIndustries,
    highestLevelReached: candidate.highestLevelReached,
    yearsExperience: candidate.yearsExperience,
    primaryFunction: candidate.primaryFunction,
    knownFor: candidate.knownFor,
    coreStatement: candidate.narratives[0]?.coreStatement ?? null,
    workHistory,
  }

  const latestResume = candidate.resumes[0]
  const signResume = async (): Promise<string | null> => {
    if (!latestResume) return null
    const admin = createAdminClient()
    const { data } = await admin.storage.from('resumes').createSignedUrl(latestResume.filePath, 60 * 30)
    return data?.signedUrl ?? null
  }
  const referencesFor = (): SharedReference[] =>
    candidate.references.map((r) => ({
      refereeName: r.refereeName,
      strengthSummary: r.strengthSummary,
      wouldHireAgain: r.wouldHireAgain,
    }))

  // Hiring Manager and Recruiter views never include the Current Market Reality
  // or Current Market Reality — those stay internal-only, never shown to an
  // external viewer.
  if (share.recipientType === 'HIRING_MANAGER') {
    return {
      ...base,
      resumeSignedUrl: share.activeProcess ? await signResume() : null,
      references: share.activeProcess ? referencesFor() : [],
      targetCompMin: null,
      hireabilityGrade: null,
      gapExplanation: share.activeProcess && candidate.includeGapExplanationInDossier ? candidate.gapExplanation : null,
    }
  }

  if (share.recipientType === 'RECRUITER') {
    return {
      ...base,
      resumeSignedUrl: share.includeExtras.includes('RESUME') ? await signResume() : null,
      references: share.includeExtras.includes('REFERENCES') ? referencesFor() : [],
      targetCompMin: share.includeExtras.includes('SALARY') ? candidate.targetCompMin : null,
      hireabilityGrade: null,
      gapExplanation:
        share.includeExtras.includes('GAP_EXPLANATION') && candidate.includeGapExplanationInDossier
          ? candidate.gapExplanation
          : null,
    }
  }

  // Coach — full profile, including the Current Market Reality and Search
  // Action Grade snapshot from the most recent report. Private Victoria chat
  // history is never included.
  const latestReport = candidate.hireabilityReports[0]
  return {
    ...base,
    resumeSignedUrl: await signResume(),
    references: referencesFor(),
    targetCompMin: candidate.targetCompMin,
    hireabilityGrade: normalizeGradeSnapshot(latestReport?.hireabilityGradeAtGeneration),
    gapExplanation: candidate.gapExplanation,
  }
}
