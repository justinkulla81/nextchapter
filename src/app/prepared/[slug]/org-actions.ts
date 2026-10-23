'use server'

import { getClientIp } from '@/lib/http/client-ip'
import { confirmOrgClaim, requestOrgClaim, type ConfirmResult } from '@/lib/org-claims/claim'

export type OrgClaimState = { sent?: { email: string; needsReview: boolean }; error?: string; values?: { name: string; title: string; email: string } } | undefined

const text = (f: FormData, k: string) => ((f.get(k) as string | null) ?? '').trim()

/** Generic organization pages: sends the one-time confirmation link. Nothing is claimed until the link is used. */
export async function requestClaimAction(slug: string, _prev: OrgClaimState, formData: FormData): Promise<OrgClaimState> {
  if (text(formData, 'website')) return { sent: { email: text(formData, 'email'), needsReview: false } } // bots fill the hidden field
  const values = { name: text(formData, 'name'), title: text(formData, 'title'), email: text(formData, 'email') }
  try {
    const r = await requestOrgClaim({ slug, ...values, ip: await getClientIp() })
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
