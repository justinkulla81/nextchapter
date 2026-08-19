import 'server-only'
import { prisma } from '@/lib/prisma'
import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'
import { RELATIONSHIP_TYPE_LABELS } from '@/lib/constants/references'
import { computeEffortSummaryLines } from '@/lib/reports/effort-summary'
import { characterSignalsUnlocked, type EvidenceType } from '@/lib/reports/evidence-type'
import { communityTierNarrative, computeCandidatePeerSupportCount } from '@/lib/reports/community-tier'
import { buildReferenceVerification, type ReferenceVerification } from '@/lib/reports/reference-verification'

// The Certified Executive Dossier (formerly "Recruiter Report") is a
// self-serve, candidate-controlled PDF handed to anyone off-platform,
// alongside a resume — never auto-sent. Deliberately template-based rather
// than LLM-generated: every line is a real, countable fact, so there's no
// hallucination risk in a document a third party reads as an attestation of
// effort. Never includes comp expectations (this document, once downloaded,
// can't be revoked the way a What They See link can) or the Market Reality
// Grade or Current Market Reality (grades never appear outside the product).

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
    relationshipLabel: string
    strengthSummary: string | null
    wouldHireAgain: boolean | null
    evidenceType: EvidenceType
  }[]
  // Real, countable backing for the document's verification mark and the
  // Strengths grid's "Confirmed" markers — see reference-verification.ts.
  verification: ReferenceVerification
  learningItems: { title: string; provider: string | null; completedAt: Date; evidenceType: EvidenceType }[]
  // AI projects — logged via the "Log an AI project" flow on the Learning
  // page — kept separate from learningItems since they carry a description
  // (what was actually built) rather than just a title/provider.
  aiProjects: {
    title: string
    toolUsed: string | null
    description: string | null
    judgmentCall: string | null
    evidenceType: EvidenceType
  }[]
  availability: {
    statusLabel: string | null
    targetRoleType: string | null
    primaryFunction: string | null
    highestLevelReached: string | null
    targetIndustries: string[]
    locationPreference: string
    evidenceType: EvidenceType
  }
  // Only populated when the candidate has both written one AND opted in via
  // includeGapExplanationInDossier — this document is self-serve/candidate-
  // controlled with no per-recipient consent step (unlike /share/[token]),
  // so that one flag is the whole gate here.
  gapExplanation: string | null
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
  const [candidate, peerSupportCount] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      include: {
        references: {
          where: {
            status: 'COMPLETED',
            // A candidate-disputed reference is held out of the Dossier until
            // resolved — see the dispute mechanism on the References page.
            OR: [{ candidateDisputedAt: null }, { disputeResolvedAt: { not: null } }],
          },
          // Only the fields this report and buildReferenceVerification
          // actually read — was pulling every Reference column.
          select: {
            status: true,
            candidateDisputedAt: true,
            disputeResolvedAt: true,
            relationshipType: true,
            completedAt: true,
            availableForHiringManagerCall: true,
            refereeName: true,
            strengthSummary: true,
            wouldHireAgain: true,
          },
        },
        // Capped — this is a lifetime achievement list that only grows;
        // 50 is far past what any real candidate has accumulated, so this
        // never trims real content, just bounds the query. Only the fields
        // actually read below, not every LearningBadge column.
        learningBadges: {
          orderBy: { completedAt: 'desc' },
          take: 50,
          select: { badgeType: true, title: true, provider: true, completedAt: true, verified: true, description: true, judgmentCall: true },
        },
        jobPostings: { select: { appliedAt: true } },
        outreachLogs: { select: { id: true } },
      },
    }),
    // Doesn't depend on the candidate query above — only needs candidateId.
    computeCandidatePeerSupportCount(candidateId),
  ])

  const candidateName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'This candidate'

  const applicationsCount = candidate.jobPostings.filter((j) => j.appliedAt !== null).length
  const outreachCount = candidate.outreachLogs.length
  const learningCount = candidate.learningBadges.length

  const effortSummaryLines = computeEffortSummaryLines({ learningCount, applicationsCount, outreachCount }).map(
    (text) => ({ text, evidenceType: 'verified_fact' as const })
  )

  const peerSupportNarrative = communityTierNarrative(peerSupportCount)
  const peerSupportLine = peerSupportNarrative
    ? {
        text: peerSupportNarrative,
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
      relationshipLabel: RELATIONSHIP_TYPE_LABELS[r.relationshipType],
      strengthSummary: signalsUnlocked ? r.strengthSummary : null,
      wouldHireAgain: r.wouldHireAgain,
      evidenceType: 'reference_verified' as const,
    })),
    verification: buildReferenceVerification(candidate.references),
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
        judgmentCall: b.judgmentCall,
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
    gapExplanation: candidate.includeGapExplanationInDossier ? candidate.gapExplanation : null,
  }
}
