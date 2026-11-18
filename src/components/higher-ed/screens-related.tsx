// Admin › Related organizations (owner decision 2026-11-17): a college or workforce organization links the organizations it
// works with, chosen only from organizations that have their own public page on NextChapter. Each link is an invitation:
// the other organization claims its page, NextChapter approves it, and the two are connected. Free and paid alike.

import Link from 'next/link'
import { Network } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { relatedOrgs, searchClaimableOrgs, partnerKindFor } from '@/lib/org-claims/related-orgs'
import { ecoKindLabel } from '@/lib/workforce/ecosystem'
import { removeRelatedOrgAction } from '@/app/i/[slug]/(portal)/related-actions'
import { SITE_URL } from '@/lib/org-claims/urls'
import { orgBasePath, orgKindOf } from '@/lib/higher-ed/workspaces'
import { byGroup } from '@/lib/org-claims/related-suggest-rules'
import { suggestRelated } from '@/lib/org-claims/related-suggest'
import { NetworkPicker } from './HubNetworkForms'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ConfirmActionButton } from './ConfirmActionButton'
import { LinkOrgButton, RelatedInvite } from './RelatedOrgForms'

type Props = { ctx: WorkspaceContext; base: string; searchParams: Record<string, string | undefined> }

const STATE_LABEL = { invited: 'Invited', claimed: 'Claimed its page, waiting for approval', connected: 'Has its own portal' } as const

export async function AdminRelatedOrgs({ ctx, searchParams }: Props) {
  const slug = ctx.institution.slug
  const canEdit = !ctx.readOnly && !ctx.institution.isDemo
  const q = searchParams.q?.trim() ?? ''
  const inst = await prisma.institution.findUnique({ where: { id: ctx.institution.id }, select: { crmOrganizationId: true } })
  const [{ linked, linkedYou }, results, suggested] = await Promise.all([relatedOrgs(ctx.institution.id), q ? searchClaimableOrgs(q, inst?.crmOrganizationId ?? null) : Promise.resolve([]), suggestRelated(ctx.institution.id).catch(() => [])])
  const groups = byGroup(suggested, orgKindOf(ctx.institution.orgType))
  const linkedIds = new Set(linked.map((l) => l.slug))
  const inviter = ctx.institution.programBrandName ?? ctx.institution.name
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Link the colleges, employers, workforce boards and community groups you work with. You can link any organization that has its own page on NextChapter,
        as many as you like. Each one gets an invite to claim its free page; once it does, you are connected and each of you sees the other here.
      </p>

      {groups.length > 0 && (
        <section aria-labelledby="rel-sugg" className="space-y-3">
          <h2 id="rel-sugg" className="text-base font-semibold">
            We think you know
          </h2>
          <NetworkPicker slug={slug} groups={groups.map((g) => ({ key: g.key, label: g.label, items: g.items.map((i) => ({ orgId: i.orgId, name: i.name, reason: i.reason, onNextChapter: i.onNextChapter })) }))} disabled={!canEdit} />
        </section>
      )}

      {canEdit && (
        <section aria-labelledby="rel-find" className="space-y-3">
          <h2 id="rel-find" className="text-base font-semibold">
            Find an organization
          </h2>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rel-q">Name</Label>
              <Input id="rel-q" name="q" defaultValue={q} placeholder="e.g. Jefferson Community" className="w-72" />
            </div>
            <Button type="submit" variant="outline">
              Search organizations
            </Button>
          </form>
          {q && (
            results.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {results.map((r) => (
                  <li key={r.crmOrgId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <span className="text-sm">
                      <a href={`${SITE_URL}/prepared/${r.slug}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                        {r.name}
                      </a>
                      <span className="ml-2 text-xs text-muted-foreground">{ecoKindLabel(partnerKindFor(r.orgTypes))}</span>
                    </span>
                    {linkedIds.has(r.slug) ? <span className="text-xs text-muted-foreground">Linked</span> : <LinkOrgButton slug={slug} crmOrgId={r.crmOrgId} orgName={r.name} inviter={inviter} />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No organization with its own page starts with “{q}”. Try the first word of its name.</p>
            )
          )}
        </section>
      )}

      <section aria-labelledby="rel-linked" className="space-y-2">
        <h2 id="rel-linked" className="text-base font-semibold">
          Organizations you linked <span className="text-sm font-normal text-muted-foreground">{linked.length}</span>
        </h2>
        {linked.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {linked.map((l) => (
              <li key={l.id} className="space-y-2 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm">
                    <span className="font-medium">{l.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{ecoKindLabel(l.kind)}</span>
                  </span>
                  <span className={l.state === 'connected' ? 'text-xs font-medium text-success' : 'text-xs text-muted-foreground'}>{STATE_LABEL[l.state]}</span>
                </div>
                {l.state !== 'connected' && canEdit && <RelatedInvite inviteUrl={l.inviteUrl} orgName={l.name} inviter={inviter} slug={slug} />}
                {canEdit && (
                  <ConfirmActionButton label="Remove" variant="outline" confirm={`Remove ${l.name} from your related organizations?`} confirmLabel="Remove" run={removeRelatedOrgAction.bind(null, slug, l.id)} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Network} title="No related organizations yet" description="Search above for a college, employer or board you work with, then send it the invite." />
        )}
      </section>

      {linkedYou.length > 0 && (
        <section aria-labelledby="rel-you" className="space-y-2">
          <h2 id="rel-you" className="text-base font-semibold">
            Organizations that linked you
          </h2>
          <ul className="flex flex-wrap gap-2">
            {linkedYou.map((o) => (
              <li key={o.slug} className="rounded-full border border-border bg-card px-3 py-1 text-sm">
                {o.name}
              </li>
            ))}
          </ul>
        </section>
      )}
      {ctx.workspaces.includes('hub') && (
        <p className="text-xs text-muted-foreground">
          Linked organizations also show on the Talent Hub&apos;s{' '}
          <Link href={`${orgBasePath(slug, ctx.institution.orgType)}/workforce-hub/ecosystem`} className="underline">
            Ecosystem
          </Link>{' '}
          tab.
        </p>
      )}
    </div>
  )
}
