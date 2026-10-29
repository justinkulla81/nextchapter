import 'server-only'
import { prisma } from '@/lib/prisma'
import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { MIN_PER_SIDE } from '@/lib/skills/ai-market'
import { LEAD_LIST_KEY } from '@/lib/leads/lifecycle/config'
import { fileLeadInCrm, isInternalAddress } from '@/lib/leads/lifecycle/file-lead'
import { lifecycleAddresses } from '@/lib/leads/lifecycle/run'
import { MAX_SENDS_PER_RUN, NURTURE_REF_PREFIX, NURTURE_STEPS, nurtureDailyCap, nurtureEmailsOn, type NurtureStep } from './config'
import type { NurtureFacts } from './content'
import { gatherNurtureLeads } from './gather'
import { ledgerRefs, planNurture, type PlannedSend } from './plan'
import { sendNurtureEmail } from './send'
import type { NurtureLeadKind, NurtureTrack } from './tracks'

const REF_CHUNK = 400 // addresses per ledger query

const CHANNEL: Record<NurtureLeadKind, string> = {
  journey: 'Journey picker',
  deadline: 'Deadline reminders',
  layoff_alert: 'Layoff alert',
  pay_check: 'Pay check',
  guide: 'Guide download',
}

export interface NurtureSummary {
  mode: 'on' | 'dry-run'
  /** Distinct addresses with a lead in the last 30 days. */
  considered: number
  ownedByLifecycle: number
  registered: number
  stopped: number
  notDue: number
  /** Due now. In dry run this is what would go out; in on mode, what was attempted. */
  due: number
  /** Due now, per step and per track. */
  byStep: Record<NurtureStep, number>
  byTrack: Partial<Record<NurtureTrack, number>>
  /** On mode only. */
  sent: number
  failed: number
  /** Due but over today's cap (or the per-run limit): picked up on a later run while still inside their window. */
  overCap: number
  dailyCap: number
  sentToday: number
  /** The subjects that are due (no addresses). */
  sampleSubjects: string[]
  /** The date of the AI-pay figures the data-point emails quote, or null when they fall back to the long-search figure. */
  aiFactsAsOf: string | null
}

async function loadFacts(): Promise<NurtureFacts> {
  try {
    const live = await loadAiMarket()
    const o = live?.overall
    if (!live || !o || o.nAi < MIN_PER_SIDE || o.nBase < MIN_PER_SIDE) return { ai: null }
    return { ai: { rawPct: o.rawPct, likePct: o.likePct ?? null, nAi: o.nAi, nBase: o.nBase, asOf: live.asOf } }
  } catch {
    return { ai: null }
  }
}

async function sentToday(now: Date): Promise<number> {
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  return prisma.crmActivity.count({ where: { type: 'EMAIL', sourceRef: { startsWith: NURTURE_REF_PREFIX }, createdAt: { gte: start } } })
}

/**
 * The sequence pass, run daily by the cron. For everyone who gave us an email on the site and is not covered by the lifecycle
 * emails: skip anyone registered, unsubscribed, bounced or complained, send the one step that is due (day 3, 7 or 14 after the
 * capture's own email), at most NURTURE_DAILY_CAP a day. Sends nothing until NURTURE_EMAILS=1; until then it reports what
 * it would send (counts and subjects, never addresses) and writes nothing.
 */
export async function runLeadNurture(now = new Date()): Promise<NurtureSummary> {
  const sendOn = nurtureEmailsOn()
  const dailyCap = nurtureDailyCap()
  const summary: NurtureSummary = {
    mode: sendOn ? 'on' : 'dry-run',
    considered: 0,
    ownedByLifecycle: 0,
    registered: 0,
    stopped: 0,
    notDue: 0,
    due: 0,
    byStep: { next_step: 0, data_point: 0, assessment: 0 },
    byTrack: {},
    sent: 0,
    failed: 0,
    overCap: 0,
    dailyCap,
    sentToday: 0,
    sampleSubjects: [],
    aiFactsAsOf: null,
  }

  const { leads: gathered, unsubscribed } = await gatherNurtureLeads(now)
  const leads = gathered.filter((l) => !isInternalAddress(l.email))
  if (leads.length === 0) return summary

  const emails = [...new Set(leads.map((l) => l.email))]
  const [lifecycleOwned, facts] = await Promise.all([lifecycleAddresses(now), loadFacts()])
  summary.aiFactsAsOf = facts.ai?.asOf ?? null

  const [persons, profiles, suppressed, members] = await Promise.all([
    prisma.crmPerson.findMany({ where: { deletedAt: null, OR: [{ email: { in: emails } }, { emails: { hasSome: emails } }] }, select: { email: true, emails: true, candidateId: true } }),
    prisma.candidateProfile.findMany({ where: { registrationCompletedAt: { not: null }, email: { in: emails, mode: 'insensitive' } }, select: { email: true } }),
    prisma.mailingSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } }),
    prisma.mailingListMember.findMany({ where: { email: { in: emails }, list: { key: LEAD_LIST_KEY } }, select: { email: true, status: true } }),
  ])
  const sent = new Map<string, Date>()
  for (let i = 0; i < emails.length; i += REF_CHUNK) {
    const refs = emails.slice(i, i + REF_CHUNK).flatMap((e) => ledgerRefs(e))
    const rows = await prisma.crmActivity.findMany({ where: { type: 'EMAIL', sourceRef: { in: refs } }, select: { sourceRef: true, occurredAt: true } })
    for (const r of rows) if (r.sourceRef) sent.set(r.sourceRef, r.occurredAt)
  }

  // A member is anyone with a finished registration (a profile with this address) or a CRM person linked to a candidate.
  const registered = new Set<string>()
  for (const p of profiles) if (p.email) registered.add(p.email.trim().toLowerCase())
  for (const p of persons) {
    if (!p.candidateId) continue
    for (const e of [p.email, ...p.emails]) if (e) registered.add(e.trim().toLowerCase())
  }

  const { sends, counts } = planNurture({
    now,
    leads,
    unsubscribed,
    suppressed: new Set(suppressed.map((s) => s.email)),
    offList: new Set(members.filter((m) => m.status !== 'ACTIVE').map((m) => m.email)),
    registered,
    lifecycleOwned,
    sent,
    facts,
  })
  Object.assign(summary, counts)
  summary.due = sends.length
  const subjects = new Set<string>()
  for (const s of sends) {
    summary.byStep[s.step]++
    summary.byTrack[s.track] = (summary.byTrack[s.track] ?? 0) + 1
    if (subjects.size < 8) subjects.add(`${s.step}: ${s.content.subject}`)
  }
  summary.sampleSubjects = [...subjects]

  summary.sentToday = await sentToday(now)
  const budget = Math.max(0, Math.min(MAX_SENDS_PER_RUN, dailyCap - summary.sentToday))
  summary.overCap = Math.max(0, sends.length - budget)
  if (!sendOn) return summary

  const queue: PlannedSend[] = sends.slice(0, budget)
  for (const s of queue) {
    const personId = await fileLeadInCrm({ email: s.email, channel: CHANNEL[s.kind], capturedAt: s.anchor })
    if (!personId) {
      summary.failed++
      continue
    }
    const ok = await sendNurtureEmail({ email: s.email, kind: s.kind, track: s.track, step: s.step, content: s.content, personId })
    if (ok) summary.sent++
    else summary.failed++
  }
  return summary
}

export { NURTURE_STEPS }
