import { requireAdmin } from '@/lib/admin/auth'
import { pendingPageEdits } from '@/lib/public-page/store'
import { publicPageUrlFor } from '@/lib/public-page/where'
import { OrgOwnSection } from '@/components/public-page/OrgOwnSection'
import { PageEditDecision } from '@/components/admin/PageEditDecision'

export const metadata = { title: 'Public page edits' }
export const dynamic = 'force-dynamic'

const KIND = { COLLEGE: 'College', WORKFORCE: 'Workforce organization', EMPLOYER: 'Employer' } as const
const when = (d: Date | null) => (d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

// Owner decision 2026-11-17: a paid organization's first version of its own section on its public page waits for review
// here. Approving publishes it; after that, its saves publish without review.
export default async function PageEditsPage() {
  await requireAdmin()
  const edits = await pendingPageEdits()
  const urls = await Promise.all(edits.map((e) => publicPageUrlFor(e.crmOrgId).catch(() => null)))
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Public page edits</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          First versions of what paid organizations wrote for their own public pages. Approving publishes it, and their later saves publish without review.
          Asking for a change sends your note back and publishes nothing.
        </p>
      </div>
      {edits.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Nothing is waiting for review.</p>
      ) : (
        <ul className="space-y-6">
          {edits.map((e, i) => (
            <li key={e.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">
                  {e.orgName} <span className="text-sm font-normal text-muted-foreground">{KIND[e.kind]}</span>
                </h2>
                <span className="text-xs text-muted-foreground">
                  Sent {when(e.submittedAt)}
                  {e.by ? ` by ${e.by}` : ''}
                </span>
              </div>
              {urls[i] && (
                <p className="text-sm">
                  Shows on{' '}
                  <a href={urls[i]!} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                    {urls[i]!.replace(/^https?:\/\//, '')}
                  </a>
                </p>
              )}
              <div className="rounded-md border border-border p-4">
                <OrgOwnSection orgName={e.orgName} kind={e.kind} content={e.draft} headingClass="text-lg font-semibold" />
              </div>
              <PageEditDecision id={e.id} orgName={e.orgName} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
