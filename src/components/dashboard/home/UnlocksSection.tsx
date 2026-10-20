import type { CandidateProfile } from '@prisma/client'
import { computeDossierCompleteness, getDossierLadderTier, getModuleGateStatus, isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { buildUnlockLadder, type RungKey } from '@/lib/unlocks/ladder'
import { timed } from '@/lib/perf/timed'
import { UnlocksModule } from '@/components/dashboard/home/UnlocksModule'

// The dossier is open from day one, so the redesign shows only what recruiters add: Candidate+ and what follows.
const SKIP_IN_REDESIGN: RungKey[] = ['community', 'taking_shape']

/** The dossier and the unlock ladder, with the member's own numbers. Wrap in Suspense. */
export async function UnlocksSection({ profile, redesign = false }: { profile: Pick<CandidateProfile, 'id' | 'confidentialSearchMode'>; redesign?: boolean }) {
  const [dossierCompleteness, dossierStatus, ladderTier, moduleGates] = await Promise.all([
    timed('home', 'dossierCompleteness', profile.id, computeDossierCompleteness(profile.id)),
    timed('home', 'dossierUnlocked', profile.id, isDossierUnlocked(profile.id)),
    timed('home', 'ladderTier', profile.id, getDossierLadderTier(profile.id)),
    timed('home', 'moduleGates', profile.id, getModuleGateStatus(profile.id)),
  ])
  const ladder = buildUnlockLadder({ gates: moduleGates, tier: ladderTier.tier, completeness: dossierCompleteness, status: dossierStatus, ...(redesign ? { skip: SKIP_IN_REDESIGN } : {}) })
  const evidenceAreas = dossierCompleteness.requirements.filter((r) => r.met).length
  return <UnlocksModule ladder={ladder} evidenceAreas={evidenceAreas} evidenceTotal={dossierCompleteness.totalCount} confidential={profile.confidentialSearchMode} />
}
