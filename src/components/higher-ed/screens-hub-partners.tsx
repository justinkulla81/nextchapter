// Talent Hub › Partners › Partner views: make, copy and switch off the read-only links an organization shares with colleges and employers.

import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { mainOrigin } from '@/lib/org-hosts'
import { PARTNER_KINDS, VIEW_SCOPES, viewStatus, viewUrl } from '@/lib/workforce/partner-views'
import { StatTile } from './StatTile'
import { CopyLink, PartnerViewForm, RevokeViewButton } from './HubPartnerForms'

type Props = { ctx: WorkspaceContext; searchParams: object; base: string }

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '—')
const scopeShort: Record<string, string> = { SKILLS: 'Skills', TALENT: 'Talent counts', PROFILES: 'Profiles', JOBS: 'Jobs', PROGRAMS: 'Programs' }

export async function HubPartnerViews({ ctx }: Props) {
  const slug = ctx.institution.slug
  const rows = await prisma.partnerView
    .findMany({ where: { institutionId: ctx.institution.id }, orderBy: { createdAt: 'desc' }, take: 100 })
    .catch(() => [])
  const origin = mainOrigin()
  const withStatus = rows.map((r) => ({ ...r, status: viewStatus(r) }))
  const active = withStatus.filter((r) => r.status === 'Active')
  const opens = rows.reduce((n, r) => n + r.openCount, 0)
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Give a college, a training provider or an employer a read-only view of the skills and talent picture for your region, so they can plan programs and hiring around it. It opens from a link you send; no account is needed. You choose what it includes, it expires, and you can switch it off at any time.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active views" value={active.length} />
        <StatTile label="Times opened" value={opens.toLocaleString()} note="By anyone with a link" />
        <StatTile label="Switched off or expired" value={withStatus.length - active.length} />
      </div>

      {!ctx.readOnly ? (
        <details className="rounded-lg border border-border bg-card p-4" open={rows.length === 0}>
          <summary className="cursor-pointer text-sm font-medium text-[color:var(--accent-text,var(--primary))]">Make a partner view</summary>
          <div className="pt-3">
            <PartnerViewForm slug={slug} />
          </div>
        </details>
      ) : (
        <p className="text-sm text-muted-foreground">Making a view is off in this read-only preview. A staff member makes one here and sends the link.</p>
      )}

      <section className="space-y-3" aria-labelledby="views-h">
        <h2 id="views-h" className="text-base font-semibold">
          Views you have made
        </h2>
        {withStatus.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">None yet. Make one for a college or an employer you work with.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Partner', 'Includes', 'Opened', 'Expires', 'Status', ''].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withStatus.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="min-w-44 px-3 py-2">
                      <span className="font-medium">{r.partnerName}</span>
                      <span className="block text-xs text-muted-foreground">{PARTNER_KINDS.find((k) => k.key === r.partnerKind)?.label ?? r.partnerKind}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{VIEW_SCOPES.filter((s) => r.scopes.includes(s.key)).map((s) => scopeShort[s.key]).join(', ')}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.openCount.toLocaleString()}
                      <span className="block text-xs text-muted-foreground">{r.lastOpenedAt ? `last ${day(r.lastOpenedAt)}` : 'not yet'}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">{day(r.expiresAt)}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2">
                      {r.status === 'Active' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <CopyLink url={viewUrl(origin, slug, r.token)} viewId={r.id} slug={slug} />
                          <a href={viewUrl(origin, slug, r.token)} target="_blank" rel="noreferrer" className="text-[color:var(--accent-text,var(--primary))] hover:underline">
                            Open
                          </a>
                          {!ctx.readOnly && <RevokeViewButton slug={slug} id={r.id} name={r.partnerName} />}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
