import type { CandidateProfile } from '@prisma/client'
import { computeDossierCompleteness, getDossierLadderTier, getModuleGateStatus, isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { buildUnlockLadder } from '@/lib/unlocks/ladder'
import { timed } from '@/lib/perf/timed'
import { UnlocksModule } from '@/components/dashboard/home/UnlocksModule'

/** The dossier and the unlock ladder, with the member's own numbers. Wrap in Suspense. */
export async function UnlocksSection({ profile }: { profile: Pick<CandidateProfile, 'id' | 'confidentialSearchMode'> }) {
  const [dossierCompleteness, dossierStatus, ladderTier, moduleGates] = await Promise.all([
    timed('home', 'dossierCompleteness', profile.id, computeDossierCompleteness(profile.id)),
    timed('home', 'dossierUnlocked', profile.id, isDossierUnlocked(profile.id)),
    timed('home', 'ladderTier', profile.id, getDossierLadderTier(profile.id)),
    timed('home', 'moduleGates', profile.id, getModuleGateStatus(profile.id)),
  ])
  const ladder = buildUnlockLadder({ gates: moduleGates, tier: ladderTier.tier, completeness: dossierCompleteness, status: dossierStatus })
  const evidenceAreas = dossierCompleteness.requirements.filter((r) => r.met).length
  return <UnlocksModule ladder={ladder} evidenceAreas={evidenceAreas} evidenceTotal={dossierCompleteness.totalCount} confidential={profile.confidentialSearchMode} />
}
