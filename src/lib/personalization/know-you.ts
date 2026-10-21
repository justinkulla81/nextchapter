import 'server-only'
import { COMMUTE_MILES } from '@/lib/jobs/relevance'
import { subFunctionLabel } from '@/lib/jobs/sub-functions'
import { CLEARANCE_LABEL, type ClearanceLevel } from '@/lib/jobs/requirements'
import type { MatchProfile, MatchState } from '@/lib/personalization/match-compute'
import type { SignalInputs } from '@/lib/personalization/signals'

/** The "What we know about you" inputs from the profile and a match run (match-compute.ts). */
export function signalInputsFor(profile: MatchProfile, state: MatchState): SignalInputs {
  const m = state.classifier.member
  const level = profile.clearanceLevel
  return {
    city: profile.currentCity?.trim() || null,
    state: profile.currentState?.trim() || null,
    cityPlaced: !!m.geo?.anchor,
    commuteMiles: COMMUTE_MILES,
    acceptsRemote: m.geo?.acceptsRemote ?? true,
    remotePreference: profile.remotePreference ?? null,
    relocationStates: m.geo ? [...m.geo.relocation] : [],
    title: profile.resumeLatestJobTitle ?? null,
    fieldLabel: subFunctionLabel(m.subFunction) ?? m.functionLabel,
    primaryFunction: profile.primaryFunction ?? null,
    toolsConfirmed: !!profile.toolsConfirmedAt,
    toolCount: profile.confirmedSkillsHave?.length ?? 0,
    industries: [...m.industries],
    clearanceLevel: level ?? null,
    clearanceLabel: level && level in CLEARANCE_LABEL ? `${CLEARANCE_LABEL[level as ClearanceLevel]} clearance` : null,
    matches: state.counts.matches,
    geoUnchecked: state.geoUnchecked,
    skillsUnchecked: state.skillsUnchecked,
    industryKnown: state.industryKnown,
    clearanceAsked: state.clearanceAsked,
    clearanceMet: state.clearanceMet,
  }
}
