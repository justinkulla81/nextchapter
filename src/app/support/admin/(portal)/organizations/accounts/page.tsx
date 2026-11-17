import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { accountsOverview, type AccountKind } from '@/lib/admin/accounts-overview'
import { SITE_URL } from '@/lib/org-claims/urls'
import { orgBasePath } from '@/lib/higher-ed/workspaces'
import type { InstitutionOrgType } from '@prisma/client'

export const metadata = { title: 'Accounts' }
export const dynamic = 'force-dynamic'

const SHOW: { key: AccountKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'demo', label: 'Demo' },
  { key: 'free', label: 'Free' },
  { key: 'paid', label: 'Paid' },
]
const TYPE: Record<string, string> = { COLLEGE: 'College', WORKFORCE_BOARD: 'Workforce board', ECONOMIC_DEVELOPMENT: 'Economic development', CHAMBER: 'Chamber', COMMUNITY_ORG: 'Community organization' }
const TIER: Record<string, string> = { CAREER: 'Career', ADVANCEMENT: 'Advancement', INSTITUTION: 'Institution' }
const day = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
const BADGE: Record<AccountKind, string> = { demo: 'bg-warn/20 text-foreground', free: 'bg-muted text-foreground', paid: 'bg-success/15 text-success' }
const LABEL: Record<AccountKind, string> = { demo: 'Demo', free: 'Free', paid: 'Paid' }

function Badge({ kind, extra }: { kind: AccountKind; extra?: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[kind]}`}>
      {LABEL[kind]}
      {extra ? ` · ${extra}` : ''}
    </span>
  )
}

const TH = 'px-3 py-2 font-medium'
const TD = 'px-3 py-2 align-top'

// Every organization account: demo, free or paid, and how much it is used (last 30 days).
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin()
  const wanted = (await searchParams).show
  const show = SHOW.find((s) => s.key === wanted)?.key ?? 'all'
  const data = await accountsOverview()
  const all = [...data.institutions, ...data.hiring, ...data.outplacement]
  const total = (k: AccountKind) => all.filter((a) => a.account === k).length
  const keep = <T extends { account: AccountKind }>(rows: T[]) => (show === 'all' ? rows : rows.filter((r) => r.account === show))
  const insts = keep(data.institutions)
  const hiring = keep(data.hiring)
  const outp = keep(data.outplacement)
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          Every organization account: demo, free or paid, and how much it is used. Usage is the last 30 days. Free accounts come from approved page claims; paid
          is a paid plan, a paid hiring workspace or an active contract.
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-3 sm:max-w-xl">
        {(['demo', 'free', 'paid'] as const).map((k) => (
          <div key={k} className="rounded-lg border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">{LABEL[k]}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{total(k)}</dd>
          </div>
        ))}
      </dl>

      <nav aria-label="Show" className="flex flex-wrap gap-2">
        {SHOW.map((s) => (
          <Link
            key={s.key}
            href={s.key === 'all' ? '?' : `?show=${s.key}`}
            aria-current={s.key === show ? 'page' : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm ${s.key === show ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="acc-inst" className="space-y-2">
        <h2 id="acc-inst" className="text-lg font-semibold">
          Colleges and workforce organizations <span className="text-sm font-normal text-muted-foreground">{insts.length}</span>
        </h2>
        {insts.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>Organization</th>
                  <th className={TH}>Account</th>
                  <th className={TH}>Since</th>
                  <th className={TH}>Staff</th>
                  <th className={TH}>Members</th>
                  <th className={TH}>Joined, 30 days</th>
                  <th className={TH}>Staff actions, 30 days</th>
                  <th className={TH}>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {insts.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className={TD}>
                      <a href={`${SITE_URL}${orgBasePath(i.slug, i.type as InstitutionOrgType)}`} className="font-medium text-primary hover:underline">
                        {i.name}
                      </a>
                      <span className="block text-xs text-muted-foreground">{TYPE[i.type] ?? i.type}</span>
                    </td>
                    <td className={TD}>
                      <Badge kind={i.account} extra={i.account === 'free' ? undefined : TIER[i.tier]} />
                      {i.demoRequestedBy && <span className="mt-1 block text-xs text-muted-foreground">For {i.demoRequestedBy}</span>}
                      {i.demoExpiresAt && <span className="block text-xs text-muted-foreground">Expires {day(i.demoExpiresAt)}</span>}
                    </td>
                    <td className={TD}>{day(i.createdAt)}</td>
                    <td className={TD}>
                      {i.staffActive} active
                      {i.staffInvited > 0 && <span className="block text-xs text-muted-foreground">{i.staffInvited} invited, not signed in</span>}
                    </td>
                    <td className={TD}>
                      {i.members.toLocaleString()}
                      <span className="block text-xs text-muted-foreground">{i.joined.toLocaleString()} joined</span>
                    </td>
                    <td className={TD}>{i.joined30.toLocaleString()}</td>
                    <td className={TD}>{i.actions30.toLocaleString()}</td>
                    <td className={TD}>{day(i.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Demo members are sample people. Staff actions are what the organization&apos;s own staff did in the portal (exports, branding, team, settings). Change a
          plan in <Link href="/support/admin/institutions" className="underline">Institutions</Link>.
        </p>
      </section>

      <section aria-labelledby="acc-hiring" className="space-y-2">
        <h2 id="acc-hiring" className="text-lg font-semibold">
          Employers: Hiring <span className="text-sm font-normal text-muted-foreground">{hiring.length}</span>
        </h2>
        {hiring.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>Company</th>
                  <th className={TH}>Account</th>
                  <th className={TH}>Since</th>
                  <th className={TH}>Active roles</th>
                  <th className={TH}>Page views, 30 days</th>
                  <th className={TH}>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {hiring.map((h) => (
                  <tr key={h.id} className="border-t border-border">
                    <td className={`${TD} font-medium`}>{h.company}</td>
                    <td className={TD}>
                      <Badge kind={h.account} />
                    </td>
                    <td className={TD}>{day(h.createdAt)}</td>
                    <td className={TD}>{h.activeRoles}</td>
                    <td className={TD}>{h.views30.toLocaleString()}</td>
                    <td className={TD}>{day(h.lastView)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="acc-outp" className="space-y-2">
        <h2 id="acc-outp" className="text-lg font-semibold">
          Employers: Employees and Outplacement <span className="text-sm font-normal text-muted-foreground">{outp.length}</span>
        </h2>
        {outp.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>Company</th>
                  <th className={TH}>Account</th>
                  <th className={TH}>Since</th>
                  <th className={TH}>Active contracts</th>
                  <th className={TH}>Seats activated</th>
                  <th className={TH}>Page views, 30 days</th>
                  <th className={TH}>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {outp.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className={`${TD} font-medium`}>{o.name}</td>
                    <td className={TD}>
                      <Badge kind={o.account} extra={o.account === 'free' ? 'no active contract' : undefined} />
                    </td>
                    <td className={TD}>{day(o.createdAt)}</td>
                    <td className={TD}>{o.contracts}</td>
                    <td className={TD}>
                      {o.activated} of {o.seats}
                    </td>
                    <td className={TD}>{o.views30.toLocaleString()}</td>
                    <td className={TD}>{day(o.lastView)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {data.umbrellaDemos > 0 && (
        <p className="text-sm text-muted-foreground">
          {data.umbrellaDemos} demo {data.umbrellaDemos === 1 ? 'organization' : 'organizations'} also in <Link href="/support/admin/organizations" className="underline">Organizations</Link>.
        </p>
      )}
    </div>
  )
}
