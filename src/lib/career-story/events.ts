// A member's career story as events: school, work, ventures, pauses, learning and moments.
// Most of it is derived from data we already hold, so nothing has to be entered twice. The member
// adds what we cannot know (a pause, a move, a venture) and can correct or hide anything we
// derived. Pure and client-safe. Dates are yyyy-mm-dd strings so events cross the server/client
// line unchanged.
//
// Written to be kind: a gap is "a pause", not a hole; we never label why someone left a job; the
// reason for a pause is the member's to give, and optional.

export const STORY_KINDS = ['SCHOOL', 'WORK', 'VENTURE', 'PAUSE', 'LEARNING', 'MILESTONE'] as const
export type StoryKind = (typeof STORY_KINDS)[number]

export const PAUSE_REASONS = [
  { key: 'FAMILY', label: 'Caring for family' },
  { key: 'HEALTH', label: 'Health' },
  { key: 'REST', label: 'Rest or a sabbatical' },
  { key: 'MOVE', label: 'A move' },
  { key: 'OTHER', label: 'Something else' },
] as const
export type PauseReason = (typeof PAUSE_REASONS)[number]['key']

export type StorySource = 'MEMBER' | 'WORK_HISTORY' | 'EDUCATION' | 'LEARNING' | 'INFERRED'

export type StoryEvent = {
  id: string
  kind: StoryKind
  // Short, shown on the bar.
  label: string
  // Full, shown in the detail panel and read by screen readers.
  title: string
  detail: string | null
  start: string
  // null on work, ventures and school = ongoing; on learning and milestones = a single day.
  end: string | null
  source: StorySource
  // The id a correction attaches to, for derived events. Null for member-added events.
  sourceRef: string | null
  reason: PauseReason | null
  // A pause we noticed and the member has not described yet.
  unlabeled: boolean
  // Education dates we estimated from a graduation date.
  approx: boolean
}

// A row from the CareerEvent table.
export type MemberRow = {
  id: string
  kind: string
  label: string
  detail: string | null
  start: string
  end: string | null
  reason: string | null
  sourceRef: string | null
  hidden: boolean
}

export type StoryInput = {
  work: { id: string; roleTitle: string; companyName: string; companyNameNormalized: string; startDate: Date; endDate: Date | null; isCurrent: boolean; engagementType: string; keyAchievement: string | null }[]
  education: { id: string; schoolName: string; degree: string | null; fieldOfStudy: string | null; startDate: Date | null; graduationDate: Date | null }[]
  badges: { id: string; title: string; completedAt: Date }[]
  member: MemberRow[]
  now: Date
}

const DAY = 86_400_000
export const iso = (d: Date) => d.toISOString().slice(0, 10)
export const parseIso = (s: string) => new Date(`${s}T12:00:00Z`)
const addYears = (d: Date, y: number) => new Date(Date.UTC(d.getUTCFullYear() + y, d.getUTCMonth(), d.getUTCDate(), 12))
const isKind = (k: string): k is StoryKind => (STORY_KINDS as readonly string[]).includes(k)
const isReason = (r: string | null): r is PauseReason => !!r && PAUSE_REASONS.some((x) => x.key === r)

// Independent work is the member's own, so it sits in the ventures lane.
const INDEPENDENT = new Set(['FRACTIONAL', 'INTERIM', 'CONSULTING'])

function degreeYears(degree: string | null): number {
  const d = (degree ?? '').toLowerCase()
  if (/ph\.?d|doctor/.test(d)) return 5
  if (/master|mba|m\.s|m\.a/.test(d)) return 2
  if (/associate|certificate|diploma/.test(d)) return 2
  return 4
}

function base(partial: Partial<StoryEvent> & Pick<StoryEvent, 'id' | 'kind' | 'label' | 'start' | 'source'>): StoryEvent {
  return { title: partial.label, detail: null, end: null, sourceRef: null, reason: null, unlabeled: false, approx: false, ...partial }
}

function derive(input: StoryInput): StoryEvent[] {
  const out: StoryEvent[] = []
  const now = input.now
  for (const w of input.work) {
    const ongoing = w.isCurrent || !w.endDate
    out.push(
      base({
        id: `work:${w.id}`,
        kind: INDEPENDENT.has(w.engagementType) ? 'VENTURE' : 'WORK',
        label: w.roleTitle,
        title: `${w.roleTitle}, ${w.companyName}`,
        detail: w.keyAchievement,
        start: iso(w.startDate),
        end: ongoing ? null : iso(w.endDate!),
        source: 'WORK_HISTORY',
        sourceRef: `work:${w.id}`,
      }),
    )
  }
  // A new role at the same company straight after the last one: a step worth marking.
  const byCo = new Map<string, typeof input.work>()
  for (const w of input.work) {
    if (!w.companyNameNormalized) continue
    byCo.set(w.companyNameNormalized, [...(byCo.get(w.companyNameNormalized) ?? []), w])
  }
  for (const list of byCo.values()) {
    const sorted = [...list].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const cur = sorted[i]
      const prevEnd = prev.endDate ?? now
      if (cur.roleTitle !== prev.roleTitle && cur.startDate.getTime() - prevEnd.getTime() <= 31 * DAY) {
        out.push(base({ id: `step:${cur.id}`, kind: 'MILESTONE', label: `New role at ${cur.companyName}`, title: `A new role at ${cur.companyName}: ${cur.roleTitle}`, start: iso(cur.startDate), source: 'WORK_HISTORY', sourceRef: `step:${cur.id}` }))
      }
    }
  }
  for (const e of input.education) {
    if (!e.graduationDate && !e.startDate) continue
    let start: Date
    let end: Date | null
    let approx = false
    if (e.graduationDate) {
      end = e.graduationDate
      if (e.startDate) start = e.startDate
      else {
        start = addYears(e.graduationDate, -degreeYears(e.degree))
        approx = true
      }
    } else {
      start = e.startDate!
      // Started recently and no graduation date: still studying. Otherwise we cannot place it.
      if (now.getTime() - start.getTime() > 6 * 365 * DAY) continue
      end = null
    }
    const what = [e.degree, e.fieldOfStudy].filter(Boolean).join(' in ')
    out.push(
      base({
        id: `edu:${e.id}`,
        kind: 'SCHOOL',
        label: what || e.schoolName,
        title: what ? `${what}, ${e.schoolName}` : e.schoolName,
        start: iso(start),
        end: end ? iso(end) : null,
        source: 'EDUCATION',
        sourceRef: `edu:${e.id}`,
        approx,
      }),
    )
  }
  for (const b of input.badges) {
    out.push(base({ id: `learn:${b.id}`, kind: 'LEARNING', label: b.title, title: b.title, start: iso(b.completedAt), source: 'LEARNING', sourceRef: `learn:${b.id}` }))
  }
  return out
}

type Interval = [number, number]

function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a[0] - b[0])
  const out: Interval[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else out.push([iv[0], iv[1]])
  }
  return out
}

const GAP_DAYS = 90

// Quiet stretches between chapters, for the member to describe or leave alone.
function inferPauses(events: StoryEvent[], member: StoryEvent[], now: Date): StoryEvent[] {
  const occupied: Interval[] = events
    .filter((e) => e.kind === 'WORK' || e.kind === 'VENTURE' || e.kind === 'SCHOOL')
    .map((e): Interval => [parseIso(e.start).getTime(), (e.end ? parseIso(e.end) : now).getTime()])
  if (occupied.length === 0) return []
  const merged = mergeIntervals(occupied)
  const gaps: Interval[] = []
  for (let i = 1; i < merged.length; i++) gaps.push([merged[i - 1][1], merged[i][0]])
  const last = merged[merged.length - 1]
  if (now.getTime() - last[1] > 0) gaps.push([last[1], now.getTime()])
  const pauses = member.filter((e) => e.kind === 'PAUSE').map((e): Interval => [parseIso(e.start).getTime(), (e.end ? parseIso(e.end) : now).getTime()])
  const out: StoryEvent[] = []
  for (const [a, b] of gaps) {
    if (b - a < GAP_DAYS * DAY) continue
    const covered = pauses.reduce((sum, [pa, pb]) => sum + Math.max(0, Math.min(b, pb) - Math.max(a, pa)), 0)
    if (covered >= (b - a) * 0.5) continue
    const trailing = b === now.getTime()
    const start = iso(new Date(a))
    out.push(
      base({
        id: `gap:${start}`,
        kind: 'PAUSE',
        label: trailing ? 'Between roles' : 'A pause',
        title: trailing ? 'Between roles' : 'A pause',
        start,
        end: trailing ? null : iso(new Date(b)),
        source: 'INFERRED',
        sourceRef: `gap:${start}`,
        unlabeled: true,
      }),
    )
  }
  return out
}

function fromRow(r: MemberRow): StoryEvent | null {
  if (!isKind(r.kind)) return null
  return base({
    id: `m:${r.id}`,
    kind: r.kind,
    label: r.label,
    title: r.label,
    detail: r.detail,
    start: r.start,
    end: r.end,
    source: 'MEMBER',
    reason: isReason(r.reason) ? r.reason : null,
  })
}

// The whole story, in order: derived events, with the member's corrections laid over them, plus what they added.
export function deriveStory(input: StoryInput): StoryEvent[] {
  const overrides = new Map<string, MemberRow>()
  const added: MemberRow[] = []
  for (const r of input.member) {
    if (r.sourceRef) overrides.set(r.sourceRef, r)
    else added.push(r)
  }
  const memberEvents = added.map(fromRow).filter((e): e is StoryEvent => !!e)

  const derived = derive(input)
  // Inferred pauses are found after corrections to the events around them, so a corrected date moves the gap.
  const corrected = applyOverrides(derived, overrides)
  const pauses = inferPauses([...corrected, ...memberEvents], memberEvents, input.now)
  const all = applyOverrides([...corrected, ...pauses], overrides, true)
  return [...all, ...memberEvents].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
}

function applyOverrides(events: StoryEvent[], overrides: Map<string, MemberRow>, labelGaps = false): StoryEvent[] {
  const out: StoryEvent[] = []
  for (const e of events) {
    const o = e.sourceRef ? overrides.get(e.sourceRef) : undefined
    if (!o) {
      out.push(e)
      continue
    }
    if (o.hidden) continue
    // Gaps are only described on the second pass, once they exist.
    if (e.source === 'INFERRED' && !labelGaps) {
      out.push(e)
      continue
    }
    out.push({
      ...e,
      label: o.label || e.label,
      title: o.label || e.title,
      detail: o.detail ?? e.detail,
      start: o.start || e.start,
      end: o.end === null ? (e.end ?? null) : o.end,
      reason: isReason(o.reason) ? o.reason : e.reason,
      unlabeled: e.source === 'INFERRED' ? false : e.unlabeled,
      approx: false,
    })
  }
  return out
}

export const pauseReasonLabel = (r: PauseReason | null) => PAUSE_REASONS.find((x) => x.key === r)?.label ?? null
