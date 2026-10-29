import 'server-only'
import { prisma } from '@/lib/prisma'
import { getPublicJob } from '@/lib/jobs/public-job-page-server'
import { LEAD_LIST_KEY, MIN_NUDGE_GAP_MS, NUDGE_DAYS, WELCOME_WINDOW_MS, lifecycleEmailsOn, waitlistVariant, type LeadStep, type LeadVariant } from './config'
import { fileLeadInCrm, isInternalAddress } from './file-lead'
import { lifecycleRef, sendLifecycleEmail } from './send'

const DAY_MS = 24 * 60 * 60 * 1000
const LOOKBACK_MS = 30 * DAY_MS
const MAX_SENDS_PER_RUN = 100

// One variant per address when someone gave us their email in more than one
// place: the strongest signal of intent wins.
const PRIORITY: LeadVariant[] = ['applied_job', 'saved_job', 'job_alert', 'waitlist', 'newsletter', 'waitlist_b2b']

interface Lead {
  email: string
  name: string | null
  variant: LeadVariant
  channel: string
  detail: string | null
  capturedAt: Date
  /** When an earlier system already sent the welcome, so the reminders count from then. None do today. */
  welcomeSentAt: Date | null
}

const clean = (email: string) => email.trim().toLowerCase()

async function gatherLeads(now: Date): Promise<{ leads: Lead[]; unsubscribed: Set<string> }> {
  const since = new Date(now.getTime() - LOOKBACK_MS)
  const [saved, alerts, newsletter, waitlist, unsubHome, unsubNews] = await Promise.all([
    prisma.homepageLead.findMany({
      where: { kind: 'apply_save', createdAt: { gte: since }, unsubscribedAt: null },
      select: { email: true, searchQ: true, followup: true, createdAt: true },
    }),
    // An alert counts from the click that confirmed it: before that they have not said yes.
    prisma.homepageLead.findMany({
      where: { kind: 'job_alert', confirmedAt: { gte: since }, unsubscribedAt: null },
      select: { email: true, searchQ: true, searchLoc: true, confirmedAt: true },
    }),
    prisma.newsletterSubscriber.findMany({ where: { createdAt: { gte: since }, unsubscribedAt: null }, select: { email: true, createdAt: true } }),
    prisma.waitlistSignup.findMany({ where: { createdAt: { gte: since } }, select: { audience: true, payload: true, createdAt: true } }),
    prisma.homepageLead.findMany({ where: { unsubscribedAt: { not: null } }, select: { email: true } }),
    prisma.newsletterSubscriber.findMany({ where: { unsubscribedAt: { not: null } }, select: { email: true } }),
  ])

  const jobIds = [...new Set(saved.map((s) => s.searchQ))]
  const jobLabel = new Map<string, string>()
  await Promise.all(
    jobIds.map(async (id) => {
      const job = await getPublicJob(id).catch(() => null)
      if (job?.title) jobLabel.set(id, job.companyName ? `${job.title} at ${job.companyName}` : job.title)
    }),
  )

  const leads: Lead[] = []
  for (const s of saved) {
    // Went on to the employer (Apply click, or the prompt before it) versus only saving the job.
    const applied = s.followup === 'apply_click' || s.followup === 'apply_gate'
    leads.push({ email: clean(s.email), name: null, variant: applied ? 'applied_job' : 'saved_job', channel: applied ? 'Applied job' : 'Saved job', detail: jobLabel.get(s.searchQ) ?? null, capturedAt: s.createdAt, welcomeSentAt: null })
  }
  for (const a of alerts) {
    if (!a.confirmedAt) continue
    const detail = [a.searchQ, a.searchLoc && `in ${a.searchLoc}`].filter(Boolean).join(' ') || null
    leads.push({ email: clean(a.email), name: null, variant: 'job_alert', channel: 'Job alert', detail, capturedAt: a.confirmedAt, welcomeSentAt: null })
  }
  for (const n of newsletter) {
    leads.push({ email: clean(n.email), name: null, variant: 'newsletter', channel: 'Newsletter', detail: null, capturedAt: n.createdAt, welcomeSentAt: null })
  }
  for (const w of waitlist) {
    const variant = waitlistVariant(w.audience)
    const payload = w.payload as Record<string, unknown> | null
    if (!variant || typeof payload?.email !== 'string') continue
    leads.push({
      email: clean(payload.email),
      name: typeof payload.name === 'string' ? payload.name : null,
      variant,
      channel: 'Waitlist',
      detail: w.audience,
      capturedAt: w.createdAt,
      welcomeSentAt: null,
    })
  }

  const unsubscribed = new Set([...unsubHome, ...unsubNews].map((r) => clean(r.email)))
  return { leads, unsubscribed }
}


/**
 * Every address the lifecycle emails cover right now (a saved or applied job, a confirmed job alert, the newsletter, a waitlist
 * signup, from the last 30 days). The nurture sequence (src/lib/leads/nurture) leaves these addresses to the lifecycle emails,
 * so nobody gets both.
 */
export async function lifecycleAddresses(now = new Date()): Promise<Set<string>> {
  const { leads } = await gatherLeads(now)
  return new Set(leads.map((l) => clean(l.email)))
}

export interface StepState {
  now: Date
  variant: LeadVariant
  capturedAt: Date
  /** When the welcome went out (by us, or by the older saved-job email). Null = not yet. */
  welcomeAt: Date | null
  nudge1At: Date | null
  nudge2At: Date | null
}

/** The one email due to this address right now, or null. */
export function nextLifecycleStep(s: StepState): LeadStep | null {
  const now = s.now.getTime()
  if (!s.welcomeAt) return now - s.capturedAt.getTime() <= WELCOME_WINDOW_MS ? 'welcome' : null
  const days = NUDGE_DAYS[s.variant]
  const sinceWelcome = now - s.welcomeAt.getTime()
  if (days[0] !== undefined && !s.nudge1At && sinceWelcome >= days[0] * DAY_MS) return 'nudge1'
  if (days[1] !== undefined && s.nudge1At && !s.nudge2At && sinceWelcome >= days[1] * DAY_MS && now - s.nudge1At.getTime() >= MIN_NUDGE_GAP_MS) return 'nudge2'
  return null
}

export interface LifecycleSummary {
  mode: 'on' | 'dry-run'
  addresses: number
  registered: number
  stopped: number
  /** Per step: how many went out (mode on) or would go out (dry run). */
  steps: Record<LeadStep, number>
  failed: number
}

/**
 * The lifecycle pass, run every few minutes by the cron. For each address that
 * gave us an email on the site in the last 30 days: file them in the CRM, skip
 * anyone registered, unsubscribed or on the stop list, then send the next
 * email that is due (welcome within 48 hours of signing up, then the reminders
 * on the variant's schedule). Does nothing but file CRM records until
 * LEAD_LIFECYCLE_EMAILS=1; until then it reports what it would send.
 */
export async function runLeadLifecycle(now = new Date()): Promise<LifecycleSummary> {
  const sendOn = lifecycleEmailsOn()
  const summary: LifecycleSummary = { mode: sendOn ? 'on' : 'dry-run', addresses: 0, registered: 0, stopped: 0, steps: { welcome: 0, nudge1: 0, nudge2: 0 }, failed: 0 }

  const { leads, unsubscribed } = await gatherLeads(now)
  const byEmail = new Map<string, Lead>()
  for (const l of leads) {
    if (isInternalAddress(l.email)) continue
    const held = byEmail.get(l.email)
    if (!held || PRIORITY.indexOf(l.variant) < PRIORITY.indexOf(held.variant)) byEmail.set(l.email, l)
  }
  const emails = [...byEmail.keys()]
  summary.addresses = emails.length
  if (emails.length === 0) return summary

  const stepRefs = emails.flatMap((e) => (['welcome', 'nudge1', 'nudge2'] as const).map((s) => lifecycleRef(s, e)))
  const [persons, suppressed, members, sentRows] = await Promise.all([
    prisma.crmPerson.findMany({ where: { deletedAt: null, email: { in: emails } }, select: { id: true, email: true, candidateId: true } }),
    prisma.mailingSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } }),
    prisma.mailingListMember.findMany({ where: { email: { in: emails }, list: { key: LEAD_LIST_KEY } }, select: { email: true, status: true } }),
    prisma.crmActivity.findMany({ where: { type: 'EMAIL', sourceRef: { in: stepRefs } }, select: { sourceRef: true, occurredAt: true } }),
  ])
  const registeredEmails = new Set(persons.filter((p) => p.candidateId).map((p) => p.email!))
  const stopList = new Set(suppressed.map((s) => s.email))
  const offList = new Set(members.filter((m) => m.status !== 'ACTIVE').map((m) => m.email))
  const sentAt = new Map(sentRows.map((r) => [r.sourceRef!, r.occurredAt]))

  let sends = 0
  for (const [email, lead] of byEmail) {
    const personId = await fileLeadInCrm({ email, name: lead.name, channel: lead.channel, detail: lead.detail ?? undefined, b2b: lead.variant === 'waitlist_b2b', capturedAt: lead.capturedAt })

    if (registeredEmails.has(email)) {
      summary.registered++
      continue
    }
    if (unsubscribed.has(email) || stopList.has(email) || offList.has(email)) {
      summary.stopped++
      continue
    }

    const at = (s: LeadStep) => sentAt.get(lifecycleRef(s, email)) ?? null
    const step = nextLifecycleStep({
      now,
      variant: lead.variant,
      capturedAt: lead.capturedAt,
      welcomeAt: at('welcome') ?? lead.welcomeSentAt,
      nudge1At: at('nudge1'),
      nudge2At: at('nudge2'),
    })
    if (!step) continue

    if (!sendOn) {
      summary.steps[step]++
      continue
    }
    if (sends >= MAX_SENDS_PER_RUN || !personId) continue
    sends++
    const ok = await sendLifecycleEmail({
      email,
      variant: lead.variant,
      step,
      context: { firstName: lead.name?.split(' ')[0] ?? null, detail: lead.detail },
      personId,
    })
    if (ok) summary.steps[step]++
    else summary.failed++
  }
  return summary
}
