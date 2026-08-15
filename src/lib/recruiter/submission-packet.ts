import 'server-only'
import { prisma } from '@/lib/prisma'
import { getDossierSections } from '@/lib/reports/dossier-sections'
import { isCandidateConsentedForRecruiter } from '@/lib/recruiter/introductions'

// Recruiter portal §A6.2 — "branded submission packet ... generated with
// the recruiter's own logo ... Never includes: Market Reality Grade,
// component grades, detections, badges, application history, or other
// candidates." Built as an ALLOWLIST: every field on SubmissionPacketData
// below is individually and explicitly assigned from a known-safe source —
// getDossierSections()'s DossierData (which its own header comment
// documents as already excluding grade/detection/motivation/blocker data),
// or a narrow, explicitly-`select`ed Prisma query. Nothing here ever
// spreads a whole candidate/recruiter/firm row into the packet, so a future
// field added to CandidateProfile or DossierData can't silently leak into
// this document just by existing — it has to be named on a line in this
// file to reach a recruiter's downloaded packet.
export interface SubmissionPacketData {
  candidateName: string
  candidateTargetTitle: string | null
  candidateLocation: string | null
  recruiterName: string
  recruiterEmail: string
  firmName: string | null
  firmLogoUrl: string | null
  positioningStatement: string | null
  categoryStrengths: { label: string; text: string }[]
  howIOperateSummaries: string[]
  superpowers: { label: string; referenceConfirmed: boolean }[]
  impactQuotes: { theme: string; quoteText: string; refereeName: string }[]
  selfAwareness: string | null
  learningGrowthItems: string[]
  fitSummary: string | null
  targetPreferenceLines: string[]
  proofPoints: { question: string; response: string }[]
  referenceCount: number
  hiringManagerCallAvailableCount: number
  generatedAt: Date
}

export async function buildSubmissionPacketData(
  candidateId: string,
  recruiterId: string
): Promise<SubmissionPacketData | null> {
  if (!(await isCandidateConsentedForRecruiter(candidateId, recruiterId))) return null

  const [candidate, recruiter, dossier] = await Promise.all([
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: {
        firstName: true,
        lastName: true,
        privacyTier: true,
        targetRoleType: true,
        currentCity: true,
        currentState: true,
      },
    }),
    prisma.recruiter.findUnique({
      where: { id: recruiterId },
      select: { fullName: true, workEmail: true, recruiterFirm: { select: { name: true, logoUrl: true } } },
    }),
    getDossierSections(candidateId),
  ])
  if (!candidate || !recruiter) return null
  if (candidate.privacyTier === 'LOCKED' || candidate.privacyTier === 'STEALTH') return null

  const tp = dossier.fit.targetPreferences
  const targetPreferenceLines = [
    tp.targetRoleType,
    tp.targetIndustries.length > 0 ? `Open to: ${tp.targetIndustries.join(', ')}` : null,
    [tp.companySizeLabel, tp.companyStageLabel].filter(Boolean).join(' · ') || null,
    tp.locationPreferenceLabel,
  ].filter((line): line is string => Boolean(line))

  return {
    candidateName: [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || 'Candidate',
    candidateTargetTitle: candidate.targetRoleType && candidate.targetRoleType !== 'Flexible' ? candidate.targetRoleType : null,
    candidateLocation: [candidate.currentCity, candidate.currentState].filter(Boolean).join(', ') || null,
    recruiterName: recruiter.fullName,
    recruiterEmail: recruiter.workEmail,
    firmName: recruiter.recruiterFirm?.name ?? null,
    firmLogoUrl: recruiter.recruiterFirm?.logoUrl ?? null,
    positioningStatement: dossier.positioning.approvedText,
    categoryStrengths: dossier.categoryStrengths.map((s) => ({ label: s.label, text: s.text })),
    howIOperateSummaries: dossier.howIOperate.dimensionSummaries,
    superpowers: dossier.howIOperate.superpowers.map((s) => ({
      label: s.label,
      referenceConfirmed: s.referenceConfirmed,
    })),
    impactQuotes: dossier.impactOnPeople.quotes,
    selfAwareness: dossier.selfAwareness.approvedText,
    learningGrowthItems: dossier.learningGrowth.items.map((i) => i.title),
    fitSummary: dossier.fit.patternSummary,
    targetPreferenceLines,
    proofPoints: dossier.proofPoints.map((p) => ({ question: p.question, response: p.response })),
    referenceCount: dossier.verification.referenceCount,
    hiringManagerCallAvailableCount: dossier.verification.hiringManagerCallAvailableCount,
    generatedAt: new Date(),
  }
}
