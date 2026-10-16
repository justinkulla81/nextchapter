// Hard requirements a job states (security clearance, US citizens only, no visa
// sponsorship, required licenses, travel %, relocation, onsite) and how they line up
// with what the member told us. Pure: no database, so the rules are unit-tested
// (src/test/job-requirements.test.ts) and they run for every card and every board row.
//
// The crawler reads the flags from the FULL posting text with phrase patterns that
// need requirement context ("must hold an active TS/SCI", "unable to sponsor") and
// skip employer boilerplate (ncrawl/requirements.py). The import stores them twice:
// requirementFlags (the list, with labels and evidence) and requirementTags (a short
// comma list the board filters on in memory, also copied to BoardLightRow).
//
// Member side — the answers already live in the profile; nothing here asks twice:
// - clearance held / licenses held: Screening questions (clearanceLevel,
//   clearanceActive, clearancePolygraph, licensesHeld)
// - US citizen / needs sponsorship: Work authorization (workAuthorization)
// - travel, relocation, remote: Search strategy (maxTravelPct, openToRelocation,
//   remotePreference)
// A question the member hasn't answered never counts against a job: the flag shows
// neutrally with a one-click link to answer it.

export const CLEARANCE_LEVELS = ['public_trust', 'secret', 'top_secret', 'ts_sci'] as const
export type ClearanceLevel = (typeof CLEARANCE_LEVELS)[number]
export const CLEARANCE_LABEL: Record<ClearanceLevel | 'unspecified', string> = {
  public_trust: 'Public Trust',
  secret: 'Secret',
  top_secret: 'Top Secret',
  ts_sci: 'TS/SCI',
  unspecified: 'security',
}
const CLEARANCE_RANK: Record<ClearanceLevel | 'unspecified', number> = { unspecified: 1, public_trust: 1, secret: 2, top_secret: 3, ts_sci: 4 }

export const POLYGRAPH_LABEL = { ci: 'CI polygraph', full_scope: 'full-scope polygraph', unspecified: 'polygraph' } as const
export type Polygraph = keyof typeof POLYGRAPH_LABEL

export const LICENSE_KEYS = ['cpa', 'pe', 'bar', 'rn', 'pmp', 'series_7', 'series_24', 'series_63', 'series_65', 'series_66'] as const
export type LicenseKey = (typeof LICENSE_KEYS)[number]
export const LICENSE_LABEL: Record<LicenseKey, string> = {
  cpa: 'CPA',
  pe: 'PE license',
  bar: 'Bar admission',
  rn: 'RN license',
  pmp: 'PMP',
  series_7: 'Series 7',
  series_24: 'Series 24',
  series_63: 'Series 63',
  series_65: 'Series 65',
  series_66: 'Series 66',
}

/** Travel below this share of the time isn't worth a label. */
export const NOTABLE_TRAVEL_PCT = 25

export type RequirementFlag =
  | { flag: 'clearance'; level: ClearanceLevel | 'unspecified'; active: boolean; polygraph: Polygraph | null; evidence?: string }
  | { flag: 'us_citizen'; evidence?: string }
  | { flag: 'no_sponsorship'; evidence?: string }
  | { flag: 'license'; key: LicenseKey; evidence?: string }
  | { flag: 'travel'; pct: number; evidence?: string }
  | { flag: 'relocation'; evidence?: string }
  | { flag: 'onsite'; evidence?: string }
export type RequirementFlagName = RequirementFlag['flag']

const isLevel = (v: unknown): v is ClearanceLevel | 'unspecified' =>
  v === 'unspecified' || (CLEARANCE_LEVELS as readonly unknown[]).includes(v)
const isPoly = (v: unknown): v is Polygraph => v === 'ci' || v === 'full_scope' || v === 'unspecified'
const isLicense = (v: unknown): v is LicenseKey => (LICENSE_KEYS as readonly unknown[]).includes(v)
const ev = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined)

/** The import's / database's flag list, validated. Unknown shapes are dropped, never guessed. */
export function parseRequirementFlags(raw: unknown): RequirementFlag[] {
  if (!Array.isArray(raw)) return []
  const out: RequirementFlag[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    let f: RequirementFlag | null = null
    switch (o.flag) {
      case 'clearance':
        f = {
          flag: 'clearance',
          level: isLevel(o.level) ? o.level : 'unspecified',
          active: o.active === true,
          polygraph: isPoly(o.polygraph) ? o.polygraph : null,
          evidence: ev(o.evidence),
        }
        break
      case 'us_citizen':
      case 'no_sponsorship':
      case 'relocation':
      case 'onsite':
        f = { flag: o.flag, evidence: ev(o.evidence) }
        break
      case 'license':
        if (isLicense(o.key)) f = { flag: 'license', key: o.key, evidence: ev(o.evidence) }
        break
      case 'travel': {
        const pct = typeof o.pct === 'number' ? Math.round(o.pct) : Number.NaN
        if (pct > 0 && pct <= 100) f = { flag: 'travel', pct, evidence: ev(o.evidence) }
        break
      }
    }
    if (!f) continue
    const key = f.flag === 'license' ? `license:${f.key}` : f.flag
    if (seen.has(key)) continue
    seen.add(key)
    if (!f.evidence) delete f.evidence
    out.push(f)
  }
  return out
}

/** The compact tag string the board filters on: "clearance,clr:ts_sci,clr:active,poly:full_scope,us_citizen,…". Null for none. */
export function requirementTagsFor(flags: RequirementFlag[]): string | null {
  const tags: string[] = []
  for (const f of flags) {
    if (f.flag === 'clearance') {
      tags.push('clearance', `clr:${f.level}`)
      if (f.active) tags.push('clr:active')
      if (f.polygraph) tags.push(`poly:${f.polygraph}`)
    } else if (f.flag === 'license') tags.push(`license:${f.key}`)
    else if (f.flag === 'travel') tags.push(`travel:${f.pct}`)
    else tags.push(f.flag)
  }
  return tags.length ? [...new Set(tags)].sort().join(',') : null
}

const tagCache = new Map<string, RequirementFlag[]>()
/** requirementTags back to flags (no evidence) — memoised, since tag strings repeat across the board. */
export function flagsFromTags(tags: string | null | undefined): RequirementFlag[] {
  if (!tags) return []
  const hit = tagCache.get(tags)
  if (hit) return hit
  const set = new Set(tags.split(','))
  const out: RequirementFlag[] = []
  if (set.has('clearance')) {
    const level = CLEARANCE_LEVELS.find((l) => set.has(`clr:${l}`)) ?? 'unspecified'
    const poly = (['full_scope', 'ci', 'unspecified'] as const).find((p) => set.has(`poly:${p}`)) ?? null
    out.push({ flag: 'clearance', level, active: set.has('clr:active'), polygraph: poly })
  }
  if (set.has('us_citizen')) out.push({ flag: 'us_citizen' })
  if (set.has('no_sponsorship')) out.push({ flag: 'no_sponsorship' })
  for (const k of LICENSE_KEYS) if (set.has(`license:${k}`)) out.push({ flag: 'license', key: k })
  for (const t of set) {
    const m = /^travel:(\d{1,3})$/.exec(t)
    if (m) out.push({ flag: 'travel', pct: Number(m[1]) })
  }
  if (set.has('relocation')) out.push({ flag: 'relocation' })
  if (set.has('onsite')) out.push({ flag: 'onsite' })
  if (tagCache.size > 5000) tagCache.clear()
  tagCache.set(tags, out)
  return out
}

/** The short label shown on cards and the job page ("Requires active TS/SCI", "US citizens only"). */
export function requirementLabel(f: RequirementFlag): string {
  switch (f.flag) {
    case 'clearance': {
      const poly = f.polygraph ? ` with ${POLYGRAPH_LABEL[f.polygraph]}` : ''
      if (f.level === 'unspecified') return f.active ? `Requires an active security clearance${poly}` : `Must be able to obtain a security clearance${poly}`
      if (f.level === 'public_trust') return f.active ? `Requires active Public Trust${poly}` : `Must be able to obtain Public Trust${poly}`
      return f.active ? `Requires active ${CLEARANCE_LABEL[f.level]}${poly}` : `Must be able to obtain ${CLEARANCE_LABEL[f.level]} clearance${poly}`
    }
    case 'us_citizen':
      return 'US citizens only'
    case 'no_sponsorship':
      return 'No visa sponsorship'
    case 'license':
      return `${LICENSE_LABEL[f.key]} required`
    case 'travel':
      return `Up to ${f.pct}% travel`
    case 'relocation':
      return 'Relocation required'
    case 'onsite':
      return 'Must work onsite'
  }
}

/** Flags worth a label: everything but light travel. */
export function notableFlags(flags: RequirementFlag[]): RequirementFlag[] {
  return flags.filter((f) => f.flag !== 'travel' || f.pct >= NOTABLE_TRAVEL_PCT)
}

// ── Member side ──────────────────────────────────────────────────────────────

export const CLEARANCE_HELD_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'public_trust', label: 'Public Trust' },
  { value: 'secret', label: 'Secret' },
  { value: 'top_secret', label: 'Top Secret' },
  { value: 'ts_sci', label: 'TS/SCI' },
] as const
export const POLYGRAPH_HELD_OPTIONS = [
  { value: 'none', label: 'No polygraph' },
  { value: 'ci', label: 'CI polygraph' },
  { value: 'full_scope', label: 'Full-scope polygraph' },
] as const
export const MAX_TRAVEL_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 25, label: 'Up to 25%' },
  { value: 50, label: 'Up to 50%' },
  { value: 75, label: '75% or more' },
] as const

export interface RequirementMember {
  clearanceLevel: string | null
  clearanceActive: boolean | null
  clearancePolygraph: string | null
  licensesHeld: string[]
  licensesAnsweredAt: Date | null
  workAuthorization: string | null
  maxTravelPct: number | null
  openToRelocation: boolean
  /** The member answered the relocation question (onboarding or Search strategy) — before that, openToRelocation=false means "not asked". */
  relocationAsked: boolean
  remotePreference: string | null
  currentState: string | null
}

/** CandidateProfile fields requirementMemberOf reads. */
export interface RequirementProfile {
  clearanceLevel: string | null
  clearanceActive: boolean | null
  clearancePolygraph: string | null
  licensesHeld: string[]
  licensesAnsweredAt: Date | null
  workAuthorization: string | null
  maxTravelPct: number | null
  travelWillingness: boolean
  openToRelocation: boolean
  searchStrategyConfirmedAt: Date | null
  onboardingLocationConfirmedAt: Date | null
  remotePreference: string | null
  currentState: string | null
}

/** Fields of CandidateProfile the requirement match reads — for a Prisma select. */
export const REQUIREMENT_PROFILE_FIELDS = [
  'clearanceLevel', 'clearanceActive', 'clearancePolygraph', 'licensesHeld', 'licensesAnsweredAt', 'workAuthorization',
  'maxTravelPct', 'travelWillingness', 'openToRelocation', 'searchStrategyConfirmedAt', 'onboardingLocationConfirmedAt',
  'remotePreference', 'currentState',
] as const satisfies readonly (keyof RequirementProfile)[]

/** The profile as the requirement match reads it. A yes to the old travel question counts as "up to 50%". */
export function requirementMemberOf(p: RequirementProfile): RequirementMember {
  return {
    clearanceLevel: p.clearanceLevel,
    clearanceActive: p.clearanceActive,
    clearancePolygraph: p.clearancePolygraph,
    licensesHeld: p.licensesHeld ?? [],
    licensesAnsweredAt: p.licensesAnsweredAt,
    workAuthorization: p.workAuthorization,
    maxTravelPct: p.maxTravelPct ?? (p.travelWillingness ? 50 : null),
    openToRelocation: p.openToRelocation,
    relocationAsked: !!(p.searchStrategyConfirmedAt || p.onboardingLocationConfirmedAt),
    remotePreference: p.remotePreference,
    currentState: p.currentState,
  }
}

export type RequirementStatus = 'blocker' | 'unknown' | 'ok'
export interface RequirementCheck {
  flag: RequirementFlagName
  /** e.g. "Requires active TS/SCI" */
  label: string
  status: RequirementStatus
  /** Blocker: "Requires active TS/SCI — you told us you don't hold a clearance". Unknown: what to answer. */
  message: string
  /** Where to answer when the member hasn't (status 'unknown'). */
  answer?: { label: string; href: string; field: RequirementAnswerField }
}
export type RequirementAnswerField = 'clearance' | 'licenses' | 'work_authorization' | 'travel' | 'relocation' | 'remote_preference'

export const REQUIREMENT_ANSWER: Record<RequirementAnswerField, { label: string; href: string }> = {
  clearance: { label: 'Tell us your clearance', href: '/dashboard/profile/screening#screening-questions' },
  licenses: { label: 'Tell us your licenses', href: '/dashboard/profile/screening#screening-questions' },
  work_authorization: { label: 'Tell us your work authorization', href: '/dashboard/profile/screening#work-authorization' },
  travel: { label: 'Tell us how much you can travel', href: '/dashboard/search-strategy#travel' },
  relocation: { label: 'Tell us if you would relocate', href: '/dashboard/search-strategy#relocation' },
  remote_preference: { label: 'Tell us if you want remote work', href: '/dashboard/search-strategy' },
}

const answer = (field: RequirementAnswerField) => ({ ...REQUIREMENT_ANSWER[field], field })
const isHeldLevel = (v: string | null): v is ClearanceLevel => (CLEARANCE_LEVELS as readonly (string | null)[]).includes(v)

/** One flag against the member's answers. */
export function checkRequirement(f: RequirementFlag, m: RequirementMember, job: { locationState?: string | null } = {}): RequirementCheck {
  const label = requirementLabel(f)
  const blocker = (why: string): RequirementCheck => ({ flag: f.flag, label, status: 'blocker', message: `${label} — ${why}` })
  const unknown = (field: RequirementAnswerField, what: string): RequirementCheck => ({
    flag: f.flag,
    label,
    status: 'unknown',
    message: `${label} — ${what}`,
    answer: answer(field),
  })
  const ok = (why: string): RequirementCheck => ({ flag: f.flag, label, status: 'ok', message: `${label} — ${why}` })

  switch (f.flag) {
    case 'clearance': {
      if (m.clearanceLevel === null) return unknown('clearance', "tell us whether you hold a clearance to see if you qualify")
      if (!isHeldLevel(m.clearanceLevel)) {
        return f.active ? blocker("you told us you don't hold a clearance") : ok("the employer sponsors it; you'd need to qualify for one")
      }
      const held = CLEARANCE_LABEL[m.clearanceLevel]
      if (CLEARANCE_RANK[m.clearanceLevel] < CLEARANCE_RANK[f.level]) {
        return f.active ? blocker(`you told us you hold ${held}`) : ok(`you hold ${held}; they'd sponsor the upgrade`)
      }
      if (f.active && m.clearanceActive === false) return blocker(`you told us your ${held} has lapsed`)
      if (f.polygraph === 'full_scope' && f.active) {
        if (m.clearancePolygraph === null) return unknown('clearance', 'tell us whether you have a polygraph')
        if (m.clearancePolygraph !== 'full_scope') return blocker("you told us you don't have a full-scope polygraph")
      }
      if (f.polygraph === 'ci' && f.active) {
        if (m.clearancePolygraph === null) return unknown('clearance', 'tell us whether you have a polygraph')
        if (m.clearancePolygraph === 'none') return blocker("you told us you don't have a polygraph")
      }
      return ok(`you hold ${held}`)
    }
    case 'us_citizen': {
      if (m.workAuthorization === 'us_citizen') return ok("you're a US citizen")
      if (m.workAuthorization === 'permanent_resident') return blocker("you told us you're a permanent resident, not a citizen")
      if (m.workAuthorization === 'need_sponsorship') return blocker("you told us you'll need visa sponsorship")
      return unknown('work_authorization', 'tell us your citizenship to see if you qualify')
    }
    case 'no_sponsorship': {
      if (m.workAuthorization === 'need_sponsorship') return blocker("you told us you'll need visa sponsorship")
      if (m.workAuthorization === null) return unknown('work_authorization', 'tell us whether you need sponsorship')
      return ok("you don't need sponsorship")
    }
    case 'license': {
      if (m.licensesHeld.includes(f.key)) return ok("you hold it")
      if (m.licensesAnsweredAt === null) return unknown('licenses', 'tell us which licenses you hold')
      return blocker(`you haven't told us you hold one`)
    }
    case 'travel': {
      if (m.maxTravelPct === null) return unknown('travel', 'tell us how much you can travel')
      if (f.pct > m.maxTravelPct && !(m.maxTravelPct >= 75)) {
        return blocker(m.maxTravelPct === 0 ? "you told us you can't travel" : `you told us up to ${m.maxTravelPct}%`)
      }
      return ok('within what you told us')
    }
    case 'relocation': {
      if (m.openToRelocation) return ok("you're open to relocating")
      const here = job.locationState && m.currentState && job.locationState.toUpperCase() === m.currentState.trim().toUpperCase()
      if (here) return ok("it's in your state")
      if (!m.relocationAsked) return unknown('relocation', 'tell us whether you would relocate')
      return blocker("you told us you're not open to relocating")
    }
    case 'onsite': {
      const pref = (m.remotePreference ?? '').toLowerCase()
      if (!pref) return unknown('remote_preference', 'tell us whether you want remote work')
      if (pref === 'remote') return blocker("you're looking for remote roles")
      return ok('works with your preference')
    }
  }
}

/** Every notable flag against the member: blockers first, then unanswered, then fine. */
export function checkRequirements(flags: RequirementFlag[], m: RequirementMember, job: { locationState?: string | null } = {}): RequirementCheck[] {
  const order: Record<RequirementStatus, number> = { blocker: 0, unknown: 1, ok: 2 }
  return notableFlags(flags)
    .map((f) => checkRequirement(f, m, job))
    .sort((a, b) => order[a.status] - order[b.status])
}

export function hasHardBlocker(flags: RequirementFlag[], m: RequirementMember, job: { locationState?: string | null } = {}): boolean {
  return notableFlags(flags).some((f) => checkRequirement(f, m, job).status === 'blocker')
}

/** The member holds a clearance (any level, active or lapsed) — they get the "Cleared jobs" filter. */
export function holdsClearance(m: Pick<RequirementMember, 'clearanceLevel'>): boolean {
  return isHeldLevel(m.clearanceLevel)
}

/** A "Cleared jobs" result: asks for a clearance, and the member's own clearance isn't a blocker for it. */
export function isClearedJobFor(flags: RequirementFlag[], m: RequirementMember): boolean {
  const c = flags.find((f) => f.flag === 'clearance')
  return !!c && checkRequirement(c, m).status !== 'blocker'
}
