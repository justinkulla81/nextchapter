'use server'

import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { jobAlertEmailsOn } from '@/lib/leads/job-alert-config'
import { sendAlertConfirmation } from '@/lib/leads/job-alerts'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'
import { catalogFunctionBySlug } from '@/lib/learning/public-catalog-shared'
import { formatByValue, interestLoc } from '@/lib/learning/ai-retraining'
import { industryBySlug } from '@/lib/seo/topics'
import { ALL_STATE_CODES } from '@/lib/seo/states'

// "Register your interest" on /ai-retraining: a HomepageLead of kind ai_retraining (situation = function slug, searchQ = industry
// slug, searchLoc = format and, for in person, the state), confirmed by email before anything else is sent. It is the first step
// of a registration path: it records who wants AI retraining, for which work, and how.

export type RetrainingState = { error?: string; saved?: boolean; email?: string; confirmEmailed?: boolean } | undefined

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

export async function saveRetrainingInterest(_prev: RetrainingState, formData: FormData): Promise<RetrainingState> {
  if (text(formData, 'website', 200)) return { saved: true }

  const email = text(formData, 'email', 200).toLowerCase()
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.', email }
  const fn = catalogFunctionBySlug(text(formData, 'function', 60))
  const industry = industryBySlug(text(formData, 'industry', 80))
  const format = formatByValue(text(formData, 'format', 20) || 'online')
  if (!fn || !industry) return { error: 'Pick your function and your industry.', email }
  if (!format) return { error: 'Pick how you want to learn.', email }
  const st = text(formData, 'state', 2).toUpperCase()
  const state = ALL_STATE_CODES.includes(st) ? st : ''
  if (format !== 'online' && !state) return { error: 'Pick your state so we can look for programs near you.', email }

  if (!(await allowByIp('ai-retraining', 10, HOUR_MS)) || !(await allowByTarget('ai-retraining', email, 5, DAY_MS))) {
    return { error: 'Too many requests from this network. Try again later.', email }
  }

  try {
    const ip = await getClientIp()
    const source = text(formData, 'source', 100) || 'ai-retraining'
    const key = { email, kind: 'ai_retraining', situation: fn.slug, searchQ: industry.slug, searchLoc: interestLoc(format, state), searchRemote: false }
    const existing = await prisma.homepageLead.findUnique({ where: { email_kind_situation_searchQ_searchLoc_searchRemote: key }, select: { id: true } })
    const select = { id: true, unsubscribeToken: true, confirmedAt: true, confirmSentAt: true } as const
    const lead = existing
      ? await prisma.homepageLead.update({ where: { id: existing.id }, data: { unsubscribedAt: null }, select })
      : await prisma.homepageLead.create({ data: { ...key, source, ip }, select })
    if (!existing) notifyNewLead({ email, channel: 'AI retraining interest', detail: `${fn.name}, ${industry.name}, ${key.searchLoc}` })

    const needsConfirm = !lead.confirmedAt && (!lead.confirmSentAt || lead.confirmSentAt.getTime() < Date.now() - DAY_MS)
    const confirmEmailed = needsConfirm
      ? await sendAlertConfirmation({ id: lead.id, email, unsubscribeToken: lead.unsubscribeToken }, {
          what: `AI retraining programs for ${fn.people} in ${industry.name.toLowerCase()}`,
          subject: 'Confirm your interest in AI retraining',
          enabled: jobAlertEmailsOn(),
          variant: 'ai_retraining',
        })
      : false
    captureServerEvent(email, 'ai_retraining_interest_registered', { function: fn.slug, industry: industry.slug, format, state: state || null, source, confirmEmailed, returning: !!existing })
    return { saved: true, email, confirmEmailed }
  } catch (error) {
    console.error('ai retraining signup failed:', error instanceof Error ? error.message : error)
    return { error: 'Something went wrong. Try again in a minute.', email }
  }
}
