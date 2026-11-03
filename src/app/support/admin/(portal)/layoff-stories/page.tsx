import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { FUNCTIONS, LEVELS, labelOf } from '@/lib/layoff-stories/rules'
import { pendingStories, publishOpen } from '@/lib/layoff-stories/store'
import { SubmitButton } from '@/components/ui/submit-button'
import { approveStoryAction, rejectStoryAction } from './actions'

export const metadata: Metadata = { title: 'Layoff stories' }
export const maxDuration = 30
export const dynamic = 'force-dynamic'

// A story someone chose to publish, after they confirmed their email. A person reads it here before it can be shown on the company's layoff page.
export default async function LayoffStoriesAdminPage() {
  await requireAdmin()
  const rows = await pendingStories().catch(() => null)
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Layoff stories</h1>
        <p className="mt-1 text-muted-foreground">Stories waiting for review. Approve only what the person says happened to them. Reject anything that names a coworker or manager, accuses someone of a crime, shares confidential material or reads as marketing. Do not reword a story; reject it with a reason instead.</p>
        <p className="mt-2 text-sm">{publishOpen() ? 'Public stories are on: an approved story is shown on the company page.' : 'Public stories are off (LAYOFF_STORIES_PUBLISH is not set). Approving records the decision; nothing is shown yet.'}</p>
      </div>
      {rows === null ? (
        <p className="text-sm text-red-700">Could not load stories. The table may not exist yet.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
      ) : (
        <ul className="space-y-6">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border p-5">
              <p className="text-sm">
                {r.companySlug ? <Link href={`/layoffs/company/${r.companySlug}`} className="font-semibold underline underline-offset-4" target="_blank">{r.companyName}</Link> : <span className="font-semibold">{r.companyName} <span className="font-normal text-muted-foreground">(not a tracked company)</span></span>}
                <span className="text-muted-foreground"> · {labelOf(FUNCTIONS, r.fn)}, {labelOf(LEVELS, r.level).toLowerCase()} · told {r.toldMonth} · {r.visibility === 'NAMED' ? 'with name' : 'anonymous'}</span>
              </p>
              <blockquote className="mt-3 whitespace-pre-line border-l-2 border-border pl-4 text-sm">{r.body}</blockquote>
              <p className="mt-3 text-xs text-muted-foreground">{r.name ? `${r.name}, ` : ''}{r.title}, {r.email} (confirmed {r.emailVerifiedAt?.toISOString().slice(0, 10)}).</p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <form action={approveStoryAction.bind(null, r.id, r.companySlug)}>
                  <SubmitButton pendingLabel="Approving">Approve</SubmitButton>
                </form>
                <form action={rejectStoryAction.bind(null, r.id, r.companySlug)} className="flex flex-wrap items-end gap-2">
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
