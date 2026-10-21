import 'server-only'
import { prisma } from '@/lib/prisma'
import { humanOpens } from './event-rules'
import { replyClassOf, type ReplyClass } from './reply-class'
import { pValue, sendsNeeded } from './stats'

const REPLY_WINDOW_MS = 14 * 86_400_000
/** Sends per side that would settle a 10% against 20% reply difference; used for progress when two rates are too close to size a test. */
const DEFAULT_TARGET = 200

export interface CampaignDef {
  slug: string
  title: string
  question: string
  audience: string
  templates: string[]
  /** The head-to-head: each side's label and the variant codes it covers. */
  a: { label: string; variants: string[] }
  b: { label: string; variants: string[] }
}

export const CAMPAIGNS: CampaignDef[] = [
  { slug: 'employers', title: 'Employers: subject line', question: 'Which kind of subject line gets employers to reply?', audience: 'Employers', templates: ['head_hr', 'rewards', 'er', 'ta'], a: { label: 'Support offered', variants: ['C1a', 'C1b'] }, b: { label: 'New data', variants: ['C2a', 'C2b'] } },
  { slug: 'higher-ed', title: 'Colleges: community vs four-year', question: 'Who responds more, community colleges or four-year colleges?', audience: 'Higher ed', templates: ['college'], a: { label: 'Community colleges', variants: ['CC'] }, b: { label: 'Four-year colleges', variants: ['4YR'] } },
  { slug: 'workforce-boards', title: 'Workforce boards: growing vs flat metros', question: 'Do boards in growing metros respond more than boards in flat ones?', audience: 'Workforce boards', templates: ['board'], a: { label: 'Growing metros', variants: ['GROW'] }, b: { label: 'Flat metros', variants: ['FLAT'] } },
  { slug: 'job-centers', title: 'Job centers: subject line', question: 'Which kind of subject line gets job centers to reply?', audience: 'American Job Centers', templates: ['ajc'], a: { label: 'Support offered', variants: ['C1a', 'C1b'] }, b: { label: 'New data', variants: ['C2a', 'C2b'] } },
]

export const TIMING_NAME: Record<string, string> = { T1: 'Right after the filing', T2: 'About 2 weeks later', T3: 'Just before it takes effect', T4: 'After it takes effect', T5: 'Late, after it took effect' }

export interface Recipient {
  personId: string; name: string; email: string; orgId: string | null; orgName: string
  campaign: string | null; audience: string; template: string; variant: string; arm: string; timing: string | null
  firstSentAt: Date; steps: number; humanOpens: number; clicked: boolean; bounced: boolean
  replyClass: ReplyClass | null; repliedAt: Date | null
}
export interface ArmStat { label: string; variants: string[]; sends: number; replies: number; positive: number; clicks: number; reopens: number; bounces: number }
export interface Verdict { state: 'empty' | 'early' | 'leaning' | 'winner' | 'tied'; headline: string; detail: string; leader: string | null; progress: number; needed: number | null; technical: string }
export interface CampaignResult { def: CampaignDef; a: ArmStat; b: ArmStat; verdict: Verdict; totalSent: number }
export interface TimingStat { key: string; label: string; sends: number; replies: number; clicks: number }

const parse = (o: string | null) => ({
  step: Number(/email (\d)/.exec(o ?? '')?.[1] ?? 1),
  template: /template (\S+?)(,|$)/.exec(o ?? '')?.[1] ?? 'unknown',
  variant: /variant ([A-Za-z0-9]+)/.exec(o ?? '')?.[1] ?? 'A',
  timing: /timing (T\d)/.exec(o ?? '')?.[1] ?? null,
  timingTest: /timing_test yes/.test(o ?? ''),
})
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '0%')

function verdictFor(a: ArmStat, b: ArmStat): Verdict {
  const tech = (p: number) => `p=${p.toFixed(2)}`
  if (!a.sends && !b.sends) return { state: 'empty', headline: 'No emails sent yet', detail: 'Results appear here as soon as the first emails go out.', leader: null, progress: 0, needed: null, technical: '' }
  // Replies are the main measure; if neither side has one, real clicks decide.
  const useClicks = a.replies + b.replies === 0
  const ha = useClicks ? a.clicks : a.replies, hb = useClicks ? b.clicks : b.replies
  const rateA = a.sends ? ha / a.sends : 0, rateB = b.sends ? hb / b.sends : 0
  const need = a.sends && b.sends ? sendsNeeded(rateA, rateB) : null
  const target = Math.min(Math.max(need ?? DEFAULT_TARGET, 50), 600)
  const progress = Math.min(1, Math.min(a.sends, b.sends) / target)
  const measure = useClicks ? 'clicks' : 'replies'
  const p = pValue({ sends: a.sends, hits: ha }, { sends: b.sends, hits: hb })
  if (ha + hb === 0) return { state: 'early', headline: 'No replies or clicks yet', detail: `${a.sends + b.sends} emails sent. Replies usually take a few days to arrive, and follow-ups go out after 3 and 7 business days.`, leader: null, progress, needed: null, technical: '' }
  const leader = rateA === rateB ? null : rateA > rateB ? a.label : b.label
  const line = `${a.label} ${pct(ha, a.sends)} against ${b.label} ${pct(hb, b.sends)} ${measure}`
  if (Math.min(a.sends, b.sends) >= 30 && p < 0.05 && leader) return { state: 'winner', headline: `${leader} is winning`, detail: `${line}. The gap is large enough that it is very unlikely to be chance.`, leader, progress, needed: null, technical: tech(p) }
  if (!leader) return { state: 'tied', headline: 'Even so far', detail: `${line}.`, leader: null, progress, needed: need, technical: tech(p) }
  return { state: Math.min(a.sends, b.sends) < 30 ? 'early' : 'leaning', headline: Math.min(a.sends, b.sends) < 30 ? 'Too early to call' : `${leader} is ahead, not proven`, detail: `${line}. ${need ? `About ${need} sends per side would settle a gap this size.` : 'More sends are needed before this means anything.'}`, leader, progress, needed: need, technical: tech(p) }
}

const emptyArm = (label: string, variants: string[]): ArmStat => ({ label, variants, sends: 0, replies: 0, positive: 0, clicks: 0, reopens: 0, bounces: 0 })

/** Everything the Outreach tests pages show, from the CRM: one row per person emailed, and each campaign's two sides with a plain-language verdict. */
export async function outreachData() {
  const acts = await prisma.crmActivity.findMany({
    where: { type: 'EMAIL', direction: 'OUTBOUND', outcome: { startsWith: 'Cold outreach' }, personId: { not: null } },
    select: { personId: true, occurredAt: true, outcome: true },
    orderBy: { occurredAt: 'asc' },
  })
  const ids = [...new Set(acts.map((a) => a.personId!))]
  const [people, inbound] = await Promise.all([
    prisma.crmPerson.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, email: true, affiliations: { where: { isCurrent: true }, select: { org: { select: { id: true, name: true } } }, take: 1 } } }),
    prisma.crmActivity.findMany({ where: { type: 'EMAIL', direction: 'INBOUND', personId: { in: ids } }, select: { personId: true, occurredAt: true, outcome: true }, orderBy: { occurredAt: 'asc' } }),
  ])
  const personBy = new Map(people.map((p) => [p.id, p]))
  const defOf = (template: string) => CAMPAIGNS.find((c) => c.templates.includes(template)) ?? null
  const armLabel = (def: CampaignDef | null, variant: string) => (def ? (def.a.variants.includes(variant) ? def.a.label : def.b.variants.includes(variant) ? def.b.label : variant) : variant)

  const byPerson = new Map<string, Recipient>()
  for (const a of acts) {
    const { step, template, variant, timing } = parse(a.outcome)
    const person = personBy.get(a.personId!)
    if (!person) continue
    const def = defOf(template)
    let r = byPerson.get(a.personId!)
    if (!r || step === 1) {
      const org = person.affiliations[0]?.org
      r = {
        personId: person.id, name: person.fullName, email: person.email ?? '', orgId: org?.id ?? null, orgName: org?.name ?? '',
        campaign: def?.slug ?? null, audience: def?.audience ?? 'Other', template, variant, arm: armLabel(def, variant), timing,
        firstSentAt: a.occurredAt, steps: 1, humanOpens: 0, clicked: false, bounced: false, replyClass: null, repliedAt: null,
      }
      byPerson.set(a.personId!, r)
    }
    r.steps = Math.max(r.steps, step)
    if (step === 1) {
      r.humanOpens = humanOpens(a.outcome)
      r.clicked = /, clicked(,|$)/.test(a.outcome ?? '')
      r.bounced = /, bounced/.test(a.outcome ?? '')
    }
  }
  for (const i of inbound) {
    const r = byPerson.get(i.personId!)
    if (!r || i.occurredAt < r.firstSentAt || i.occurredAt.getTime() - r.firstSentAt.getTime() > REPLY_WINDOW_MS) continue
    const c = replyClassOf(i.outcome)
    if (c === 'auto') continue // an out-of-office is not a person replying
    if (!r.repliedAt) { r.repliedAt = i.occurredAt; r.replyClass = c ?? 'other' }
    else if (c === 'positive') r.replyClass = 'positive'
  }
  const recipients = [...byPerson.values()].sort((a, b) => b.firstSentAt.getTime() - a.firstSentAt.getTime())

  const tally = (rows: Recipient[], arm: ArmStat) => {
    for (const r of rows) {
      arm.sends++
      if (r.repliedAt) { arm.replies++; if (r.replyClass === 'positive' || r.replyClass === 'referral') arm.positive++ }
      if (r.clicked) arm.clicks++
      if (r.humanOpens >= 2) arm.reopens++
      if (r.bounced) arm.bounces++
    }
    return arm
  }
  const campaigns: CampaignResult[] = CAMPAIGNS.map((def) => {
    const mine = recipients.filter((r) => r.campaign === def.slug)
    const a = tally(mine.filter((r) => def.a.variants.includes(r.variant)), emptyArm(def.a.label, def.a.variants))
    const b = tally(mine.filter((r) => def.b.variants.includes(r.variant)), emptyArm(def.b.label, def.b.variants))
    return { def, a, b, verdict: verdictFor(a, b), totalSent: mine.length }
  })

  // The timing test: only employers assigned while all four windows were open count.
  const timing = new Map<string, TimingStat>()
  for (const a of acts) {
    const p = parse(a.outcome)
    if (p.step !== 1 || !p.timing || !p.timingTest) continue
    const r = byPerson.get(a.personId!)
    const t = timing.get(p.timing) ?? { key: p.timing, label: TIMING_NAME[p.timing] ?? p.timing, sends: 0, replies: 0, clicks: 0 }
    t.sends++
    if (r?.repliedAt) t.replies++
    if (r?.clicked) t.clicks++
    timing.set(p.timing, t)
  }

  const replies = recipients.filter((r) => r.repliedAt).sort((a, b) => b.repliedAt!.getTime() - a.repliedAt!.getTime())
  const warm = recipients.filter((r) => !r.repliedAt && (r.humanOpens >= 2 || r.clicked)).sort((a, b) => Number(b.clicked) - Number(a.clicked) || b.humanOpens - a.humanOpens)
  return {
    recipients, campaigns, timing: [...timing.values()].sort((a, b) => a.key.localeCompare(b.key)), replies, warm,
    totals: { sent: recipients.length, replies: replies.length, positive: replies.filter((r) => r.replyClass === 'positive' || r.replyClass === 'referral').length, clicks: recipients.filter((r) => r.clicked).length, warm: warm.length, bounced: recipients.filter((r) => r.bounced).length },
  }
}
