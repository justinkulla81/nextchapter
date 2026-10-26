'use server'

import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { ALL_STATE_CODES } from '@/lib/seo/states'
import { getCompanies } from '@/lib/warn/layoff-pages'
import { layoffAlertEmailsOn } from '@/lib/leads/job-alert-config'
import { sendAlertConfirmation } from '@/lib/leads/job-alerts'
import { layoffWatchLabel } from '@/lib/leads/layoff-alerts'

// "Tell me about new layoff notices" on the /layoffs pages: one employer, one state, or everything. Stored as a
// HomepageLead of kind layoff_alert, confirmed by email before anything is sent (see lib/leads/layoff-alerts.ts).

export type LayoffAlertState = { error?: string; saved?: boolean; email?: string; confirmEmailed?: boolean } | undefined

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GENERIC_ERROR = 'Something went wrong. Try again in a minute.'
const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

export async function saveLayoffAlert(_prev: LayoffAlertState, formData: FormData): Promise<LayoffAlertState> {
  if (text(formData, 'website', 200)) return { saved: true }

  const email = text(formData, 'email', 200).toLowerCase()
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.', email }

  // What to watch: an employer that has a page, a state, or both. Anything else is dropped.
  const slugRaw = text(formData, 'employer', 80)
  const stateRaw = text(formData, 'state', 2).toUpperCase()
  const state = (ALL_STATE_CODES as readonly string[]).includes(stateRaw) ? stateRaw : ''
  let employer = ''
  if (slugRaw && /^[a-z0-9-]+$/.test(slugRaw) && (await getCompanies()).has(slugRaw)) employer = slugRaw
  if (!employer && !state) return { error: 'Pick an employer or a state to watch.', email }

  if (!(await allowByIp('layoff-alert', 10, HOUR_MS)) || !(await allowByTarget('layoff-alert', email, 5, DAY_MS))) {
    return { error: 'Too many requests from this network. Try again later.', email }
  }

  try {
    const ip = await getClientIp()
    const key = { email, kind: 'layoff_alert', situation: '', searchQ: employer, searchLoc: state, searchRemote: false }
    const existing = await prisma.homepageLead.findUnique({
      where: { email_kind_situation_searchQ_searchLoc_searchRemote: key },
      select: { id: true },
    })
    const select = { id: true, unsubscribeToken: true, confirmedAt: true, confirmSentAt: true } as const
    const lead = existing
      ? await prisma.homepageLead.update({ where: { id: existing.id }, data: { unsubscribedAt: null }, select })
      : await prisma.homepageLead.create({ data: { ...key, source: text(formData, 'source', 100) || 'layoffs', ip }, select })

    const needsConfirm = !lead.confirmedAt && (!lead.confirmSentAt || lead.confirmSentAt.getTime() < Date.now() - DAY_MS)
    const label = layoffWatchLabel({ searchQ: employer, searchLoc: state })
    const confirmEmailed = needsConfirm
      ? await sendAlertConfirmation({ id: lead.id, email, unsubscribeToken: lead.unsubscribeToken }, {
          what: `an email when a new layoff notice is filed for ${label}`,
          subject: `Confirm your layoff alerts: ${label}`,
          enabled: layoffAlertEmailsOn(),
        })
      : false
    captureServerEvent(email, 'alert_subscribed', { kind: 'layoff_alert', employer, state, confirmEmailed, returning: !!existing })
    return { saved: true, email, confirmEmailed }
  } catch (error) {
    console.error('layoff alert signup failed:', error instanceof Error ? error.message : error)
    return { error: GENERIC_ERROR, email }
  }
}
