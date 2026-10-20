import { prisma } from '@/lib/prisma'
import { newReferralCode } from '@/lib/candidates/referral'

// A cohort launch kit is a few ReferralLinks whose label is `lc:<cohortId>:<source>`.
// Anyone who registers after following one lands in that LayoffCohort (see
// applyReferralCookie), and the source tells us which handout or email worked.
// No schema change: the label carries the cohort and the source.

export const KIT_SOURCES = [
  { source: 'hr', label: 'HR paste-in', note: 'Pasted into the employer’s own message to affected staff' },
  { source: 'partner', label: 'Partner handout', note: 'Workforce board, Rapid Response, or career center handout' },
  { source: 'email', label: 'Outreach email', note: 'Cold or follow-up email to a contact' },
] as const
export type KitSource = (typeof KIT_SOURCES)[number]['source']

// Fewer joined than this and the count is withheld, so a small cohort cannot be read person by person.
export const KIT_MIN_COUNT = 10

export function kitLabel(cohortId: string, source: KitSource): string {
  return `lc:${cohortId}:${source}`
}

export function parseKitLabel(label: string): { cohortId: string; source: string } | null {
  const m = /^lc:([^:]+):([a-z]+)$/.exec(label)
  return m ? { cohortId: m[1], source: m[2] } : null
}

/** The public URL for a kit link: the tracked redirect, then the landing page, tagged with its source. */
export function kitUrl(appUrl: string, code: string, source: string, landing = '/'): string {
  const sep = landing.includes('?') ? '&' : '?'
  const to = `${landing}${sep}utm_source=${source}&utm_medium=cohort_kit`
  return `${appUrl.replace(/\/$/, '')}/api/r/${code}?to=${encodeURIComponent(to)}`
}

/** Makes sure the cohort has one active link per source; returns them all. */
export async function ensureKitLinks(cohortId: string, createdBy: string | null) {
  const existing = await prisma.referralLink.findMany({ where: { label: { startsWith: `lc:${cohortId}:` } } })
  for (const { source } of KIT_SOURCES) {
    const label = kitLabel(cohortId, source)
    if (existing.some((l) => l.label === label)) continue
    existing.push(await prisma.referralLink.create({ data: { code: newReferralCode(), label, kind: 'EMPLOYER', createdBy } }))
  }
  return existing
}

export type KitSourceStats = { source: string; label: string; clicks: number; joined: number | null }

/** Clicks and joins per source. A joined count under KIT_MIN_COUNT is null. */
export async function kitStats(cohortId: string): Promise<{ sources: KitSourceStats[]; totalJoined: number | null }> {
  const links = await prisma.referralLink.findMany({ where: { label: { startsWith: `lc:${cohortId}:` } }, select: { id: true, label: true, clickCount: true } })
  const counts = await prisma.candidateReferral.groupBy({ by: ['referralLinkId'], where: { referralLinkId: { in: links.map((l) => l.id) } }, _count: { _all: true } })
  const byLink = new Map(counts.map((c) => [c.referralLinkId, c._count._all]))
  const total = [...byLink.values()].reduce((a, b) => a + b, 0)
  const sources = KIT_SOURCES.map(({ source, label }) => {
    const link = links.find((l) => parseKitLabel(l.label)?.source === source)
    const joined = link ? byLink.get(link.id) ?? 0 : 0
    return { source, label, clicks: link?.clickCount ?? 0, joined: total >= KIT_MIN_COUNT ? joined : null }
  })
  return { sources, totalJoined: total >= KIT_MIN_COUNT ? total : null }
}

export function hrBlurb(companyName: string, url: string): string {
  return [
    `If you are affected by the changes at ${companyName}, NextChapter is offering a free, private job-search workspace to people in your position.`,
    `It helps you see where your experience is most in demand, tailor your resume, and plan your next steps. Nothing is shared with ${companyName} unless you choose to share it.`,
    url,
  ].join('\n\n')
}

export function welcomeCopy(companyName: string): { title: string; body: string } {
  return {
    title: `Welcome, former ${companyName} colleague`,
    body: `You are in a group with other people who left ${companyName}. Start with your profile, then look at where your skills are most in demand. You decide what, if anything, is visible to others.`,
  }
}
