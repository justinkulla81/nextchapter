'use server'

import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { jobAlertEmailsOn } from '@/lib/leads/job-alert-config'
import { sendAlertConfirmation } from '@/lib/leads/job-alerts'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'
import { catalogFunctionBySlug, levelBySlug } from '@/lib/learning/public-catalog-shared'

// "Email me my AI course path" on the /ai-courses pages: a HomepageLead of kind course_path (situation = AI level,
// searchQ = function slug), confirmed by email before anything else. The confirmation email is the path: one link.

export type CoursePathState = { error?: string; saved?: boolean; email?: string; confirmEmailed?: boolean; path?: string } | undefined

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

export async function saveCoursePath(_prev: CoursePathState, formData: FormData): Promise<CoursePathState> {
  if (text(formData, 'website', 200)) return { saved: true }

  const email = text(formData, 'email', 200).toLowerCase()
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.', email }
  const fn = catalogFunctionBySlug(text(formData, 'function', 60))
  const level = levelBySlug(text(formData, 'level', 20))
  if (!fn || !level) return { error: 'Pick your function and AI level first.', email }

  if (!(await allowByIp('course-path', 10, HOUR_MS)) || !(await allowByTarget('course-path', email, 5, DAY_MS))) {
    return { error: 'Too many requests from this network. Try again later.', email }
  }

  try {
    const ip = await getClientIp()
    const key = { email, kind: 'course_path', situation: level.level, searchQ: fn.slug, searchLoc: '', searchRemote: false }
    const existing = await prisma.homepageLead.findUnique({ where: { email_kind_situation_searchQ_searchLoc_searchRemote: key }, select: { id: true } })
    const select = { id: true, unsubscribeToken: true, confirmedAt: true, confirmSentAt: true } as const
    const lead = existing
      ? await prisma.homepageLead.update({ where: { id: existing.id }, data: { unsubscribedAt: null }, select })
      : await prisma.homepageLead.create({ data: { ...key, source: text(formData, 'source', 100) || 'ai-courses', ip }, select })
    if (!existing) notifyNewLead({ email, channel: 'AI course path', detail: `${fn.name}, ${level.label}` })

    const needsConfirm = !lead.confirmedAt && (!lead.confirmSentAt || lead.confirmSentAt.getTime() < Date.now() - DAY_MS)
    const confirmEmailed = needsConfirm
      ? await sendAlertConfirmation({ id: lead.id, email, unsubscribeToken: lead.unsubscribeToken }, {
          what: `your ${level.label.toLowerCase()} AI course path for ${fn.people}`,
          subject: `Your AI course path for ${fn.people}`,
          enabled: jobAlertEmailsOn(),
          variant: 'course_path',
        })
      : false
    captureServerEvent(email, 'course_path_requested', { function: fn.slug, level: level.slug, source: text(formData, 'source', 100), confirmEmailed, returning: !!existing })
    return { saved: true, email, confirmEmailed, path: `/ai-courses/for/${fn.slug}/${level.slug}` }
  } catch (error) {
    console.error('course path signup failed:', error instanceof Error ? error.message : error)
    return { error: 'Something went wrong. Try again in a minute.', email }
  }
}
