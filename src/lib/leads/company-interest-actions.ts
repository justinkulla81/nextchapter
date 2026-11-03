'use server'

import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'

// "I'm interested in <company>" on a company page. It saves the employer against an email (required) as a
// HomepageLead of kind 'company_interest', and the page then sends the person into registration. When the
// email becomes a member, claimEmployerFollows (company-tracker/follow-from-email.ts) puts the company on their
// followed list. No email is sent from here.

export type CompanyInterestState = { error?: string; saved?: boolean; email?: string } | undefined

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAGES = new Set(['employer', 'layoffs', 'network'])
const GENERIC_ERROR = 'Something went wrong. Try again in a minute.'
const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

export async function flagCompanyInterest(_prev: CompanyInterestState, formData: FormData): Promise<CompanyInterestState> {
  // A field real people never see: filled in means a bot. Answer as success, store nothing.
  if (text(formData, 'website', 200)) return { saved: true }

  const email = text(formData, 'email', 200).toLowerCase()
  const company = text(formData, 'company', 120)
  const page = PAGES.has(text(formData, 'page', 20)) ? text(formData, 'page', 20) : 'employer'
  const slug = /^[a-z0-9-]{1,80}$/.test(text(formData, 'slug', 80)) ? text(formData, 'slug', 80) : ''
  if (!company) return { error: 'We could not tell which company this is. Reload the page and try again.', email }
  if (!EMAIL.test(email)) return { error: 'Enter your email address so we can save this company for you.', email }

  if (!(await allowByIp('company-interest', 10, HOUR_MS)) || !(await allowByTarget('company-interest', email, 10, DAY_MS))) {
    return { error: 'Too many requests from this network. Try again later.', email }
  }

  try {
    const ip = await getClientIp()
    const source = `page:${page}`
    const key = { email, kind: 'company_interest', situation: '', searchQ: company.toLowerCase(), searchLoc: '', searchRemote: false }
    const existing = await prisma.homepageLead.findUnique({ where: { email_kind_situation_searchQ_searchLoc_searchRemote: key }, select: { id: true } })
    if (existing) await prisma.homepageLead.update({ where: { id: existing.id }, data: { unsubscribedAt: null } })
    else {
      await prisma.homepageLead.create({ data: { ...key, source, ip } })
      notifyNewLead({ email, channel: 'Company interest', detail: `${company} (${source})` })
    }
    captureServerEvent(email, 'company_interest_flagged', { companyName: company, slug, page, source, returning: !!existing })
    return { saved: true, email }
  } catch (error) {
    console.error('company interest failed:', error instanceof Error ? error.message : error)
    return { error: GENERIC_ERROR, email }
  }
}
