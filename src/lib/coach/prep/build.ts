import { TRAIT_LEVEL_LABEL } from '@/lib/dossier/evidence-traits'
import type {
  AgreedItem,
  Change,
  EffortFacts,
  MarketItem,
  PipelineFacts,
  PrepInput,
  PrepView,
  Question,
  SharedRow,
  Stat,
} from '@/lib/coach/prep/types'

// Pure builders for the session prep page. Every sentence says what it rests on, copy never assumes a pronoun (the
// member is named, or "their"), and a missing fact group becomes an unavailable section rather than a guess.

const DAY_MS = 24 * 60 * 60 * 1000

export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${rest} min`
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
export const ordinalWord = (n: number): string => (n >= 1 && n <= ORDINALS.length ? ORDINALS[n - 1] : `${n}th`)

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const dayName = (d: Date, timeZone: string) => d.toLocaleDateString('en-US', { weekday: 'long', timeZone })
const shortDate = (d: Date, timeZone: string) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone })

/** The part of the week-over-week change worth saying, or null when it is too small to mention. */
export function effortChange(e: EffortFacts): { kind: 'doubled' | 'up' | 'down' | 'same'; pct: number | null } {
  if (e.lastWeekMinutes <= 0) return { kind: e.thisWeekMinutes > 0 ? 'up' : 'same', pct: null }
  const ratio = e.thisWeekMinutes / e.lastWeekMinutes
  const pct = Math.round((ratio - 1) * 100)
  if (ratio >= 2) return { kind: 'doubled', pct }
  if (pct >= 20) return { kind: 'up', pct }
  if (pct <= -20) return { kind: 'down', pct }
  return { kind: 'same', pct }
}

// ── Where the member is this week ───────────────────────────────────────────

export function buildWeekStats(name: string, effort: EffortFacts | null, pipeline: PipelineFacts | null, tz: string, confidential: boolean): Stat[] {
  const stats: Stat[] = []
  if (effort) {
    stats.push({
      label: 'Search effort',
      value: formatMinutes(effort.thisWeekMinutes),
      detail: `of search work this week, ${formatMinutes(effort.lastWeekMinutes)} last week`,
    })
  }
  if (pipeline) {
    stats.push({
      label: 'Pipeline',
      value: `${pipeline.applied} applied`,
      detail: `${pipeline.replied} replied · ${plural(pipeline.interviews, 'interview')} · ${plural(pipeline.offers, 'offer')}${pipeline.roles.length > 0 ? ` · roles: ${pipeline.roles.slice(0, 3).join(', ')}` : ''}`,
    })
    const next = pipeline.nextInterview
    stats.push({
      label: 'Interviews',
      value: next ? dayName(next.at, tz) : 'None booked',
      detail: next
        ? confidential || !next.company
          ? `${next.role ? `${next.role}. ` : ''}${confidential ? `${name} has company names hidden, so you see the role and the day.` : 'Company not named in the invitation.'}`
          : `${next.role ? `${next.role} at ` : ''}${next.company}`
        : `No interview is booked in what ${name} has connected.`,
    })
  }
  return stats
}

export function buildChanges(name: string, input: Pick<PrepInput, 'effort' | 'pipeline' | 'grade' | 'lastSessionAt'>, tz: string): Change[] {
  const { effort, pipeline, grade } = input
  const out: Change[] = []
  if (effort) {
    const c = effortChange(effort)
    if (c.kind === 'doubled') out.push({ dir: 'up', text: `Search effort doubled${effort.activeDaysThis !== effort.activeDaysLast ? `, and ${name} logged time on ${effort.activeDaysThis} days instead of ${effort.activeDaysLast}` : ''}.` })
    else if (c.kind === 'up') out.push({ dir: 'up', text: `Search effort went up${c.pct === null ? '' : ` ${c.pct}%`}, from ${formatMinutes(effort.lastWeekMinutes)} to ${formatMinutes(effort.thisWeekMinutes)}.` })
    else if (c.kind === 'down') out.push({ dir: 'down', text: `Search effort went down ${Math.abs(c.pct ?? 0)}%, from ${formatMinutes(effort.lastWeekMinutes)} to ${formatMinutes(effort.thisWeekMinutes)}.` })
    if (effort.daysSinceOutreach !== null && effort.daysSinceOutreach >= 7) out.push({ dir: 'down', text: `No messages to contacts in ${effort.daysSinceOutreach} days.` })
  }
  if (pipeline && pipeline.newInterviews > 0) {
    const next = pipeline.nextInterview
    out.push({ dir: 'new', text: `${pipeline.newInterviews === 1 ? 'An interview was' : `${pipeline.newInterviews} interviews were`} booked${next ? `, the next on ${dayName(next.at, tz)}` : ''}.` })
  }
  if (grade && grade.from !== grade.to) out.push({ dir: 'new', text: `The market reality grade moved from ${grade.from} to ${grade.to}.` })
  return out.slice(0, 4)
}

function buildWeek(input: PrepInput, name: string, tz: string): PrepView['week'] {
  if (!input.consented) return { status: 'unavailable', message: `${name} has not agreed to share their search with you yet, so there is nothing to show here.` }
  const stats = buildWeekStats(name, input.effort, input.pipeline, tz, input.confidential)
  if (stats.length === 0) return { status: 'unavailable', message: `We could not read ${name}’s week just now. Reload in a minute.` }
  const since = input.lastSessionAt ? `What changed since ${shortDate(input.lastSessionAt, tz)}` : 'What changed this week'
  return {
    status: 'ok',
    data: {
      stats,
      why: `effort is minutes of real search work ${name} logged or we saw them do (applications, messages to contacts, learning). The pipeline counts jobs they saved and applied to, and replies found in the email and calendar they connected.`,
      changesTitle: since,
      changes: buildChanges(name, input, tz),
    },
  }
}

// ── What was agreed last time ───────────────────────────────────────────────

export function sortAgreed(items: AgreedItem[]): AgreedItem[] {
  // Open items first (the ones to act on), then done; within each, the earliest due date, then the member's before the coach's.
  const rank = (i: AgreedItem) => (i.status === 'open' ? 0 : 1)
  return [...items].sort((a, b) => rank(a) - rank(b) || (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) || (a.owner === b.owner ? 0 : a.owner === 'member' ? -1 : 1))
}

function buildAgreed(input: PrepInput, name: string): PrepView['agreed'] {
  if (input.agreed === null) return { status: 'unavailable', message: 'We could not read your earlier notes just now. Reload in a minute.' }
  const items = sortAgreed(input.agreed).slice(0, 6)
  const open = items.filter((i) => i.status === 'open')
  const yours = open.filter((i) => i.owner === 'coach').length
  const source = input.agreed.some((i) => i.source === 'follow_up') ? 'the follow-ups from your last notes' : 'the action items from your last notes'
  return {
    status: 'ok',
    data: {
      items,
      why:
        items.length === 0
          ? 'you have no earlier session notes with this member, so nothing is open yet.'
          : `these are ${source}${open.length > 0 ? `. ${open.length} ${open.length === 1 ? 'is' : 'are'} still open${yours > 0 ? `, ${yours} of them yours` : ''}` : `, and ${name} has finished all of them`}.`,
    },
  }
}

// ── Three questions, from simple rules ──────────────────────────────────────

type Rule = (input: PrepInput, name: string, tz: string) => Question | null

const strongestTrait = (input: PrepInput) => input.traits?.filter((t) => t.level === 3).map((t) => t.label.toLowerCase())[0] ?? null

export const QUESTION_RULES: Rule[] = [
  // 1. Something the member agreed to and has not done.
  (input, name) => {
    const open = sortAgreed(input.agreed ?? []).find((i) => i.owner === 'member' && i.status === 'open')
    if (!open) return null
    return {
      rule: 'open_member_item',
      text: `You agreed to “${trim(open.text)}”. Where did that land, and what would make it easier to start?`,
      reason: `It is still open from your last session${open.dueAt ? ` (due ${open.dueAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })})` : ''}, and it is ${name}’s.`,
    }
  },
  // 2. Something the coach owes.
  (input, name) => {
    const open = sortAgreed(input.agreed ?? []).find((i) => i.owner === 'coach' && i.status === 'open')
    if (!open) return null
    return {
      rule: 'open_coach_item',
      text: `I said I would “${trim(open.text)}”. Is that still the most useful thing, or has something changed?`,
      reason: `It is yours and still open. Naming it first keeps the trust, and tells ${name} what to expect.`,
    }
  },
  // 3. An interview this week.
  (input, name, tz) => {
    const next = input.pipeline?.nextInterview
    if (!next || next.at.getTime() < input.now.getTime() || next.at.getTime() - input.now.getTime() > 7 * DAY_MS) return null
    const trait = strongestTrait(input)
    return {
      rule: 'interview_soon',
      text: `${dayName(next.at, tz)}’s interview: what do you most want them to remember about you?`,
      reason: `${name} has an interview on ${dayName(next.at, tz)}${trait ? `, and ${trait} is one of the strongest traits in their dossier, which gives them something true to lead with` : ''}.`,
    }
  },
  // 4. Effort jumped.
  (input, name) => {
    const e = input.effort
    if (!e) return null
    const c = effortChange(e)
    if (c.kind !== 'doubled' && c.kind !== 'up') return null
    return {
      rule: 'effort_up',
      text: 'You put in more search time this week. What made it easier to get started?',
      reason: `${name}’s search effort went from ${formatMinutes(e.lastWeekMinutes)} to ${formatMinutes(e.thisWeekMinutes)}. Asking what worked helps them repeat it.`,
    }
  },
  // 5. Effort dropped.
  (input, name) => {
    const e = input.effort
    if (!e || effortChange(e).kind !== 'down') return null
    return {
      rule: 'effort_down',
      text: 'Your search time dipped this week. What got in the way?',
      reason: `${name}’s search effort went from ${formatMinutes(e.lastWeekMinutes)} to ${formatMinutes(e.thisWeekMinutes)}. A dip is often a reason, not a lack of will.`,
    }
  },
  // 6. No outreach for a while.
  (input, name) => {
    const d = input.effort?.daysSinceOutreach
    if (d === null || d === undefined || d < 10) return null
    return {
      rule: 'outreach_quiet',
      text: 'What would make it easier to write to one person this week?',
      reason: `${name} has not messaged a contact in ${d} days. Most roles are found through people, so a first small message is the useful step.`,
    }
  },
  // 7. Many applications, no replies.
  (input, name) => {
    const p = input.pipeline
    if (!p || p.applied < 8 || p.replied > 0) return null
    return {
      rule: 'no_replies',
      text: `Of the ${p.applied} applications, none has had a reply yet. Which roles are you most excited about?`,
      reason: `${name} has applied to ${p.applied} jobs and no reply shows in the email they connected. Narrowing to the roles that excite them is the usual next move.`,
    }
  },
  // 8. Pay well below the local median.
  (input, name) => {
    const pay = input.market?.pay
    if (!pay || pay.median === null || pay.lastSalary === null) return null
    const pct = Math.round(((pay.lastSalary - pay.median) / pay.median) * 100)
    if (pct > -10) return null
    return {
      rule: 'pay_below',
      text: 'When you look at offers, how do you feel about pay?',
      reason: `${name}’s last salary of ${money(pay.lastSalary)} is about ${Math.abs(pct)}% below the ${pay.areaName} median of ${money(pay.median)} for ${pay.occupationTitle.toLowerCase()}.`,
    }
  },
  // 9. High AI exposure.
  (input, name) => {
    const x = input.market?.exposure
    if (!x || x.band !== 'high') return null
    return {
      rule: 'ai_exposure',
      text: 'Which parts of your work do you want to be known for, in the next role?',
      reason: `AI is already used for a large share of the tasks in ${x.title.toLowerCase()} work (${x.sourceName}). It gives ${name} a way to talk about what stays human.`,
    }
  },
]

// Used only to fill up to three when the data gives fewer, and they say so.
const FALLBACKS: Rule[] = [
  (input, name) => ({
    rule: 'fallback_best_moment',
    text: 'What was the best moment of your search this week?',
    reason: `Nothing else in ${name}’s data stood out this week, so this starts with a win.`,
  }),
  (input, name) => ({
    rule: 'fallback_agenda',
    text: 'What is the one thing you most want to solve in this session?',
    reason: `The data does not point to one clear topic, so ${name} sets the agenda.`,
  }),
  (input, name) => ({
    rule: 'fallback_confidence',
    text: 'How confident do you feel about your search right now, from 1 to 10, and what would move it up one point?',
    reason: `It gives you a number to compare with next time, and a small next step. Nothing in the data replaces asking ${name}.`,
  }),
]

function trim(text: string, max = 90): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

/** Always three questions, each with the reason it was picked. Data-led rules first, in priority order; fallbacks fill the rest. */
export function buildQuestions(input: PrepInput, name: string, tz: string): Question[] {
  const picked: Question[] = []
  for (const rule of QUESTION_RULES) {
    if (picked.length === 3) break
    const q = rule(input, name, tz)
    if (q) picked.push(q)
  }
  for (const rule of FALLBACKS) {
    if (picked.length === 3) break
    const q = rule(input, name, tz)
    if (q) picked.push(q)
  }
  return picked
}

// ── Background (behind "Show more") ─────────────────────────────────────────

export function payPositionItem(name: string, pay: NonNullable<PrepInput['market']>['pay']): MarketItem | null {
  if (!pay || pay.median === null) return null
  const where = `the ${pay.areaName} median of ${money(pay.median)} for ${pay.occupationTitle.toLowerCase()}`
  if (pay.lastSalary === null) {
    return { headline: `Local pay for ${name}’s kind of work.`, body: `The ${pay.areaName} median for ${pay.occupationTitle.toLowerCase()} is ${money(pay.median)}.`, source: 'Source: BLS wage survey (OEWS).' }
  }
  const pct = Math.round(((pay.lastSalary - pay.median) / pay.median) * 100)
  const band = pct > 10 ? 'above' : pct < -10 ? 'below' : 'in'
  const size = band === 'in' ? '' : ` about ${Math.abs(pct)}%`
  return {
    headline: band === 'in' ? `${name}’s pay is in range.` : band === 'above' ? `${name}’s pay is above the local middle.` : `${name}’s pay is below the local middle.`,
    body: band === 'in' ? `${name}’s last salary of ${money(pay.lastSalary)} is close to ${where}.` : `${name}’s last salary of ${money(pay.lastSalary)} is${size} ${band} ${where}.`,
    source: 'Source: BLS wage survey (OEWS) for their area. Advertised and paid pay differ.',
  }
}

function buildMarket(input: PrepInput, name: string): PrepView['market'] {
  if (!input.consented) return { status: 'unavailable', message: `${name} has not agreed to share this with you.` }
  if (!input.market) return { status: 'unavailable', message: 'We could not read the market data just now. Reload in a minute.' }
  const items: MarketItem[] = []
  const x = input.market.exposure
  if (x) {
    items.push({
      headline: x.band === 'high' ? 'A large share of this work already uses AI.' : x.band === 'some' ? 'Some of this work already uses AI.' : 'Little AI use seen so far in this work.',
      body: x.sentence,
      source: `Source: ${x.sourceName}. ${x.why}`,
    })
  }
  const pay = payPositionItem(name, input.market.pay)
  if (pay) items.push(pay)
  if (input.market.cycleLine) items.push({ headline: 'How this work held up in past downturns.', body: input.market.cycleLine, source: 'Source: BLS employment history.' })
  if (items.length === 0) return { status: 'unavailable', message: `We could not match ${name}’s work to an occupation yet, so there is no market read. Their résumé job title or function is what we match on.` }
  return { status: 'ok', data: { items } }
}

function buildStrengths(input: PrepInput, name: string): PrepView['strengths'] {
  if (!input.consented) return { status: 'unavailable', message: `${name} has not agreed to share their dossier with you.` }
  if (!input.traits) return { status: 'unavailable', message: 'We could not read the dossier just now. Reload in a minute.' }
  const top = input.traits.filter((t) => t.level >= 2).sort((a, b) => b.level - a.level).slice(0, 3)
  if (top.length === 0) return { status: 'unavailable', message: `${name}’s dossier does not show a clear strength yet. It builds as they search.` }
  return {
    status: 'ok',
    data: {
      items: top.map((t) => ({ label: t.label, level: TRAIT_LEVEL_LABEL[t.level], body: t.shownBy })),
      why: `the dossier builds from what ${name} does and what their references say, not from how they describe themselves.`,
    },
  }
}

// ── What the member shares ──────────────────────────────────────────────────

export function buildShares(name: string, consented: boolean, confidential: boolean): SharedRow[] {
  const gate = (label: string): SharedRow => (consented ? { label, shared: true } : { label, shared: false, note: `${name} has not agreed to share this with you yet.` })
  return [
    gate('Search effort and pipeline'),
    gate('Interviews'),
    gate('Market reality report and AI exposure'),
    gate('Pay position'),
    gate('Dossier strengths'),
    { label: 'Their money situation', shared: false, note: 'Never shared with a coach. Nothing on this page uses it.' },
    confidential
      ? { label: 'Names of companies they applied to', shared: false, note: 'Confidential mode is on: you see counts and roles, not company names.' }
      : consented
        ? { label: 'Names of companies they applied to', shared: true }
        : { label: 'Names of companies they applied to', shared: false, note: `${name} has not agreed to share this with you yet.` },
  ]
}

// ── The page ────────────────────────────────────────────────────────────────

export function buildPrep(input: PrepInput): PrepView {
  const name = input.firstName || 'this member'
  const tz = input.session?.timezone ?? 'America/New_York'
  const s = input.session
  const intro = s
    ? `${s.startsAt.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz })} at ${s.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })} · ${s.minutes} minutes · ${s.meetUrl ? 'Google Meet' : 'meeting link not added'} · your ${ordinalWord(s.ordinal)} session. Built from what ${name} has shared with you.`
    : `No session is booked yet. This is where ${name} stands now, built from what they have shared with you.`
  return {
    title: `Before you meet ${name}`,
    intro,
    week: buildWeek(input, name, tz),
    agreed: buildAgreed(input, name),
    questions: buildQuestions(input, name, tz),
    market: buildMarket(input, name),
    strengths: buildStrengths(input, name),
    shares: buildShares(name, input.consented, input.confidential),
  }
}

/** The one primary action: join the call and start notes when a Meet link exists, otherwise just open notes. */
export function primaryAction(meetUrl: string | null): { label: string; hint: string; meetUrl: string | null } {
  return meetUrl
    ? { label: 'Join Meet and open notes', hint: 'Opens Meet in a new tab and starts your notes', meetUrl }
    : { label: 'Open notes', hint: 'No Meet link is on this session yet. Your notes open here.', meetUrl: null }
}

