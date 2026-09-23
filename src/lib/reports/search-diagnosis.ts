// A diagnosis of how a job search is going, from what actually happened:
// applications sent, who said no, who wanted to talk, and how much
// networking went alongside. Each check answers one question a candidate
// actually asks ("am I applying to the wrong titles?"), with a verdict and
// one concrete suggestion. Pure — the loader lives in
// search-diagnosis-data.ts — so every verdict is unit-testable.
//
// Deliberately no AI call: every number here is computed from the
// candidate's own records, and the suggestions are fixed text chosen by the
// numbers, so the page costs nothing extra to render and never invents a
// fact.

import { orgNamesMatch } from '@/lib/text/org-name-match'
import { inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { calibratedLevelRank } from '@/lib/scoring/level-rank'

const DAY = 86_400_000

export interface DiagnosisApplication {
  title: string | null
  companyName: string | null
  location: string | null
  channel: string | null // ApplicationChannel, when known
  appliedAt: Date
  interviewAt: Date | null
  rejectedAt: Date | null
}
export interface DiagnosisEvent {
  type: 'REJECTION' | 'INTERVIEW_INVITE' | 'OFFER'
  companyName: string | null
  at: Date
}
export interface DiagnosisInput {
  now: Date
  applications: DiagnosisApplication[]
  events: DiagnosisEvent[] // email-detected, not dismissed, one per thread
  outreachLast28: number // logged outreach + networking emails sent
  outreachPrior28: number
  weeklyGoal: number | null
  targetRole: string | null // targetRoleType, e.g. "CFO"
  targetFunction: string | null
  levelRankScore: number | null
  remotePreference: string | null
  openToRelocation: boolean
  homeMetro: string | null
}

export type Verdict = 'good' | 'watch' | 'act' | 'unknown'
export interface DiagnosisCheck {
  key: string
  question: string
  verdict: Verdict
  headline: string
  detail: string
  suggestion: string | null
}
export interface WeekPoint { weekStart: Date; applied: number; interviews: number; rejections: number }
export interface SearchDiagnosis {
  totals: { applications: number; interviews: number; rejections: number; offers: number; noReplyYet: number }
  interviewRate: number | null
  checks: DiagnosisCheck[]
  ideas: string[]
  weeks: WeekPoint[]
}

// Executive job families — the generic function mapper leaves most senior
// titles (corporate development, investing) unclassified.
const FAMILIES: [string, RegExp][] = [
  ['Finance leadership', /\b(cfo|chief financial|finance|financial|controller|treasur|fp&a|accounting)\b/i],
  ['Corporate development & strategy', /\b(corporate development|corp dev|strategy|strategic|m&a|mergers|business development|chief of staff)\b/i],
  ['Investing', /\b(invest\w*|principal|private equity|venture|portfolio|asset management|fund|capital markets)\b/i],
  ['Advisory & banking', /\b(banking|banker|advisory|consult\w*|sector leader)\b/i],
  ['General management', /\b(ceo|chief executive|coo|chief operating|president|general manager|managing director)\b/i],
  ['Operations', /\b(operations|operating|supply chain|procurement)\b/i],
  ['Technology & AI', /\b(cto|technology|engineering|product|data|ai|agentic|digital)\b/i],
  ['Sales & marketing', /\b(sales|marketing|revenue|growth|commercial|cmo)\b/i],
  ['People', /\b(hr|human resources|people|talent)\b/i],
]
export function titleFamily(title: string | null): string | null {
  if (!title) return null
  for (const [family, re] of FAMILIES) if (re.test(title)) return family
  return null
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function top<T>(items: T[], key: (t: T) => string | null, n = 3): [string, number][] {
  const m = new Map<string, number>()
  for (const i of items) { const k = key(i); if (k) m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

export function diagnoseSearch(input: DiagnosisInput): SearchDiagnosis {
  const { now, applications: apps, events } = input

  // An application "heard back" if it's marked, or a rejection/interview
  // email from the same company arrived after it was sent.
  const outcome = (a: DiagnosisApplication) => {
    const after = events.filter((e) => e.companyName && a.companyName && orgNamesMatch(e.companyName, a.companyName) && e.at >= new Date(a.appliedAt.getTime() - DAY))
    const interview = a.interviewAt ?? after.find((e) => e.type === 'INTERVIEW_INVITE' || e.type === 'OFFER')?.at ?? null
    const rejection = a.rejectedAt ?? after.find((e) => e.type === 'REJECTION')?.at ?? null
    return { interview, rejection }
  }
  const enriched = apps.map((a) => ({ ...a, ...outcome(a) }))

  const interviews = Math.max(enriched.filter((a) => a.interview).length, events.filter((e) => e.type === 'INTERVIEW_INVITE').length)
  const rejections = Math.max(enriched.filter((a) => a.rejection).length, events.filter((e) => e.type === 'REJECTION').length)
  const offers = events.filter((e) => e.type === 'OFFER').length
  const matured = enriched.filter((a) => now.getTime() - a.appliedAt.getTime() >= 21 * DAY)
  const noReply = matured.filter((a) => !a.interview && !a.rejection)
  const interviewRate = apps.length >= 5 ? pct(interviews, apps.length) : null

  const checks: DiagnosisCheck[] = []

  // 1. Volume
  {
    const last28 = apps.filter((a) => now.getTime() - a.appliedAt.getTime() < 28 * DAY).length
    const perWeek = Math.round((last28 / 4) * 10) / 10
    const goal = input.weeklyGoal ?? 5
    let verdict: Verdict = 'good'
    let suggestion: string | null = null
    if (perWeek < goal * 0.5) {
      verdict = 'act'
      suggestion = `Block two sessions a week to reach ${goal} applications — but pair each with a person at that company (see networking).`
    } else if (perWeek < goal) {
      verdict = 'watch'
      suggestion = `A little under your ${goal}/week goal — steady beats bursts.`
    } else if (perWeek > goal * 2 && (interviewRate ?? 0) < 3) {
      verdict = 'act'
      suggestion = 'You are applying a lot with little back. Fewer, better-targeted applications — each with a referral or a note to the hiring leader — will beat volume.'
    }
    checks.push({
      key: 'volume', question: 'Am I applying to too few or too many roles?', verdict,
      headline: `${perWeek} applications a week over the last 4 weeks (goal ${goal})`,
      detail: `${plural(apps.length, 'application')} in total, ${last28} in the last 28 days.`,
      suggestion,
    })
  }

  // 2. Response
  if (apps.length < 5) {
    checks.push({ key: 'response', question: 'Is anyone saying yes?', verdict: 'unknown', headline: 'Not enough applications yet to judge', detail: 'Needs at least 5.', suggestion: null })
  } else {
    const rate = interviewRate!
    const verdict: Verdict = interviews === 0 && apps.length >= 20 ? 'act' : rate < 3 ? 'watch' : 'good'
    checks.push({
      key: 'response', question: 'Is anyone saying yes?', verdict,
      headline: `${rate}% of applications led to an interview (${interviews} of ${apps.length})`,
      detail: `Senior applications sent cold typically land an interview 2–5% of the time; with a referral, several times that. ${plural(rejections, 'rejection')} so far${offers ? `, ${plural(offers, 'offer')}` : ''}.`,
      suggestion: verdict === 'good' ? null : 'The fastest lever is who sees your application: for your top 10 open roles, find someone inside before applying (see networking and titles below).',
    })
  }

  // 3. Silence
  if (matured.length >= 5) {
    const silentPct = pct(noReply.length, matured.length)
    checks.push({
      key: 'silence', question: 'How many applications disappear?', verdict: silentPct >= 70 ? 'act' : silentPct >= 50 ? 'watch' : 'good',
      headline: `${silentPct}% of applications older than 3 weeks got no reply at all`,
      detail: `${noReply.length} of ${matured.length}. Silence usually means the application never reached a person — an automated screen, or a role already filled from the network.`,
      suggestion: silentPct >= 50 ? 'For any role you still want after 10 days of silence, send a short note to the hiring leader or a mutual connection — a follow-up doubles as a second application.' : null,
    })
  }

  // 4. Fast rejections — the tell of an automated screen
  {
    const timed = enriched.filter((a) => a.rejection).map((a) => (a.rejection!.getTime() - a.appliedAt.getTime()) / DAY).filter((d) => d >= 0)
    if (timed.length >= 3) {
      const fast = timed.filter((d) => d <= 3).length
      const fastPct = pct(fast, timed.length)
      checks.push({
        key: 'fast-rejections', question: 'Am I being filtered out automatically?', verdict: fastPct >= 50 ? 'act' : fastPct >= 25 ? 'watch' : 'good',
        headline: `${fastPct}% of rejections came within 3 days of applying`,
        detail: `${fast} of ${timed.length} rejections were near-instant — too fast for a person to have read the résumé closely.`,
        suggestion: fastPct >= 25 ? 'Quick rejections point to a keyword or title mismatch with the posting. Mirror the posting’s exact title and top requirements in your résumé headline and summary for each application.' : null,
      })
    }
  }

  // 5. Networking
  {
    const last28Apps = apps.filter((a) => now.getTime() - a.appliedAt.getTime() < 28 * DAY).length
    const ratio = last28Apps > 0 ? input.outreachLast28 / last28Apps : input.outreachLast28 > 0 ? Infinity : 0
    const withChannel = apps.filter((a) => a.channel)
    const cold = withChannel.filter((a) => a.channel === 'COLD_APPLICATION').length
    const verdict: Verdict = input.outreachLast28 === 0 ? 'act' : ratio < 1 ? 'act' : ratio < 2 ? 'watch' : 'good'
    const trend = input.outreachLast28 - input.outreachPrior28
    checks.push({
      key: 'networking', question: 'Should I be networking more?', verdict,
      headline: `${input.outreachLast28} networking touches vs. ${last28Apps} applications in the last 28 days`,
      detail: [
        `At senior levels most hires come through someone the hiring team knows; a healthy ratio is 2+ conversations per application.`,
        trend !== 0 ? `That’s ${trend > 0 ? 'up' : 'down'} ${Math.abs(trend)} from the 28 days before.` : null,
        withChannel.length >= 5 ? `${pct(cold, withChannel.length)}% of applications with a known channel were cold.` : null,
      ].filter(Boolean).join(' '),
      suggestion: verdict === 'good' ? null : 'Before each application, message one person at the company (a former colleague, an alum, a 2nd-degree connection). Log it so it counts.',
    })
  }

  // 6 & 7. Breadth and titles
  const titled = enriched.filter((a) => a.title)
  const families = top(titled, (a) => titleFamily(a.title), 6)
  const targetFamily = titleFamily(input.targetRole) ?? titleFamily(input.targetFunction)
  if (titled.length < 5) {
    checks.push({ key: 'breadth', question: 'Am I too narrow or too wide?', verdict: 'unknown', headline: 'Not enough titled applications yet', detail: `${titled.length} of ${apps.length} applications have a job title on record.`, suggestion: null })
  } else {
    const classified = families.reduce((s, [, n]) => s + n, 0)
    const lead = families[0]
    const leadShare = lead ? pct(lead[1], classified) : 0
    const distinct = families.filter(([, n]) => n >= 2).length
    const weak = (interviewRate ?? 0) < 3
    let verdict: Verdict = 'good'
    let suggestion: string | null = null
    if (distinct >= 4) {
      verdict = 'act'
      suggestion = 'You are spread across several different jobs. Pick the two families where your story is strongest and put 80% of applications there — recruiters read a scattered history as an unclear candidate.'
    } else if (distinct <= 1 && weak && apps.length >= 15) {
      verdict = 'watch'
      suggestion = 'One lane with little response — add an adjacent title family where your experience transfers directly (e.g. strategy ↔ corporate development ↔ finance leadership).'
    }
    checks.push({
      key: 'breadth', question: 'Am I too narrow or too wide?', verdict,
      headline: distinct >= 4 ? `Applications span ${distinct} different job families` : lead ? `${leadShare}% of titled applications are ${lead[0]}` : 'Titles don’t fall into clear job families',
      detail: families.map(([f, n]) => `${f} (${n})`).join(', ') + (titled.length < apps.length ? ` · ${apps.length - titled.length} applications have no title on record.` : ''),
      suggestion,
    })

    if (targetFamily) {
      const aligned = titled.filter((a) => titleFamily(a.title) === targetFamily).length
      const alignedPct = pct(aligned, titled.length)
      const interviewTitles = top(titled.filter((a) => a.interview), (a) => titleFamily(a.title), 2)
      checks.push({
        key: 'titles', question: 'Am I applying to the right titles for my strategy?', verdict: alignedPct >= 60 ? 'good' : alignedPct >= 30 ? 'watch' : 'act',
        headline: `${alignedPct}% of your applications match your target (${input.targetRole ?? input.targetFunction})`,
        detail: [
          `Your target is ${targetFamily}; most applications are ${lead ? lead[0] : 'other families'}.`,
          interviewTitles.length > 0 ? `Interviews came from: ${interviewTitles.map(([f]) => f).join(', ')}.` : null,
        ].filter(Boolean).join(' '),
        suggestion: alignedPct >= 60 ? null : `Either your search strategy or your applications should change: if ${lead ? lead[0] : 'these roles'} is the real goal, update your target on Search Strategy so coaching and matching follow it; if ${targetFamily} is, shift applications toward it.`,
      })
    }
  }

  // 8. Level
  if (input.levelRankScore !== null && titled.length >= 5) {
    const buckets = { up: [] as typeof titled, match: [] as typeof titled, down: [] as typeof titled }
    for (const a of titled) {
      const score = calibratedLevelRank(inferLevelFromTitle(a.title!), null)
      if (score === null) continue
      const diff = score - input.levelRankScore
      if (diff >= 10) buckets.up.push(a); else if (diff <= -10) buckets.down.push(a); else buckets.match.push(a)
    }
    const total = buckets.up.length + buckets.match.length + buckets.down.length
    if (total >= 5) {
      const rate = (xs: typeof titled) => (xs.length ? pct(xs.filter((a) => a.interview).length, xs.length) : null)
      const upShare = pct(buckets.up.length, total)
      const downShare = pct(buckets.down.length, total)
      let verdict: Verdict = 'good'
      let suggestion: string | null = null
      if (upShare >= 50 && (rate(buckets.up) ?? 0) < 3) {
        verdict = 'act'
        suggestion = 'Most applications are a reach above your current level with little response. Mix in level-for-level roles, and pursue step-ups through people who can vouch for you rather than cold applications.'
      } else if (downShare >= 40) {
        verdict = 'watch'
        suggestion = 'Many applications are a step down — these often end in “overqualified” rejections. If it’s deliberate, say why in a short note; otherwise aim at your level.'
      }
      checks.push({
        key: 'level', question: 'Am I reaching too far up, or down?', verdict,
        headline: `${upShare}% reach up · ${pct(buckets.match.length, total)}% at your level · ${downShare}% step down`,
        detail: [
          rate(buckets.up) !== null ? `Reach-up interview rate ${rate(buckets.up)}%` : null,
          rate(buckets.match) !== null ? `at-level ${rate(buckets.match)}%` : null,
          rate(buckets.down) !== null ? `step-down ${rate(buckets.down)}%` : null,
        ].filter(Boolean).join(' · ') + '.',
        suggestion,
      })
    }
  }

  // 9. Geography
  {
    const located = apps.filter((a) => a.location)
    if (located.length >= 5) {
      const remote = located.filter((a) => /remote/i.test(a.location!)).length
      const places = top(located, (a) => (/remote/i.test(a.location!) ? 'Remote' : a.location!.split(',')[0].trim()), 4)
      const concentrated = places[0] && pct(places[0][1], located.length) >= 70
      checks.push({
        key: 'geography', question: 'Should I widen my geography?', verdict: concentrated && (interviewRate ?? 0) < 3 ? 'watch' : 'good',
        headline: places.map(([p, n]) => `${p} (${n})`).join(', '),
        detail: `${pct(remote, located.length)}% of located roles are remote.`,
        suggestion: concentrated && (interviewRate ?? 0) < 3 ? 'Most roles are in one market with little response — add remote roles, or a second metro you’d travel to.' : null,
      })
    } else {
      const restricted = !input.openToRelocation && input.remotePreference && input.remotePreference !== 'remote' && input.remotePreference !== 'flexible'
      checks.push({
        key: 'geography', question: 'Should I widen my geography?', verdict: restricted && (interviewRate ?? 0) < 3 && apps.length >= 15 ? 'watch' : 'unknown',
        headline: restricted ? `You’re searching ${input.remotePreference}${input.homeMetro ? ` around ${input.homeMetro}` : ''}, not open to relocating` : 'Not enough location data on your applications',
        detail: 'Application emails rarely say where a role is, so this reads your stated preferences.',
        suggestion: restricted && (interviewRate ?? 0) < 3 && apps.length >= 15 ? 'A tight radius shrinks an already small pool of senior roles. Consider adding fully remote roles, or one more metro you’d commute or travel to.' : null,
      })
    }
  }

  // 10. Trend — last 4 weeks vs the 4 before
  const weeks: WeekPoint[] = []
  const monday = (d: Date) => { const x = new Date(d); const day = (x.getUTCDay() + 6) % 7; x.setUTCHours(0, 0, 0, 0); x.setUTCDate(x.getUTCDate() - day); return x }
  const thisWeek = monday(now)
  for (let i = 11; i >= 0; i--) {
    const start = new Date(thisWeek.getTime() - i * 7 * DAY)
    const end = new Date(start.getTime() + 7 * DAY)
    const inWeek = (d: Date | null) => !!d && d >= start && d < end
    weeks.push({
      weekStart: start,
      applied: apps.filter((a) => inWeek(a.appliedAt)).length,
      interviews: events.filter((e) => (e.type === 'INTERVIEW_INVITE' || e.type === 'OFFER') && inWeek(e.at)).length,
      rejections: events.filter((e) => e.type === 'REJECTION' && inWeek(e.at)).length,
    })
  }
  {
    const sum = (xs: WeekPoint[], k: keyof Omit<WeekPoint, 'weekStart'>) => xs.reduce((s, w) => s + w[k], 0)
    const recent = weeks.slice(-4)
    const prior = weeks.slice(-8, -4)
    const ra = sum(recent, 'applied'), pa = sum(prior, 'applied')
    const ri = sum(recent, 'interviews'), pi = sum(prior, 'interviews')
    if (ra + pa >= 5) {
      const direction = ra > pa * 1.2 ? 'up' : ra < pa * 0.8 ? 'down' : 'flat'
      checks.push({
        key: 'trend', question: 'What’s the trend?', verdict: direction === 'down' && ri <= pi ? 'watch' : 'good',
        headline: `Applications ${direction === 'flat' ? 'steady' : direction} — ${ra} in the last 4 weeks vs ${pa} before`,
        detail: `Interviews: ${ri} vs ${pi}. Rejections: ${sum(recent, 'rejections')} vs ${sum(prior, 'rejections')}.`,
        suggestion: direction === 'down' && ri <= pi ? 'Momentum is slowing. Set a weekly floor (applications plus conversations) and protect the time for it.' : null,
      })
    }
  }

  const rank: Record<Verdict, number> = { act: 0, watch: 1, good: 2, unknown: 3 }
  const ideas = [...checks]
    .filter((c) => c.suggestion && (c.verdict === 'act' || c.verdict === 'watch'))
    .sort((a, b) => rank[a.verdict] - rank[b.verdict])
    .map((c) => c.suggestion!)
    .slice(0, 5)

  return {
    totals: { applications: apps.length, interviews, rejections, offers, noReplyYet: noReply.length },
    interviewRate,
    checks,
    ideas,
    weeks,
  }
}
