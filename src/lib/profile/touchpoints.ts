import 'server-only'
import { loadStrengths } from './strengths-load'
import { loadWorkProfile } from './work-profile-load'
import { loadAddressableMarket } from './addressable-market'
import { describe, LESS_OPTIONS, MORE_OPTIONS, missingDims, readLikes, WORK_DIMS } from './work-profile'
import { prisma } from '@/lib/prisma'

// What the personalization layer says in the daily touchpoints (Weekly
// Sprint, Job Search Daily, coach briefs): one source so they agree. No AI.

export type ProfileNudge = { key: string; lead: string; text: string; href: string }

// Ranked: the most useful thing first. `market` adds the job-market check
// (slower: market rows plus pivot paths), for the daily email and the sprint.
export async function profileNudges(candidateId: string, opts: { market?: boolean } = {}): Promise<ProfileNudge[]> {
  const [st, wp, row, mkt] = await Promise.all([
    loadStrengths(candidateId).catch(() => null),
    loadWorkProfile(candidateId).catch(() => null),
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { workStyleAnswers: true } }),
    opts.market ? loadAddressableMarket(candidateId).catch(() => null) : Promise.resolve(null),
  ])
  const out: ProfileNudge[] = []
  const flag = mkt?.flags[0]
  if (flag && (flag.key === 'narrow' || flag.key === 'geo' || flag.key === 'shrinking')) {
    out.push({ key: `market-${flag.key}`, lead: flag.title, text: 'Add one expansion (a nearby state, remote, or a pivot role that uses your skills) so more jobs reach you.', href: '/dashboard/market' })
  }
  if (st && st.shape !== 'emerging') {
    const lead = st.shape === 'peaked' ? st.peaks[0] : st.broad[0]
    if (lead) out.push({ key: `strength-${lead.key}`, lead: `Lead with ${lead.label.toLowerCase()}`, text: 'Open the first line of your next application or outreach with one example of it.', href: '/dashboard/strengths' })
  } else if (st?.missing.length) {
    out.push({ key: 'strength-sharpen', lead: 'Find your standout strength', text: `${st.missing[0]}.`, href: '/dashboard/strengths' })
  }
  const likes = readLikes(row?.workStyleAnswers)
  if (!likes.less.length && !likes.more.length) {
    out.push({ key: 'likes', lead: 'What do you want to leave behind?', text: 'Tap what you want less of and more of; your pivot paths and job matches re-rank.', href: '/dashboard/pivot-paths' })
  }
  if (wp && missingDims(wp).length >= 3) {
    out.push({ key: 'work-style', lead: 'How do you like to work?', text: `${missingDims(wp).length} quick this-or-that questions sharpen your matches.`, href: '/dashboard/skills-assessment' })
  }
  if (flag?.key === 'ai') out.push({ key: 'market-ai', lead: flag.title, text: 'Add one AI course to this week’s plan.', href: '/dashboard/learning' })
  return out
}

export type CoachProfileContext = {
  strengths: { headline: string; lead: { label: string; evidence: string[] }[] } | null
  workStyle: string[]
  less: string[]
  more: string[]
  market: { title: string; detail: string }[]
}

// For coaches: what the person is best at, how they like to work, what they
// want to leave behind and toward, and any market flags. Never their private
// weak spots.
export async function coachProfileContext(candidateId: string): Promise<CoachProfileContext> {
  const [st, wp, row, mkt] = await Promise.all([
    loadStrengths(candidateId).catch(() => null),
    loadWorkProfile(candidateId).catch(() => null),
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { workStyleAnswers: true } }),
    loadAddressableMarket(candidateId).catch(() => null),
  ])
  const likes = readLikes(row?.workStyleAnswers)
  return {
    strengths: st && st.shape !== 'emerging' ? { headline: st.headline, lead: (st.shape === 'peaked' ? st.peaks : st.broad.slice(0, 4)).map((x) => ({ label: x.label, evidence: x.evidence })) } : null,
    workStyle: wp ? WORK_DIMS.filter((d) => wp[d.key] && Math.abs(wp[d.key]!.value) >= 0.4 && wp[d.key]!.confidence >= 0.5).map((d) => describe(d.key, wp[d.key]!.value)) : [],
    less: likes.less.map((k) => LESS_OPTIONS.find((o) => o.key === k)!.label),
    more: likes.more.map((k) => MORE_OPTIONS.find((o) => o.key === k)!.label),
    market: mkt?.flags.map((f) => ({ title: f.title, detail: f.detail })) ?? [],
  }
}
