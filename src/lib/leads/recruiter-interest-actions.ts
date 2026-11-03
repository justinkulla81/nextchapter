'use server'

import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'

// "Want recruiters in this space to be able to find you?" on a senior job page. One email, saved as a HomepageLead of kind
// 'recruiter_interest' with the space (function, else industry, else the title) in searchQ, so one person can ask for several spaces.
// The page then sends them into registration; the account is what recruiters see. No email is sent from here.

export type RecruiterInterestState = { error?: string; saved?: boolean; email?: string } | undefined

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GENERIC_ERROR = 'Something went wrong. Try again in a minute.'
const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

export async function saveRecruiterInterest(_prev: RecruiterInterestState, formData: FormData): Promise<RecruiterInterestState> {
  if (text(formData, 'website', 200)) return { saved: true } // honeypot: answer as success, store nothing

  const email = text(formData, 'email', 200).toLowerCase()
  const space = text(formData, 'space', 120)
  const company = text(formData, 'company', 120)
  const jobId = /^[a-z0-9]{10,40}$/i.test(text(formData, 'jobId', 40)) ? text(formData, 'jobId', 40) : ''
  if (!space) return { error: 'We could not tell which field this job is in. Reload the page and try again.', email }
  if (!EMAIL.test(email)) return { error: 'Enter your email address so recruiters in this field can find you.', email }

  if (!(await allowByIp('recruiter-interest', 10, HOUR_MS)) || !(await allowByTarget('recruiter-interest', email, 10, DAY_MS))) {
    return { error: 'Too many requests from this network. Try again later.', email }
  }

  try {
    const ip = await getClientIp()
    const source = 'page:job'
    const key = { email, kind: 'recruiter_interest', situation: '', searchQ: space.toLowerCase(), searchLoc: '', searchRemote: false }
    const existing = await prisma.homepageLead.findUnique({ where: { email_kind_situation_searchQ_searchLoc_searchRemote: key }, select: { id: true } })
    if (existing) await prisma.homepageLead.update({ where: { id: existing.id }, data: { unsubscribedAt: null } })
    else {
      await prisma.homepageLead.create({ data: { ...key, source, ip } })
      notifyNewLead({ email, channel: 'Recruiter interest', detail: `${space} (job at ${company || 'unknown'})` })
    }
    captureServerEvent(email, 'recruiter_interest_saved', { jobId, space, company, source, returning: !!existing })
    return { saved: true, email }
  } catch (error) {
    console.error('recruiter interest failed:', error instanceof Error ? error.message : error)
    return { error: GENERIC_ERROR, email }
  }
}
