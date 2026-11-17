// Talent Hub › Your network: the first thing a new organization does. Who we think you know (peers, employers, colleges), tick the ones to
// link, and each link is an invitation to claim a free page of its own. Linked organizations show where each stands.

import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { relatedOrgs, searchClaimableOrgs } from '@/lib/org-claims/related-orgs'
import { byGroup } from '@/lib/org-claims/related-suggest-rules'
import { suggestRelated } from '@/lib/org-claims/related-suggest'
import { ecoKindLabel } from '@/lib/workforce/ecosystem'
import { StatTile } from './StatTile'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { NetworkPicker } from './HubNetworkForms'
import { LinkOrgButton, RelatedInvite } from './RelatedOrgForms'

type Props = { ctx: WorkspaceContext; searchParams: { q?: string }; base: string }

const STATE_LABEL = { invited: 'Invited', claimed: 'Claimed its page, waiting for approval', connected: 'Has its own portal' } as const

export async function HubNetwork({ ctx, searchParams, base }: Props) {
  const slug = ctx.institution.slug
  const inviter = ctx.institution.programBrandName ?? ctx.institution.name
  const q = (searchParams.q ?? '').trim().slice(0, 80)
  const inst = await prisma.institution.findUnique({ where: { id: ctx.institution.id }, select: { crmOrganizationId: true } })
  const [suggested, { linked, linkedYou }, found] = await Promise.all([
    suggestRelated(ctx.institution.id).catch(() => []),
    relatedOrgs(ctx.institution.id),
    q ? searchClaimableOrgs(q, inst?.crmOrganizationId ?? null) : Promise.resolve([]),
  ])
  const groups = byGroup(suggested)
  const linkedSlugs = new Set(linked.map((l) => l.slug))
  const connected = linked.filter((l) => l.state === 'connected').length
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        The people you work with do better when they are here too. Tick the organizations you know: each one gets an invite to claim a free page of its own, and when they do, you are connected and see each other. {inviter} sends nothing from here; you copy the invite or open it as an email.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Linked" value={linked.length} />
        <StatTile label="Have their own portal" value={connected} />
        <StatTile label="Linked you" value={linkedYou.length} note="Other organizations that added you" />
        <StatTile label="We think you know" value={suggested.length} />
      </div>

      <section className="space-y-3" aria-labelledby="net-sugg">
        <h2 id="net-sugg" className="text-base font-semibold">
          We think you know
        </h2>
        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            {linked.length > 0 ? 'You have linked everyone we suggested. Search below for anyone we missed.' : 'We have no suggestions for your region yet. Set your region on Reports › Kept in region, or search by name below.'}
          </p>
        ) : (
          <NetworkPicker slug={slug} groups={groups.map((g) => ({ key: g.key, label: g.label, items: g.items.map((i) => ({ orgId: i.orgId, name: i.name, reason: i.reason, onNextChapter: i.onNextChapter })) }))} disabled={ctx.readOnly} />
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
                {r.state !== 'connected' && <RelatedInvite inviteUrl={r.inviteUrl} orgName={r.name} inviter={inviter} slug={slug} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="net-find">
        <h2 id="net-find" className="text-base font-semibold">
          Someone we missed
        </h2>
        <form method="get" action={`${base}/network`} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="net-q">Name</Label>
            <Input id="net-q" name="q" defaultValue={q} placeholder="e.g. Jefferson Community" className="w-72" />
          </div>
          <Button type="submit" variant="outline">
            Search organizations
          </Button>
        </form>
        {q &&
          (found.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {found.map((r) => (
                <li key={r.crmOrgId} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <span className="font-medium">{r.name}</span>
                  {linkedSlugs.has(r.slug) ? <span className="text-xs text-muted-foreground">Already linked</span> : !ctx.readOnly ? <LinkOrgButton slug={slug} crmOrgId={r.crmOrgId} orgName={r.name} inviter={inviter} /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No organization with a public page matches “{q}”. Only organizations with their own page on NextChapter can be linked.</p>
          ))}
      </section>
    </div>
  )
}
