import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { pendingStatements } from '@/lib/employer-statements/store'
import { SubmitButton } from '@/components/ui/submit-button'
import { approveStatementAction, rejectStatementAction } from './actions'

export const metadata: Metadata = { title: 'Employer statements' }
export const maxDuration = 30
export const dynamic = 'force-dynamic'

// A statement an employer wrote next to one of its WARN layoff notices. The author has confirmed a work email; a person
// reads the text here before it is shown on the public layoff pages. The state filing is never changed.
export default async function EmployerStatementsAdminPage() {
  await requireAdmin()
  const rows = await pendingStatements().catch(() => null)
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employer statements</h1>
        <p className="mt-1 text-muted-foreground">Statements waiting for review. Approve only what is plain, factual and about the notice. Reject anything that blames people, makes claims about other companies or reads as marketing.</p>
      </div>
      {rows === null ? (
        <p className="text-sm text-red-700">Could not load statements. The table may not exist yet.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
      ) : (
        <ul className="space-y-6">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border p-5">
              <p className="text-sm">
                <Link href={`/layoffs/company/${r.companySlug}`} className="font-semibold underline underline-offset-4" target="_blank">{r.companyName}</Link>
                {r.notice && <span className="text-muted-foreground"> · notice filed {r.notice.noticeDate.toISOString().slice(0, 10)} · {r.notice.state}{r.notice.workers != null ? ` · ${r.notice.workers.toLocaleString()} workers` : ''}</span>}
              </p>
              <blockquote className="mt-3 border-l-2 border-border pl-4 text-sm">{r.body}</blockquote>
              <p className="mt-3 text-xs text-muted-foreground">{r.authorName}, {r.authorTitle}, {r.authorEmail} (confirmed {r.emailVerifiedAt?.toISOString().slice(0, 10)}). Email domain: {r.emailDomain}.</p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <form action={approveStatementAction.bind(null, r.id, r.companySlug)}>
                  <SubmitButton pendingLabel="Approving">Approve and show</SubmitButton>
                </form>
                <form action={rejectStatementAction.bind(null, r.id, r.companySlug)} className="flex flex-wrap items-end gap-2">
                  <label className="text-xs text-muted-foreground">Reason (kept for us, not sent)<input name="note" maxLength={500} className="mt-1 block h-10 w-64 rounded-lg border border-border px-3 text-sm" /></label>
                  <SubmitButton pendingLabel="Rejecting">Reject</SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
