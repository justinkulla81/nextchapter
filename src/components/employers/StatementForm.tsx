'use client'

import { useActionState, useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { SubmitButton } from '@/components/ui/submit-button'
import { requestStatementAction, type StatementFormState } from '@/app/layoffs/company/[slug]/statement-actions'
import { STATEMENT_MAX } from '@/lib/employer-statements/rules'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'

/** Add a statement next to a layoff notice. Works for anyone at the company with a work email; a person approves it before it shows. */
export function StatementForm({ slug, companyName, notices }: { slug: string; companyName: string; notices: { id: string; label: string }[] }) {
  const posthog = usePostHog()
  const [state, action] = useActionState<StatementFormState, FormData>((prev, fd) => requestStatementAction(slug, prev, fd), undefined)
  const [open, setOpen] = useState(false)
  const v = state?.values
  const [len, setLen] = useState(v?.text.length ?? 0)

  if (state?.sent) {
    return (
      <div role="status" className="mt-4 max-w-xl rounded-xl border border-border bg-white p-5 text-sm">
        <p className="font-semibold text-navy">Check your email.</p>
        <p className="mt-1 text-muted-foreground">We sent a confirmation link to {state.sent.email}. After you confirm, a person on our team reads the statement before it is shown. The state filing stays as filed.</p>
      </div>
    )
  }
  if (!open && !state?.error) {
    return (
      <button type="button" onClick={() => { setOpen(true); posthog?.capture('employer_statement_form_opened', { slug, notices: notices.length }) }} className="mt-4 inline-flex h-11 items-center rounded-full border border-border bg-white px-5 text-sm font-semibold text-navy hover:bg-off-white">
        Add a statement from {companyName}
      </button>
    )
  }
  return (
    <form action={action} className="mt-4 max-w-xl space-y-4 rounded-xl border border-border bg-white p-5" noValidate>
      <p className="text-sm text-muted-foreground">For people at {companyName}. Use your work email. The statement appears next to the notice, dated, and the state filing stays exactly as filed.</p>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className="block text-sm font-medium text-navy">
        Notice
        <select name="noticeId" defaultValue={v?.noticeId ?? notices[0]?.id} className={FIELD}>
          {notices.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium text-navy">Your name<input name="name" defaultValue={v?.name} autoComplete="name" className={FIELD} /></label>
      <label className="block text-sm font-medium text-navy">Your title<input name="title" defaultValue={v?.title} autoComplete="organization-title" className={FIELD} /></label>
      <label className="block text-sm font-medium text-navy">Work email<input name="email" type="email" defaultValue={v?.email} autoComplete="email" className={FIELD} /></label>
      <label className="block text-sm font-medium text-navy">
        Statement
        <textarea name="text" rows={5} defaultValue={v?.text} onChange={(e) => setLen(e.target.value.length)} maxLength={STATEMENT_MAX + 200} className="mt-1 w-full rounded-lg border border-border bg-white p-3 text-base" />
        <span className="mt-1 block text-xs font-normal text-muted-foreground">{len} of {STATEMENT_MAX} characters. Plain text, no links.</span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <SubmitButton pendingLabel="Sending">Send confirmation email</SubmitButton>
    </form>
  )
}
