import 'server-only'
import { prisma } from '@/lib/prisma'
import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'
import { computeEffortSummaryLines } from '@/lib/reports/effort-summary'
import { characterSignalsUnlocked, type EvidenceType } from '@/lib/reports/evidence-type'
import type { CommittedAction } from '@/lib/weekly/sprint'

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
  effortSummaryLines: { text: string; evidenceType: EvidenceType }[]
  // "Peer Support" — deliberately unscored (see action-effort.ts), shown as
  // its own labeled Dossier line rather than folded into effortSummaryLines,
  // which are all point-earning activity.
  peerSupportLine: { text: string; evidenceType: EvidenceType } | null
  // Character Signals — see evidence-type.ts. Below the 2-reference
  // threshold, strengthSummary is withheld (referee name + hire-again fact
  // still show, since those aren't character claims) and this is false.
  characterSignalsUnlocked: boolean
  references: {
    refereeName: string
    strengthSummary: string | null
    wouldHireAgain: boolean | null
    evidenceType: EvidenceType
  }[]
  learningItems: { title: string; provider: string | null; completedAt: Date; evidenceType: EvidenceType }[]
  // AI projects — logged via the "Log an AI project" flow on the Learning
  // page — kept separate from learningItems since they carry a description
  // (what was actually built) rather than just a title/provider.
  aiProjects: { title: string; toolUsed: string | null; description: string | null; evidenceType: EvidenceType }[]
  availability: {
    statusLabel: string | null
    targetRoleType: string | null
    primaryFunction: string | null
    highestLevelReached: string | null
    targetIndustries: string[]
    locationPreference: string
    evidenceType: EvidenceType
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
      references: {
        where: {
          status: 'COMPLETED',
          // A candidate-disputed reference is held out of the Dossier until
          // resolved — see the dispute mechanism on the References page.
          OR: [{ candidateDisputedAt: null }, { disputeResolvedAt: { not: null } }],
        },
      },
      learningBadges: { orderBy: { completedAt: 'desc' } },
      jobPostings: { select: { appliedAt: true } },
      outreachLogs: { select: { id: true } },
      weeklySprints: { select: { committedActions: true } },
      _count: { select: { encouragementNotesSent: true } },
    },
  })

  const candidateName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'This candidate'

  const applicationsCount = candidate.jobPostings.filter((j) => j.appliedAt !== null).length
  const outreachCount = candidate.outreachLogs.length
  const learningCount = candidate.learningBadges.length

  const effortSummaryLines = computeEffortSummaryLines({ learningCount, applicationsCount, outreachCount }).map(
    (text) => ({ text, evidenceType: 'verified_fact' as const })
  )

  const encouragementSentCount = candidate._count.encouragementNotesSent
  const peerSupportActionCount = candidate.weeklySprints.reduce((sum, sprint) => {
    const actions = sprint.committedActions as unknown as CommittedAction[]
    return sum + actions.filter((a) => a.completed && a.actionType === 'ENGAGE_PEER_SUPPORT').length
  }, 0)
  const peerSupportCount = encouragementSentCount + peerSupportActionCount
  const peerSupportLine =
    peerSupportCount > 0
      ? {
          text: `Substantively helped ${peerSupportCount} other job seeker${peerSupportCount === 1 ? '' : 's'} — answering questions, making introductions, or offering encouragement. Unscored by design: this earns no Search Score points, which is what makes it a genuinely voluntary signal.`,
          evidenceType: 'verified_fact' as const,
        }
      : null

  const signalsUnlocked = characterSignalsUnlocked(candidate.references.length)

  return {
    candidateName,
    generatedAt: new Date(),
    effortSummaryLines,
    peerSupportLine,
    characterSignalsUnlocked: signalsUnlocked,
    references: candidate.references.map((r) => ({
      refereeName: r.refereeName,
      strengthSummary: signalsUnlocked ? r.strengthSummary : null,
      wouldHireAgain: r.wouldHireAgain,
      evidenceType: 'reference_verified' as const,
    })),
    learningItems: candidate.learningBadges
      .filter((b) => b.badgeType !== 'ai_project')
      .map((b) => ({
        title: b.title,
        provider: b.provider,
        completedAt: b.completedAt,
        evidenceType: b.verified ? ('verified_fact' as const) : ('self_reported' as const),
      })),
    aiProjects: candidate.learningBadges
      .filter((b) => b.badgeType === 'ai_project')
      .map((b) => ({
        title: b.title,
        toolUsed: b.provider,
        description: b.description,
        evidenceType: b.verified ? ('verified_fact' as const) : ('self_reported' as const),
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
      evidenceType: 'self_reported' as const,
    },
  }
}
