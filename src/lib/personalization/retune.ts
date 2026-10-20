import 'server-only'
import { captureServerEvent } from '@/lib/posthog/server'
import { COMMUTE_MILES } from '@/lib/jobs/relevance'
import { subFunctionLabel } from '@/lib/jobs/sub-functions'
import { skillKey } from '@/lib/profile/skill-matrix'
import { computeMatchState, type MatchProfile, type MatchState } from '@/lib/personalization/match-compute'
import { changedFields, profileFromInputs, type MatchInputs } from '@/lib/personalization/match-inputs'
import { currentMatchInputs, previousMatchInputs, recordMatchSnapshot } from '@/lib/personalization/match-snapshot'
import { diffVerdicts, isMatch, singleExclusions, topReasons, type ReasonContext, type RetuneResult, type RetuneTrigger } from '@/lib/personalization/match-verdict'
import { signalInputsFor } from '@/lib/personalization/know-you'
import { buildSignals } from '@/lib/personalization/signals'

/**
 * Re-runs the member's matching now and compares it with their matching before their last
 * change (the baseline the save kept, run against today's jobs). Everything returned is
 * computed here; nothing is estimated. Records a 'retune' snapshot and search_retuned.
 */
export async function runRetune(profile: MatchProfile, trigger: RetuneTrigger): Promise<RetuneResult | null> {
  const started = Date.now()
  const nowInputs = await currentMatchInputs(profile)
  const prev = await previousMatchInputs(profile.id, nowInputs).catch(() => null)
  const beforeProfile = prev && !prev.unchanged ? ({ ...profileFromInputs(profile, prev.inputs), socOverride: prev.inputs.soc ?? undefined } as MatchProfile) : null
  const [after, before] = await Promise.all([
    computeMatchState(profile, { live: true }),
    beforeProfile && prev ? computeMatchState(beforeProfile, { dismiss: prev.inputs.dismiss }) : Promise.resolve(null),
  ])
  if (!after) return null
  const member = after.classifier.member
  const ctx: ReasonContext = {
    city: member.geo?.anchor ? (profile.currentCity?.trim() ?? null) : null,
    commuteMiles: COMMUTE_MILES,
    fieldLabel: subFunctionLabel(member.subFunction) ?? member.functionLabel,
    industries: [...member.industries],
    newTools: before && prev ? newToolsInAdded(profile, prev.inputs, before, after) : [],
  }
  const unchanged = !!prev?.unchanged
  const reasons = before
    ? topReasons(diffVerdicts(before.verdicts, after.verdicts), ctx)
    : unchanged
      ? []
      : topReasons(singleExclusions(after.verdicts), ctx).map((r) => r.replace(' removed — ', ' left out — '))
  const notes: string[] = []
  if (trigger === 'clearance' || (prev && changedFields(prev.inputs, nowInputs).some((f) => f.startsWith('clearance')))) {
    const gained = after.clearanceMet - (before?.clearanceMet ?? 0)
    if (gained > 0) notes.push(`${gained.toLocaleString()} cleared job${gained === 1 ? '' : 's'} in your matches now show you qualify`)
    else if (after.clearanceAsked > 0 && after.clearanceMet === 0) notes.push(`${after.clearanceAsked.toLocaleString()} of your matches ask for a clearance — each card says what it needs`)
  }
  const signals = buildSignals(signalInputsFor(profile, after)).filter((s) => s.known).length
  const ms = Date.now() - started
  const prior = before ? before.counts : unchanged ? after.counts : null
  const result: RetuneResult = {
    trigger,
    before: prior ? { matches: prior.matches, strong: prior.strong } : null,
    after: { matches: after.counts.matches, strong: after.counts.strong },
    checked: after.counts.checked,
    reasons,
    signals,
    ms,
    notes,
  }
  await recordMatchSnapshot({
    candidateId: profile.id,
    kind: 'retune',
    trigger,
    inputs: nowInputs,
    state: { counts: after.counts, ms },
    detail: { before: result.before, reasons, notes, changed: prev ? changedFields(prev.inputs, nowInputs) : [] },
  })
  captureServerEvent(profile.id, 'search_retuned', {
    trigger,
    before: result.before?.matches ?? null,
    after: result.after.matches,
    beforeStrong: result.before?.strong ?? null,
    afterStrong: result.after.strong,
    checked: result.checked,
    ms,
  })
  return result
}

/** Tools the member just added that the newly matched jobs ask for, most common first. */
function newToolsInAdded(profile: MatchProfile, before: MatchInputs, beforeState: MatchState, afterState: MatchState): string[] {
  const had = new Set(((before.fields.confirmedSkillsHave as string[] | undefined) ?? []).map(skillKey))
  const added = (profile.confirmedSkillsHave ?? []).filter((t) => !had.has(skillKey(t)))
  if (added.length === 0) return []
  const tally = new Map<string, number>()
  for (const [id, v] of afterState.verdicts) {
    if (!isMatch(v) || isMatch(beforeState.verdicts.get(id))) continue
    const skills = afterState.classifier.occupations.skills.get(id) ?? []
    for (const t of added) if (skills.includes(skillKey(t))) tally.set(t, (tally.get(t) ?? 0) + 1)
  }
  return [...tally].sort((a, b) => b[1] - a[1]).map(([t]) => t)
}
