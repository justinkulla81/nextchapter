import { requireAdmin } from '@/lib/admin/auth'
import { pendingClaims } from '@/lib/org-claims/approval'
import { ClaimDecisionButtons } from '@/components/admin/ClaimDecisionButtons'
import { SITE_URL } from '@/lib/org-claims/urls'

export const metadata = { title: 'Claims to approve' }
export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = { UNIVERSITY: 'College', GOVERNMENT: 'Workforce board', WORKFORCE_PROVIDER: 'Workforce provider', NONPROFIT: 'Nonprofit', FOUNDATION: 'Foundation' }
const when = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

// Owner decision 2026-11-17: an organization claims its page itself with a verified work email, and the free workspace
// opens only when NextChapter approves the claim here.
export default async function ClaimsToApprovePage() {
  await requireAdmin()
  const claims = await pendingClaims()
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Claims to approve</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Each person below confirmed a work email and claimed their organization&apos;s page. Approving opens the free workspace with them as its administrator
          and emails them a sign-in link. Declining creates nothing.
        </p>
      </div>
      {claims.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No claims are waiting. New ones also arrive by email.</p>
      ) : (
        <ul className="space-y-4">
          {claims.map((c) => {
            const type = c.orgTypes.map((t) => TYPE_LABEL[t]).find(Boolean) ?? 'Organization'
            return (
              <li key={c.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold">
                    {c.orgSlug ? <a href={`${SITE_URL}/prepared/${c.orgSlug}`} className="hover:underline">{c.orgName}</a> : c.orgName}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{type}</span>
                  </h2>
                  <span className="text-xs text-muted-foreground">Email confirmed {when(c.verifiedAt)}</span>
                </div>
                <p className="text-sm">
                  <span className="font-medium">{c.name}</span>, {c.title} · {c.email}
                </p>
                <p className={c.needsReview ? 'text-sm text-amber-900' : 'text-sm text-muted-foreground'}>
                  {c.needsReview
                    ? `Check this one: we have no email domain on file for ${c.orgName}, so ${c.emailDomain} could not be matched to it.`
                    : `${c.emailDomain} matches ${c.orgName}'s known domain${c.orgDomain && c.orgDomain !== c.emailDomain ? ` (${c.orgDomain})` : ''}.`}
                  {c.hasWorkspace ? ' The organization already has a workspace; approving adds them as an administrator.' : ''}
                </p>
                <ClaimDecisionButtons claimId={c.id} orgName={c.orgName} claimant={c.name} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
