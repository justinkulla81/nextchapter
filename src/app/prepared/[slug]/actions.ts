'use server'

import { prisma } from '@/lib/prisma'
import { PROSPECTS } from '@/lib/prospects/config'
import { addContactToCrm, ensureOrg } from '@/lib/crm/add-contact'
import { goalsForRoles } from '@/lib/crm/goals'
import { createResend } from '@/lib/email/resend-client'
import { withAudienceHtml } from '@/lib/email/audience-tag'
import { captureServerEvent } from '@/lib/posthog/server'

export type ClaimState = { ok?: boolean; error?: string } | undefined

const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Someone at the organization asks to activate their page. No account is created: they go in the CRM as a P0 lead due today,
 * and Justin gets an email. A hidden field catches bots.
 */
export async function claimProspectPage(slug: string, _prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const p = PROSPECTS[slug]
  if (!p) return { error: 'This page is no longer available.' }
  if ((formData.get('website') as string | null)?.trim()) return { ok: true }
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const email = ((formData.get('email') as string | null)?.trim() ?? '').toLowerCase()
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const success = ((formData.get('success') as string | null)?.trim() ?? '').slice(0, 600)
  if (name.split(/\s+/).length < 2) return { error: 'Enter your first and last name.' }
  if (!EMAIL_OK.test(email)) return { error: 'Enter a work email, like name@organization.org.' }
  if (title.length < 2) return { error: 'Enter your title.' }

  try {
    const org = await ensureOrg({ name: p.name, type: p.orgType })
    const roles = p.kind === 'employer' ? (['HIRING_MANAGER', 'OUTPLACEMENT_BUYER'] as const) : (['BD_PARTNER'] as const)
    const r = await addContactToCrm({
      fullName: name.slice(0, 120), title: title.slice(0, 120), email, orgId: org.id, orgName: org.name,
      roles: [...roles], goals: goalsForRoles([...roles]), priority: 'P0',
      note: `Asked to activate the prospect page /prepared/${slug}.${success ? ` What success looks like to them: ${success}` : ''}`,
    })
    if (r.outcome !== 'removed') await prisma.crmPerson.update({ where: { id: r.personId }, data: { nextFollowUpAt: new Date(), nextFollowUpNote: `Asked to activate the ${p.name} page. Reply today.` } })
    captureServerEvent(`prospect:${slug}`, 'prospect_page_claimed', { slug })
    if (process.env.RESEND_API_KEY) {
      await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({
        from: 'NextChapter <support@launchyournextchapter.com>', to: 'justin@launchyournextchapter.com',
        subject: `${p.name} asked to activate their page`,
        html: withAudienceHtml('admin', `<div style="font:14px/1.5 Arial,Helvetica,sans-serif;color:#111"><p><b>${esc(name)}</b>, ${esc(title)}, ${esc(email)}, asked to activate the <b>${esc(p.name)}</b> page.</p>${success ? `<p style="color:#444">${esc(success)}</p>` : ''}<p>They are in the CRM as a P0 lead due today.</p></div>`),
      })
    }
  } catch (e) {
    console.error('Prospect claim failed', slug, e)
    return { error: 'Something went wrong on our side. Email justin@launchyournextchapter.com and we will set it up.' }
  }
  return { ok: true }
}
