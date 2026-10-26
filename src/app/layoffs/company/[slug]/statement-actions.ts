'use server'

import { getClientIp } from '@/lib/http/client-ip'
import { requestStatement, verifyStatement, type VerifyStatementResult } from '@/lib/employer-statements/store'

export type StatementFormState = { sent?: { email: string }; error?: string; values?: { noticeId: string; name: string; title: string; email: string; text: string } } | undefined

const text = (f: FormData, k: string) => ((f.get(k) as string | null) ?? '').trim()

/** Sends the one-time link to the author's work email. Nothing is shown until the link is used and a person approves it. */
export async function requestStatementAction(slug: string, _prev: StatementFormState, formData: FormData): Promise<StatementFormState> {
  if (text(formData, 'website')) return { sent: { email: text(formData, 'email') } } // bots fill the hidden field
  const values = { noticeId: text(formData, 'noticeId'), name: text(formData, 'name'), title: text(formData, 'title'), email: text(formData, 'email'), text: formData.get('text') ? String(formData.get('text')) : '' }
  try {
    const r = await requestStatement({ companySlug: slug, noticeId: values.noticeId, name: values.name, title: values.title, email: values.email, text: values.text, ip: await getClientIp() })
    return r.ok ? { sent: { email: r.email } } : { error: r.error, values }
  } catch (e) {
    console.error('Employer statement request failed', slug, e)
    return { error: 'Something went wrong on our side. Try again in a few minutes.', values }
  }
}

export type ConfirmStatementState = VerifyStatementResult | undefined

/** The button on the confirm page: a button, not the bare link, so an email scanner that opens links cannot use up the token. */
export async function confirmStatementAction(token: string): Promise<ConfirmStatementState> {
  try {
    return await verifyStatement(token)
  } catch (e) {
    console.error('Employer statement confirm failed', e)
    return 'invalid'
  }
}
