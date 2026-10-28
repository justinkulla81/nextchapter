'use server'

import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { ALL_STATE_CODES } from '@/lib/seo/states'
import { deadlineEmailsOn } from '@/lib/leads/job-alert-config'
import { sendAlertConfirmation } from '@/lib/leads/job-alerts'
import { parseLastDay, plausibleLastDay } from '@/lib/tools/layoff-deadlines'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'

// "Email me a reminder before each deadline" on /tools/layoff-deadlines. Stored as a HomepageLead of kind
// deadline_reminders (last day in `situation`, state in `searchLoc`), confirmed by email before anything is sent
// (see lib/leads/deadline-reminders.ts). The timeline itself needs no account and stores nothing.

export interface DeadlineSignupState {
  error?: string
  saved?: boolean
  email?: string
  confirmEmailed?: boolean
  token?: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

export async function saveDeadlineReminders(_prev: DeadlineSignupState | undefined, formData: FormData): Promise<DeadlineSignupState> {
  if (text(formData, 'website', 200)) return { saved: true }
  const email = text(formData, 'email', 200).toLowerCase()
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.', email }
  const lastDay = parseLastDay(text(formData, 'lastDay', 10))
  if (!lastDay || !plausibleLastDay(lastDay)) return { error: 'Enter your last day of work, within the last 60 days.', email }
  const stateRaw = text(formData, 'state', 2).toUpperCase()
  const state = (ALL_STATE_CODES as readonly string[]).includes(stateRaw) ? stateRaw : ''
  // Which box: the layoff deadlines tool, or one of the COBRA vs ACA, unemployment or severance pages (so the admin funnel can tell them apart).
  const sourceRaw = text(formData, 'source', 40)
  const source = /^(cobra_vs_aca:(tool|explainer|state)|unemployment:(hub|state)|severance:(tool|explainer))$/.test(sourceRaw) ? sourceRaw : 'layoff_deadlines'

  if (!(await allowByIp('deadline-reminders', 10, HOUR_MS)) || !(await allowByTarget('deadline-reminders', email, 5, DAY_MS))) {
    return { error: 'Too many requests from this network. Try again later.', email }
  }

  try {
    const ip = await getClientIp()
    const key = { email, kind: 'deadline_reminders', situation: lastDay.toISOString().slice(0, 10), searchQ: '', searchLoc: state, searchRemote: false }
    const select = { id: true, unsubscribeToken: true, confirmedAt: true, confirmSentAt: true } as const
    const existing = await prisma.homepageLead.findUnique({ where: { email_kind_situation_searchQ_searchLoc_searchRemote: key }, select })
    const lead = existing
      ? await prisma.homepageLead.update({ where: { id: existing.id }, data: { unsubscribedAt: null }, select })
      : await prisma.homepageLead.create({ data: { ...key, source, ip }, select })
    if (!existing) notifyNewLead({ email, channel: 'Deadline reminders', detail: source })

    const needsConfirm = !lead.confirmedAt && (!lead.confirmSentAt || lead.confirmSentAt.getTime() < Date.now() - DAY_MS)
    const confirmEmailed = needsConfirm
      ? await sendAlertConfirmation({ id: lead.id, email, unsubscribeToken: lead.unsubscribeToken }, {
          what: 'a reminder as each deadline after your last day comes up',
          subject: 'Confirm your deadline reminders',
          enabled: deadlineEmailsOn(),
        })
      : false
    captureServerEvent(email, 'alert_subscribed', { kind: 'deadline_reminders', source, state, confirmEmailed, returning: !!existing })
    return { saved: true, email, confirmEmailed, token: lead.unsubscribeToken }
  } catch (error) {
    console.error('deadline reminders signup failed:', error instanceof Error ? error.message : error)
    return { error: 'Something went wrong. Try again in a minute.', email }
  }
}
