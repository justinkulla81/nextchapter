import 'server-only'
import { prisma } from '@/lib/prisma'
import { humanOpens } from './event-rules'
import { pValue, sendsNeeded } from './stats'

const REPLY_WINDOW_MS = 14 * 86_400_000

export const AUDIENCE_OF: Record<string, string> = {
  head_hr: 'Employers', rewards: 'Employers', er: 'Employers', ta: 'Employers',
  college: 'Higher ed', board: 'Workforce boards', ajc: 'American Job Centers',
}

export type ArmRow = { audience: string; variant: string; sends: number; replies: number; clicks: number; reopens: number; bounces: number }
export type Compare = { audience: string; label: string; a: string; b: string; replyP: number; clickP: number; need: number | null }
export type WarmPerson = { personId: string; name: string; org: string; email: string; humanOpens: number; clicked: boolean; sentAt: Date }

const parse = (o: string | null) => ({
  template: /template (\S+?)(,|$)/.exec(o ?? '')?.[1] ?? 'unknown',
  variant: /variant ([A-Za-z0-9]+)/.exec(o ?? '')?.[1] ?? 'A',
  timing: /timing (T\d)/.exec(o ?? '')?.[1] ?? null,
  timingTest: /timing_test yes/.test(o ?? ''),
})

/**
 * Cold outreach results from the CRM: each first email's arm, whether the person replied within 14 days, clicked the link
 * (a click in the first two minutes is a scanner and is not counted) and opened it again later. Opens are not a result.
 */
export async function outreachReport() {
  const sends = await prisma.crmActivity.findMany({
    where: { type: 'EMAIL', direction: 'OUTBOUND', outcome: { startsWith: 'Cold outreach, email 1' }, personId: { not: null } },
    select: { personId: true, occurredAt: true, outcome: true },
  })
  const ids = [...new Set(sends.map((s) => s.personId!))]
  const inbound = await prisma.crmActivity.findMany({ where: { type: 'EMAIL', direction: 'INBOUND', personId: { in: ids } }, select: { personId: true, occurredAt: true } })
  const inboundBy = new Map<string, Date[]>()
  for (const r of inbound) inboundBy.set(r.personId!, [...(inboundBy.get(r.personId!) ?? []), r.occurredAt])
  const replied = (personId: string, at: Date) => (inboundBy.get(personId) ?? []).some((t) => t >= at && t.getTime() - at.getTime() <= REPLY_WINDOW_MS)

  const arms = new Map<string, ArmRow>()
  const timing = new Map<string, ArmRow>()
  const warmSends: { personId: string; outcome: string | null; at: Date }[] = []
  for (const s of sends) {
    const { template, variant, timing: tm, timingTest } = parse(s.outcome)
    const audience = AUDIENCE_OF[template] ?? 'Other'
    const row = (m: Map<string, ArmRow>, key: string, label: string) => { const r = m.get(key) ?? { audience, variant: label, sends: 0, replies: 0, clicks: 0, reopens: 0, bounces: 0 }; m.set(key, r); return r }
    const hit = (r: ArmRow) => {
      r.sends++
      if (replied(s.personId!, s.occurredAt)) r.replies++
      if (/, clicked(,|$)/.test(s.outcome ?? '')) r.clicks++
      if (humanOpens(s.outcome) >= 2) r.reopens++
      if (/, bounced/.test(s.outcome ?? '')) r.bounces++
    }
    hit(row(arms, `${audience}|${variant}`, variant))
    if (tm && timingTest) hit(row(timing, tm, tm))
    if (((humanOpens(s.outcome) >= 2) || /, clicked(,|$)/.test(s.outcome ?? '')) && !(inboundBy.get(s.personId!) ?? []).length) warmSends.push({ personId: s.personId!, outcome: s.outcome, at: s.occurredAt })
  }

  const people = warmSends.length
    ? await prisma.crmPerson.findMany({ where: { id: { in: warmSends.map((w) => w.personId) } }, select: { id: true, fullName: true, email: true, affiliations: { where: { isCurrent: true }, select: { org: { select: { name: true } } }, take: 1 } } })
    : []
  const warm: WarmPerson[] = warmSends.map((w) => {
    const p = people.find((q) => q.id === w.personId)
    return { personId: w.personId, name: p?.fullName ?? '?', org: p?.affiliations[0]?.org.name ?? '', email: p?.email ?? '', humanOpens: humanOpens(w.outcome), clicked: /, clicked(,|$)/.test(w.outcome ?? ''), sentAt: w.at }
  }).sort((a, b) => Number(b.clicked) - Number(a.clicked) || b.humanOpens - a.humanOpens)

  // The head-to-head comparisons each audience is testing.
  const PAIRS: { audience: string; label: string; a: string[]; b: string[] }[] = [
    { audience: 'Employers', label: 'Subject concept: support offered vs new data', a: ['C1a', 'C1b'], b: ['C2a', 'C2b'] },
    { audience: 'Higher ed', label: 'Community colleges vs four-year', a: ['CC'], b: ['4YR'] },
    { audience: 'Workforce boards', label: 'Growing vs flat metros', a: ['GROW'], b: ['FLAT'] },
    { audience: 'American Job Centers', label: 'Subject concept: support offered vs new data', a: ['C1a', 'C1b'], b: ['C2a', 'C2b'] },
  ]
  const pool = (audience: string, variants: string[]) => [...arms.values()].filter((r) => r.audience === audience && variants.includes(r.variant)).reduce((x, r) => ({ sends: x.sends + r.sends, replies: x.replies + r.replies, clicks: x.clicks + r.clicks }), { sends: 0, replies: 0, clicks: 0 })
  const compares: Compare[] = PAIRS.map((p) => {
    const a = pool(p.audience, p.a), b = pool(p.audience, p.b)
    return {
      audience: p.audience, label: p.label, a: p.a.join(' + '), b: p.b.join(' + '),
      replyP: pValue({ sends: a.sends, hits: a.replies }, { sends: b.sends, hits: b.replies }),
      clickP: pValue({ sends: a.sends, hits: a.clicks }, { sends: b.sends, hits: b.clicks }),
      need: a.sends && b.sends ? sendsNeeded(a.replies / a.sends, b.replies / b.sends) : null,
    }
  })
  const rank = (a: ArmRow, b: ArmRow) => a.audience.localeCompare(b.audience) || a.variant.localeCompare(b.variant)
  return {
    totalSent: sends.length, replies: [...arms.values()].reduce((n, r) => n + r.replies, 0), clicks: [...arms.values()].reduce((n, r) => n + r.clicks, 0),
    arms: [...arms.values()].sort(rank), timing: [...timing.values()].sort((a, b) => a.variant.localeCompare(b.variant)), compares, warm,
  }
}
