import 'server-only'
import { prisma } from '@/lib/prisma'
import { getDossierSections } from '@/lib/reports/dossier-sections'

// §A8 item 1 / §E4.1 — "Dossier view scoped to submitted candidates only,"
// reusing the branded-packet ALLOWLIST pattern from Phase 6
// (submission-packet.ts's own header comment explains the discipline this
// mirrors): every field below is individually assigned from a known-safe
// source — getDossierSections()'s DossierData (already documented there as
// excluding grade/detection/motivation/blocker data) or a narrow, explicitly
// `select`ed CandidateProfile query. Nothing here spreads a whole
// candidate row, so a future CandidateProfile field can't silently reach a
// hiring manager's screen just by existing.
export interface HiringDossierView {
  candidateName: string
  candidateTargetTitle: string | null
  candidateLocation: string | null
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
}

export async function buildHiringDossierView(candidateId: string): Promise<HiringDossierView | null> {
  const [candidate, dossier] = await Promise.all([
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { firstName: true, lastName: true, privacyTier: true, targetRoleType: true, currentCity: true, currentState: true },
    }),
    getDossierSections(candidateId),
  ])
  if (!candidate) return null
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
    positioningStatement: dossier.positioning.approvedText,
    categoryStrengths: dossier.categoryStrengths.map((s) => ({ label: s.label, text: s.text })),
    howIOperateSummaries: dossier.howIOperate.dimensionSummaries,
    superpowers: dossier.howIOperate.superpowers.map((s) => ({ label: s.label, referenceConfirmed: s.referenceConfirmed })),
    impactQuotes: dossier.impactOnPeople.quotes,
    selfAwareness: dossier.selfAwareness.approvedText,
    learningGrowthItems: dossier.learningGrowth.items.map((i) => i.title),
    fitSummary: dossier.fit.patternSummary,
    targetPreferenceLines,
    proofPoints: dossier.proofPoints.map((p) => ({ question: p.question, response: p.response })),
    referenceCount: dossier.verification.referenceCount,
    hiringManagerCallAvailableCount: dossier.verification.hiringManagerCallAvailableCount,
  }
}
