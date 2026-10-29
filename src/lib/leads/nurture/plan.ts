import { NURTURE_STEPS, nurtureRef, type NurtureStep } from './config'
import { nurtureContent, type NurtureEmail, type NurtureFacts } from './content'
import { nextNurtureStep } from './schedule'
import { KIND_PRIORITY, type NurtureLeadKind, type NurtureTrack } from './tracks'
import type { NurtureLead } from './gather'

// Who gets which email right now: a pure function of the leads and the state of the world, so every rule is tested
// without a database (src/test/lead-nurture-plan.test.ts). The runner (run.ts) gathers the inputs and does the sending.

export interface PlanInput {
  now: Date
  leads: NurtureLead[]
  /** Unsubscribed from a website capture or the newsletter. */
  unsubscribed: Set<string>
  /** Bounced, complained, or marked do-not-email (MailingSuppression). */
  suppressed: Set<string>
  /** Taken off the website leads list (unsubscribed through an email link). */
  offList: Set<string>
  /** Already have an account. */
  registered: Set<string>
  /** Covered by the lifecycle emails; this sequence leaves them alone. */
  lifecycleOwned: Set<string>
  /** Sent emails by sourceRef (nurture:* and lifecycle:*), with when. */
  sent: Map<string, Date>
  facts: NurtureFacts
}

export interface PlannedSend {
  email: string
  kind: NurtureLeadKind
  track: NurtureTrack
  step: NurtureStep
  anchor: Date
  content: NurtureEmail
}

export interface PlanCounts {
  /** Distinct addresses with a lead in the window. */
  considered: number
  ownedByLifecycle: number
  registered: number
  stopped: number
  /** Nothing due: too early, too late, already sent, or inside the gap after another email. */
  notDue: number
}

const LIFECYCLE_STEPS = ['welcome', 'nudge1', 'nudge2'] as const

/** One lead per address: the kind that says the most about where the person is, then the earliest. */
export function pickLeadPerAddress(leads: NurtureLead[]): NurtureLead[] {
  const best = new Map<string, NurtureLead>()
  for (const l of leads) {
    const held = best.get(l.email)
    if (!held) {
      best.set(l.email, l)
      continue
    }
    const rank = KIND_PRIORITY.indexOf(l.kind) - KIND_PRIORITY.indexOf(held.kind)
    if (rank < 0 || (rank === 0 && l.anchor.getTime() < held.anchor.getTime())) best.set(l.email, l)
  }
  return [...best.values()]
}

/** Every sourceRef that tells us what we already sent this address. */
export function ledgerRefs(email: string): string[] {
  return [...NURTURE_STEPS.map((s) => nurtureRef(s, email)), ...LIFECYCLE_STEPS.map((s) => `lifecycle:${s}:${email}`)]
}

export function planNurture(input: PlanInput): { sends: PlannedSend[]; counts: PlanCounts } {
  const counts: PlanCounts = { considered: 0, ownedByLifecycle: 0, registered: 0, stopped: 0, notDue: 0 }
  const sends: PlannedSend[] = []

  const leads = pickLeadPerAddress(input.leads).sort((a, b) => a.anchor.getTime() - b.anchor.getTime())
  counts.considered = leads.length

  for (const lead of leads) {
    const { email } = lead
    if (input.lifecycleOwned.has(email)) {
      counts.ownedByLifecycle++
      continue
    }
    if (input.registered.has(email)) {
      counts.registered++
      continue
    }
    if (input.unsubscribed.has(email) || input.suppressed.has(email) || input.offList.has(email)) {
      counts.stopped++
      continue
    }

    const sentAt: Partial<Record<NurtureStep, Date>> = {}
    for (const step of NURTURE_STEPS) {
      const at = input.sent.get(nurtureRef(step, email))
      if (at) sentAt[step] = at
    }
    const times = ledgerRefs(email)
      .map((ref) => input.sent.get(ref))
      .filter((d): d is Date => !!d)
    const lastEmailAt = times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null

    const step = nextNurtureStep({ now: input.now, anchor: lead.anchor, sent: sentAt, lastEmailAt })
    if (!step) {
      counts.notDue++
      continue
    }
    sends.push({ email, kind: lead.kind, track: lead.track, step, anchor: lead.anchor, content: nurtureContent(lead.track, step, lead.context, input.facts) })
  }
  return { sends, counts }
}
