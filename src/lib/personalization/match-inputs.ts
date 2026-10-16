// The profile fields a member's job matching reads (relevance.ts, search-breadth*.ts, the fit
// scorer, requirements.ts, dismiss rules), kept as JSON in MemberMatchSnapshot.inputs. A
// retune's "before" is these inputs run against today's jobs, so before and after are
// measured on the same board (match-compute.ts). Pure: src/test/personalization.test.ts.

/** Profile columns matching reads. Anything else on the profile never changes a match. */
export const MATCH_INPUT_FIELDS = [
  'primaryFunction', 'secondaryFunction', 'targetFunction', 'highestLevelReached', 'levelRankScore', 'yearsExperience',
  'isPivoting', 'resumeLatestJobTitle', 'remotePreference', 'currentCity', 'currentState', 'openToRelocation',
  'relocationNotes', 'maxTravelPct', 'travelWillingness', 'targetCompMin', 'compFlexible', 'targetRoleType',
  'resumeKeywords', 'confirmedSkillsHave', 'certifications', 'skillLevels', 'industryContext', 'secondaryIndustryContext',
  'targetIndustries', 'industryBuckets', 'hasJD', 'hasMD', 'hasDO', 'targetCompanySize', 'priorityMaxComp',
  'priorityWorkLife', 'priorityBrandName', 'priorityMission', 'searchExpansion', 'clearanceLevel', 'clearanceActive',
  'clearancePolygraph', 'licensesHeld', 'licensesAnsweredAt', 'workAuthorization', 'toolsConfirmedAt',
  'hiddenEmployerSectors', 'searchStrategyConfirmedAt', 'onboardingLocationConfirmedAt',
] as const
export type MatchInputField = (typeof MATCH_INPUT_FIELDS)[number]

/** A dismiss preference as the snapshot keeps it (job-dismiss.ts ActivePreference, without ids). */
export interface SnapshotPreference {
  kind: string
  value: string
  label: string
  action: string
  count: number
}

export interface MatchInputs {
  fields: Partial<Record<MatchInputField, unknown>>
  /** Active dismiss preferences (job-dismiss.ts). */
  dismiss: SnapshotPreference[]
  /** The member's O*NET occupation when the inputs were taken (it is resolved from the title in the database). */
  soc: string | null
}

const isDateField = (k: string) => k.endsWith('At')

/** The inputs a profile gives, as JSON-safe values (dates as ISO strings). */
export function matchInputsOf(profile: Record<string, unknown>, dismiss: SnapshotPreference[] = [], soc: string | null = null): MatchInputs {
  const fields: Partial<Record<MatchInputField, unknown>> = {}
  for (const k of MATCH_INPUT_FIELDS) {
    if (!(k in profile)) continue
    const v = profile[k]
    fields[k] = v instanceof Date ? v.toISOString() : (v ?? null)
  }
  const prefs = [...dismiss].map((p) => ({ kind: p.kind, value: p.value, label: p.label, action: p.action, count: p.count }))
  prefs.sort((a, b) => `${a.kind}|${a.value}`.localeCompare(`${b.kind}|${b.value}`))
  return { fields, dismiss: prefs, soc }
}

/** Do two input sets match the same jobs? (Order-insensitive for lists; counts on preferences ignored.) */
export function sameMatchInputs(a: MatchInputs, b: MatchInputs): boolean {
  const norm = (v: unknown) => (Array.isArray(v) ? JSON.stringify([...v].map(String).sort()) : JSON.stringify(v ?? null))
  for (const k of MATCH_INPUT_FIELDS) if (norm(a.fields[k]) !== norm(b.fields[k])) return false
  const prefs = (x: MatchInputs) => JSON.stringify(x.dismiss.map((p) => [p.kind, p.value, p.action]))
  return prefs(a) === prefs(b)
}

/** Parses stored JSON; null when it isn't an input set. */
export function parseMatchInputs(raw: unknown): MatchInputs | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!o.fields || typeof o.fields !== 'object') return null
  return {
    fields: o.fields as MatchInputs['fields'],
    dismiss: Array.isArray(o.dismiss) ? (o.dismiss as SnapshotPreference[]) : [],
    soc: typeof o.soc === 'string' ? o.soc : null,
  }
}

/**
 * The member as they were: today's profile with the stored inputs laid over it (dates revived).
 * subFunction is left undefined so the classifier re-derives it and never saves an old value.
 */
export function profileFromInputs<T extends Record<string, unknown>>(current: T, inputs: MatchInputs): T {
  const out: Record<string, unknown> = { ...current }
  for (const k of MATCH_INPUT_FIELDS) {
    if (!(k in inputs.fields)) continue
    const v = inputs.fields[k]
    out[k] = isDateField(k) && typeof v === 'string' ? new Date(v) : v
  }
  out.subFunction = undefined
  return out as T
}

/** Which fields differ between two input sets (for "what you changed"). */
export function changedFields(before: MatchInputs, after: MatchInputs): MatchInputField[] {
  const norm = (v: unknown) => (Array.isArray(v) ? JSON.stringify([...v].map(String).sort()) : JSON.stringify(v ?? null))
  return MATCH_INPUT_FIELDS.filter((k) => norm(before.fields[k]) !== norm(after.fields[k]))
}
