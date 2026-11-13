'use server'

import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'

// The one-field request on a company page for someone who arrived from a layoff outreach email: HR asking for the 10 free
// seats, or a partner (job center, workforce board, Rapid Response) asking for the handout. Stored as a HomepageLead of kind
// 'outreach_request' (situation = hr or partner, searchQ = the employer), and the owner is notified. No email is sent from here.

export type OutreachRequestState = { error?: string; saved?: boolean; email?: string } | undefined

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GENERIC_ERROR = 'Something went wrong. Try again in a minute.'
const text = (f: FormData, k: string, max: number) => ((f.get(k) as string | null) ?? '').trim().slice(0, max)

export async function submitOutreachRequest(_prev: OutreachRequestState, formData: FormData): Promise<OutreachRequestState> {
  // A field real people never see: filled in means a bot. Answer as success, store nothing.
  if (text(formData, 'website', 200)) return { saved: true }

  const email = text(formData, 'email', 200).toLowerCase()
  const company = text(formData, 'company', 120)
  const role = text(formData, 'role', 10) === 'hr' ? 'hr' : 'partner'
  const audience = /^[a-z_]{1,20}$/.test(text(formData, 'audience', 20)) ? text(formData, 'audience', 20) : ''
  const arm = text(formData, 'arm', 1) === 'A' ? 'A' : 'B'
  const noticeId = /^[a-z0-9]{1,40}$/i.test(text(formData, 'noticeId', 40)) ? text(formData, 'noticeId', 40) : ''
  const slug = /^[a-z0-9-]{1,80}$/.test(text(formData, 'slug', 80)) ? text(formData, 'slug', 80) : ''
  if (!company) return { error: 'We could not tell which company this is. Reload the page and try again.', email }
  if (!EMAIL.test(email)) return { error: 'Enter your work email so we can reach you.', email }

  if (!(await allowByIp('outreach-request', 10, HOUR_MS)) || !(await allowByTarget('outreach-request', email, 5, DAY_MS))) {
    return { error: 'Too many requests from this network. Try again later.', email }
  }

  try {
    const ip = await getClientIp()
    const source = `outreach:${audience || role}:${arm}`
    const key = { email, kind: 'outreach_request', situation: role, searchQ: company.toLowerCase(), searchLoc: '', searchRemote: false }
    const existing = await prisma.homepageLead.findUnique({ where: { email_kind_situation_searchQ_searchLoc_searchRemote: key }, select: { id: true } })
    if (existing) await prisma.homepageLead.update({ where: { id: existing.id }, data: { unsubscribedAt: null } })
    else {
      await prisma.homepageLead.create({ data: { ...key, source, ip } })
      notifyNewLead({ email, channel: role === 'hr' ? 'Outreach: 10 seats request' : 'Outreach: handout request', detail: `${company} (${source})` })
    }
    captureServerEvent(email, 'outreach_request_submitted', { role, audience, arm, noticeId, companyName: company, slug, returning: !!existing })
    return { saved: true, email }
  } catch (error) {
    console.error('outreach request failed:', error instanceof Error ? error.message : error)
    return { error: GENERIC_ERROR, email }
  }
}
