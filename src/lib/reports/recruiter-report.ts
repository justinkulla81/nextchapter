import 'server-only'
import { prisma } from '@/lib/prisma'
import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'
import { computeEffortSummaryLines } from '@/lib/reports/effort-summary'

// The Recruiter Report is a self-serve, candidate-controlled PDF handed to
// anyone off-platform, alongside a resume — never auto-sent. Deliberately
// template-based rather than LLM-generated: every line is a real, countable
// fact, so there's no hallucination risk in a document a third party reads
// as an attestation of effort. Never includes comp expectations (this
// document, once downloaded, can't be revoked the way a What They See link
// can) or the Hireability Grade (grade never appears outside the product).

export interface RecruiterReportData {
  candidateName: string
  generatedAt: Date
  effortSummaryLines: string[]
  helpfulnessLine: string | null
  references: { refereeName: string; strengthSummary: string | null; wouldHireAgain: boolean | null }[]
  learningItems: { title: string; provider: string | null; completedAt: Date }[]
  availability: {
    statusLabel: string | null
    targetRoleType: string | null
    primaryFunction: string | null
    highestLevelReached: string | null
    targetIndustries: string[]
    locationPreference: string
  }
}

function locationPreferenceLabel(
  remotePreference: string | null,
  openToRelocation: boolean,
  currentCity: string | null,
  currentState: string | null
): string {
  const location = [currentCity, currentState].filter(Boolean).join(', ')
  const base =
    remotePreference === 'remote'
      ? 'Open to remote'
      : remotePreference === 'hybrid'
        ? 'Open to hybrid'
        : remotePreference === 'onsite'
          ? 'Open to on-site'
          : 'Flexible on work arrangement'
  const relocation = openToRelocation ? ', open to relocation' : ''
  return location ? `${base}${relocation} — based in ${location}` : `${base}${relocation}`
}

export async function getRecruiterReportData(candidateId: string): Promise<RecruiterReportData> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: {
      references: { where: { status: 'COMPLETED' } },
      learningBadges: { orderBy: { completedAt: 'desc' } },
      jobPostings: { select: { appliedAt: true } },
      outreachLogs: { select: { id: true } },
      _count: { select: { encouragementNotesSent: true } },
    },
  })

  const candidateName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'This candidate'

  const applicationsCount = candidate.jobPostings.filter((j) => j.appliedAt !== null).length
  const outreachCount = candidate.outreachLogs.length
  const learningCount = candidate.learningBadges.length

  const effortSummaryLines = computeEffortSummaryLines({ learningCount, applicationsCount, outreachCount })

  const encouragementSentCount = candidate._count.encouragementNotesSent
  const helpfulnessLine =
    encouragementSentCount > 0
      ? `Sent ${encouragementSentCount} encouragement note${encouragementSentCount === 1 ? '' : 's'} to other job seekers in the community.`
      : null

  return {
    candidateName,
    generatedAt: new Date(),
    effortSummaryLines,
    helpfulnessLine,
    references: candidate.references.map((r) => ({
      refereeName: r.refereeName,
      strengthSummary: r.strengthSummary,
      wouldHireAgain: r.wouldHireAgain,
    })),
    learningItems: candidate.learningBadges.map((b) => ({
      title: b.title,
      provider: b.provider,
      completedAt: b.completedAt,
    })),
    availability: {
      statusLabel: candidate.currentJobStatus ? CURRENT_JOB_STATUS_LABELS[candidate.currentJobStatus] : null,
      targetRoleType: candidate.targetRoleType,
      primaryFunction: candidate.primaryFunction,
      highestLevelReached: candidate.highestLevelReached,
      targetIndustries: candidate.targetIndustries,
      locationPreference: locationPreferenceLabel(
        candidate.remotePreference,
        candidate.openToRelocation,
        candidate.currentCity,
        candidate.currentState
      ),
    },
  }
}
