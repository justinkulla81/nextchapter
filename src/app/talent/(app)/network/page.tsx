import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { employerRelated } from '@/lib/org-claims/related-orgs'
import { byGroup } from '@/lib/org-claims/related-suggest-rules'
import { suggestForEmployer } from '@/lib/org-claims/related-suggest'
import { ecoKindLabel } from '@/lib/workforce/ecosystem'
import { Squiggle } from '@/components/ui/squiggle'
import { NetworkPicker } from '@/components/higher-ed/HubNetworkForms'
import { RelatedInvite } from '@/components/higher-ed/RelatedOrgForms'
import { linkEmployerSuggested } from './actions'

const STATE_LABEL = { invited: 'Invited', claimed: 'Claimed its page, waiting for approval', connected: 'Has its own portal' } as const

// Hiring portal › Your network: who we think you know near your headquarters, tick the ones to invite, and each link is an
// invitation to claim a free page of its own. Linked organizations show where each stands.
export default async function TalentNetworkPage() {
  const employer = await getTalentDashboardData()
  const [{ place, items }, linked] = await Promise.all([suggestForEmployer(employer.id).catch(() => ({ place: null, items: [] })), employerRelated(employer.id)])
  const groups = byGroup(items, 'employer')
  const connected = linked.filter((l) => l.state === 'connected').length
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your network</h1>
        <Squiggle className="mt-2" />
        <p className="mt-1 max-w-3xl text-muted-foreground">
          The people you work with do better when they are here too. Tick the organizations you know: each one gets an invite to claim a free page of its own, and when they do, you are connected. {employer.companyName} sends nothing from here; you copy the invite or open it as an email.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        {linked.length} linked · {connected} with their own portal · {items.length} we think you know
      </p>

      <section className="space-y-3" aria-labelledby="net-sugg">
        <h2 id="net-sugg" className="text-base font-semibold">
          We think you know{place ? ` near ${place}` : ''}
        </h2>
        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            {linked.length > 0
              ? 'You have linked everyone we suggested.'
              : place
                ? 'We have no suggestions near your headquarters yet.'
                : 'We do not know where your company is based, so we cannot suggest anyone yet.'}
          </p>
        ) : (
          <NetworkPicker slug="employer" link={linkEmployerSuggested} groups={groups.map((g) => ({ key: g.key, label: g.label, items: g.items.map((i) => ({ orgId: i.orgId, name: i.name, reason: i.reason, onNextChapter: i.onNextChapter })) }))} disabled={false} />
        )}
      </section>

      {linked.length > 0 && (
        <section className="space-y-3" aria-labelledby="net-linked">
          <h2 id="net-linked" className="text-base font-semibold">
            Your network
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {linked.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <span>
                  <span className="font-medium">{r.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {ecoKindLabel(r.kind)} · {STATE_LABEL[r.state]}
                  </span>
                </span>
                {r.state !== 'connected' && <RelatedInvite inviteUrl={r.inviteUrl} orgName={r.name} inviter={employer.companyName} slug="employer" />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
