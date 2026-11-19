'use server'

import { getClientIp } from '@/lib/http/client-ip'
import { confirmOrgClaim, requestOrgClaim, requestQuickClaim, type ConfirmResult } from '@/lib/org-claims/claim'

export type OrgClaimState = { sent?: { email: string; needsReview: boolean }; error?: string; values?: { name: string; title: string; email: string; section?: string; unitSchool?: string; unitDepartment?: string } } | undefined

const text = (f: FormData, k: string) => ((f.get(k) as string | null) ?? '').trim()

/** Generic organization pages: sends the one-time confirmation link. Nothing is claimed until the link is used. */
export async function requestClaimAction(slug: string, _prev: OrgClaimState, formData: FormData): Promise<OrgClaimState> {
  if (text(formData, 'website')) return { sent: { email: text(formData, 'email'), needsReview: false } } // bots fill the hidden field
  const section = text(formData, 'section')
  const via = text(formData, 'via') || null
  // A university claim for one school or department (owner decision 2026-11-18).
  const unit = text(formData, 'scope') === 'unit'
  const unitValues = unit ? { unitSchool: text(formData, 'unitSchool'), unitDepartment: text(formData, 'unitDepartment') } : {}
  const values = { name: text(formData, 'name'), title: text(formData, 'title'), email: text(formData, 'email'), ...(section ? { section } : {}), ...unitValues }
  try {
    if (unit && (values.unitSchool ?? '').length < 2) return { error: 'Enter the school’s name.', values }
    const r = await requestOrgClaim({ slug, ...values, via, ip: await getClientIp() })
    return r.ok ? { sent: { email: r.email, needsReview: r.needsReview } } : { error: r.error, values }
  } catch (e) {
    console.error('Organization claim request failed', slug, e)
    return { error: 'Something went wrong on our side. Try again in a few minutes.', values }
  }
}

export type ConfirmState = ConfirmResult | undefined

/** The button on the verify page. A button, not the bare link, so an email scanner that opens links cannot use up the token. */
export async function confirmClaimAction(token: string): Promise<ConfirmState> {
  try {
    return await confirmOrgClaim(token)
  } catch (e) {
    console.error('Organization claim confirm failed', e)
    return { status: 'invalid' }
  }
}

export type QuickClaimState = { sent?: { email: string }; error?: string; email?: string } | undefined

/** The email-only claim on a public organization page: the claim goes to NextChapter's queue and a person decides. */
export async function quickClaimAction(slug: string, _prev: QuickClaimState, formData: FormData): Promise<QuickClaimState> {
  const email = text(formData, 'email')
  if (text(formData, 'website')) return { sent: { email } } // bots fill the hidden field
  try {
    const r = await requestQuickClaim({ slug, email, ip: await getClientIp() })
    return r.ok ? { sent: { email: r.email } } : { error: r.error, email }
  } catch (e) {
    console.error('Quick organization claim failed', slug, e)
    return { error: 'Something went wrong on our side. Try again in a few minutes.', email }
  }
}
