// "What we know about you": the signals job matching reads, what each one changes, what a
// missing one would pay off (with real counts from match-compute.ts), and the precision meter
// — "Your search is X% tuned", a weighted completeness of the signals matching actually uses.
// Pure: src/test/personalization.test.ts.

export type SignalKey = 'city' | 'title' | 'function' | 'tools' | 'industries' | 'work_setup' | 'clearance'

/**
 * Meter weights: only signals relevance.ts reads count. Clearance and licenses are matched on
 * the card and by the board's filters, not in which jobs match, so they weigh nothing here.
 * Tune here; they sum to 100.
 */
export const SIGNAL_WEIGHT: Record<SignalKey, number> = {
  city: 25,
  title: 20,
  tools: 20,
  industries: 15,
  function: 10,
  work_setup: 10,
  clearance: 0,
}

/** Where each one is fixed or edited. */
export const SIGNAL_HREF: Record<SignalKey, string> = {
  city: '/dashboard/profile/personal#basics',
  title: '/dashboard/resume',
  function: '/dashboard/profile/personal#function-experience',
  tools: '/dashboard/skills-assessment#tools',
  industries: '/dashboard/profile/personal#industry',
  work_setup: '/dashboard/search-strategy',
  clearance: '/dashboard/profile/screening#screening-questions',
}

/** What the member's profile and their last match run say (match-compute.ts MatchState). */
export interface SignalInputs {
  city: string | null
  state: string | null
  /** Their city placed on the map (relevance.ts geo anchor). */
  cityPlaced: boolean
  commuteMiles: number
  acceptsRemote: boolean
  remotePreference: string | null
  relocationStates: string[]
  title: string | null
  /** What matching calls their kind of work: sub-function or function label. */
  fieldLabel: string | null
  primaryFunction: string | null
  toolsConfirmed: boolean
  toolCount: number
  industries: string[]
  clearanceLevel: string | null
  clearanceLabel: string | null
  /** From the match run, over their current matches. */
  matches: number
  /** Matches that aren't remote, when their city isn't placed (distance can't be checked). */
  geoUnchecked: number
  /** Matches whose skills couldn't be checked (relevance.ts skills 'unknown'). */
  skillsUnchecked: number
  /** Matches with a known industry. */
  industryKnown: number
  /** Matches that ask for a security clearance; and those the member's clearance meets. */
  clearanceAsked: number
  clearanceMet: number
}

export interface Signal {
  key: SignalKey
  known: boolean
  weight: number
  /** Known: "Sunnyvale, CA". Missing: what to add ("Add your city"). */
  label: string
  /** Known: what it changes ("jobs within 40 mi"). Missing: the payoff ("we check commute distance on 312 matches"). */
  effect: string
  href: string
}

const n = (x: number) => x.toLocaleString()
const plural = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`

/** The signals, in the order shown. Clearance is shown only when it matters (held, or asked by their matches). */
export function buildSignals(s: SignalInputs): Signal[] {
  const out: Signal[] = []
  const push = (key: SignalKey, known: boolean, label: string, effect: string) =>
    out.push({ key, known, weight: SIGNAL_WEIGHT[key], label, effect, href: SIGNAL_HREF[key] })

  push(
    'city',
    s.cityPlaced,
    s.cityPlaced ? [s.city, s.state].filter(Boolean).join(', ') : 'Add your city',
    s.cityPlaced
      ? `jobs within ${s.commuteMiles} mi${s.acceptsRemote ? ', plus remote' : ''}`
      : s.geoUnchecked > 0
        ? `we'd check commute distance on ${plural(s.geoUnchecked, 'match', 'matches')} we can't place today`
        : 'we can count jobs you could commute to'
  )
  push(
    'title',
    !!s.title?.trim(),
    s.title?.trim() ? s.title.trim() : 'Add your latest job title (upload your résumé)',
    s.title?.trim()
      ? `your exact kind of work${s.fieldLabel ? ` (${s.fieldLabel})` : ''}, not the whole function`
      : `we'd narrow your ${plural(s.matches, 'match', 'matches')} to your exact kind of work`
  )
  push(
    'function',
    !!s.primaryFunction && !/^(general|other)$/i.test(s.primaryFunction),
    s.primaryFunction && !/^(general|other)$/i.test(s.primaryFunction) ? s.primaryFunction : 'Pick your function',
    s.primaryFunction ? 'jobs in your field first' : 'we can tell which jobs are in your field'
  )
  push(
    'tools',
    s.toolsConfirmed,
    s.toolsConfirmed ? `${plural(s.toolCount, 'tool')} confirmed` : 'Confirm your tools',
    s.toolsConfirmed
      ? "checked against the tools each job asks for"
      : s.skillsUnchecked > 0
        ? `we'd check skills on ${plural(s.skillsUnchecked, 'match', 'matches')} we can't check today`
        : 'a sharper skills match on every job'
  )
  push(
    'industries',
    s.industries.length > 0,
    s.industries.length > 0 ? s.industries.slice(0, 3).join(', ') : 'Confirm your industries',
    s.industries.length > 0
      ? 'your industries first; others only when you fit strongly'
      : s.industryKnown > 0
        ? `we'd put your industries first across ${plural(s.industryKnown, 'match', 'matches')}`
        : 'your industries first'
  )
  const setup = s.remotePreference
    ? [s.remotePreference === 'onsite' ? 'Onsite only' : s.remotePreference === 'remote' ? 'Remote' : s.remotePreference === 'hybrid' ? 'Hybrid' : 'Flexible on remote', s.relocationStates.length > 0 ? `would move to ${s.relocationStates.slice(0, 4).join(', ')}` : null]
        .filter(Boolean)
        .join(' · ')
    : 'Tell us remote, hybrid or onsite'
  push(
    'work_setup',
    !!s.remotePreference,
    setup,
    s.remotePreference ? (s.acceptsRemote ? 'remote jobs count as local' : 'remote-only jobs left out') : 'we know whether remote jobs count for you'
  )
  const holds = !!s.clearanceLevel && s.clearanceLevel !== 'none'
  if (holds || s.clearanceAsked > 0) {
    push(
      'clearance',
      s.clearanceLevel !== null,
      holds ? (s.clearanceLabel ?? 'Clearance on file') : s.clearanceLevel === 'none' ? 'No clearance' : 'Add your clearance',
      holds
        ? s.clearanceMet > 0
          ? `${plural(s.clearanceMet, 'cleared job')} in your matches you qualify for`
          : 'cleared jobs marked on each card'
        : s.clearanceLevel === 'none'
          ? `${plural(s.clearanceAsked, 'match', 'matches')} that need one are marked`
          : `see which of ${plural(s.clearanceAsked, 'cleared job')} in your matches you qualify for`
    )
  }
  return out
}

export interface Precision {
  /** 0-100. */
  pct: number
  /** The missing signal worth the most, with its payoff. Null when fully tuned. */
  next: { key: SignalKey; gain: number; label: string; effect: string; href: string } | null
}

/** "Your search is X% tuned": the weights of the known signals; the next step is the heaviest missing one. */
export function precisionOf(signals: Signal[]): Precision {
  const total = signals.reduce((a, s) => a + s.weight, 0) || 1
  const known = signals.filter((s) => s.known).reduce((a, s) => a + s.weight, 0)
  const pct = Math.round((known / total) * 100)
  const missing = signals.filter((s) => !s.known && s.weight > 0).sort((a, b) => b.weight - a.weight)[0]
  return {
    pct,
    next: missing ? { key: missing.key, gain: Math.round((missing.weight / total) * 100), label: missing.label, effect: missing.effect, href: missing.href } : null,
  }
}
