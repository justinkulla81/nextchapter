// Talent Hub › Partners › Ecosystem: the directory of colleges, employers and providers in the region, an invitation link for each, the
// requests to join that come back, and the steward's confirm or decline. Invitations are copied and sent by the steward; nothing is
// emailed from here. A claim is a request: it gives the partner no access.

import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { mainOrigin } from '@/lib/org-hosts'
import { readProfile } from '@/lib/higher-ed/profile'
import { COMMITMENTS, ECO_STATUSES, commitmentLabel, ecoKindLabel, ecoStatusLabel, inviteMessage, inviteUrl } from '@/lib/workforce/ecosystem'
import { StatTile } from './StatTile'
import { AddPartnerForm, CopyText, DecideButtons, GiveAccessForm, InviteButton, RemoveAccessButton, RemovePartnerButton, SeedButton } from './HubEcosystemForms'
import { FREE_PARTNER_CONTACTS } from '@/lib/workforce/partner-access-rules'
import { planOf } from '@/lib/plans/entitlements'

type Props = { ctx: WorkspaceContext; searchParams: object; base: string }

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '—')

export async function HubEcosystem({ ctx }: Props) {
  const slug = ctx.institution.slug
  const [rows, contacts, inst] = await Promise.all([
    prisma.ecosystemPartner.findMany({ where: { institutionId: ctx.institution.id }, orderBy: [{ status: 'asc' }, { name: 'asc' }], take: 300 }).catch(() => []),
    prisma.ecosystemPartnerContact.findMany({ where: { institutionId: ctx.institution.id }, orderBy: { createdAt: 'asc' }, take: 300, select: { id: true, partnerId: true, email: true, acceptedAt: true } }).catch(() => []),
    prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { name: true, programBrandName: true, profile: true } }),
  ])
  const origin = mainOrigin()
  const orgName = inst.programBrandName ?? inst.name
  const region = readProfile(inst.profile).region?.name ?? null
  const count = (s: string) => rows.filter((r) => r.status === s).length
  const waiting = rows.filter((r) => r.status === 'CLAIMED')
  const confirmed = rows.filter((r) => r.status === 'CONFIRMED')
  const free = planOf(ctx.institution.plan) === 'FREE'
  const commitments = rows.filter((r) => r.status === 'CONFIRMED').reduce((n, r) => n + r.commitments.length, 0)
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        The colleges, employers and providers in your region, and whether each has joined your talent network. Invite one and you get a link and a message to send yourself. They tell you who they are and what they can offer; you confirm. Asking to join gives a partner no access to anything.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="In the directory" value={rows.length} />
        <StatTile label="Invited" value={count('INVITED')} />
        <StatTile label="Asked to join" value={waiting.length} note="Waiting for you" />
        <StatTile label="Confirmed" value={count('CONFIRMED')} note={`${commitments} commitments made`} />
      </div>

      {waiting.length > 0 && (
        <section className="space-y-3" aria-labelledby="waiting-h">
          <h2 id="waiting-h" className="text-base font-semibold">
            Waiting for you
          </h2>
          <ul className="space-y-3">
            {waiting.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">Asked {day(r.claimedAt)}</p>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {[r.claimName, r.claimTitle].filter(Boolean).join(', ')} · {r.claimEmail}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.emailDomainMatch === true ? 'The email is at the organization’s own domain.' : r.emailDomainMatch === false ? 'The email is not at the organization’s domain: check who this is before you confirm.' : 'We do not have a website for this organization, so the email could not be checked.'}
                </p>
                {r.commitments.length > 0 && <p className="mt-2">Offers: {r.commitments.map(commitmentLabel).join(', ')}</p>}
                {r.claimNote && <p className="mt-1 text-muted-foreground">“{r.claimNote}”</p>}
                {!ctx.readOnly && (
                  <div className="mt-3">
                    <DecideButtons slug={slug} id={r.id} name={r.name} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!ctx.readOnly ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <details className="rounded-lg border border-border bg-card p-4" open={rows.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-[color:var(--accent-text,var(--primary))]">Add an organization</summary>
            <div className="pt-3">
              <AddPartnerForm slug={slug} />
            </div>
          </details>
          <div className="rounded-lg border border-border bg-card p-4">
            <SeedButton slug={slug} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Inviting and confirming are off in this read-only preview. A staff member does both here.</p>
      )}

      <section className="space-y-3" aria-labelledby="dir-h">
        <h2 id="dir-h" className="text-base font-semibold">
          Directory
        </h2>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Nobody yet. Fill it from public data, or add an organization.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Organization', 'Status', 'Invitation', ''].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ECO_STATUSES.flatMap((st) => rows.filter((r) => r.status === st.key)).map((r) => {
                  const link = r.inviteToken ? inviteUrl(origin, slug, r.inviteToken) : null
                  return (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="min-w-48 px-3 py-2">
                        <span className="font-medium">{r.name}</span>
                        <span className="block text-xs text-muted-foreground">{ecoKindLabel(r.kind)}</span>
                      </td>
                      <td className="px-3 py-2">
                        {ecoStatusLabel(r.status)}
                        {r.status === 'CONFIRMED' && r.commitments.length > 0 && <span className="block text-xs text-muted-foreground">{r.commitments.map(commitmentLabel).join(', ')}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {link ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <CopyText text={inviteMessage({ partner: r.name, org: orgName, region, link })} label="Copy message" partnerId={r.id} slug={slug} what="message" />
                            <CopyText text={link} label="Copy link" partnerId={r.id} slug={slug} what="link" />
                            <span className="text-xs text-muted-foreground">{r.invitedAt ? `made ${day(r.invitedAt)}` : ''}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {!ctx.readOnly && (
                          <div className="flex flex-wrap items-center gap-2">
                            {r.status !== 'CONFIRMED' && <InviteButton slug={slug} id={r.id} again={!!r.inviteToken} />}
                            <RemovePartnerButton slug={slug} id={r.id} name={r.name} />
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {confirmed.length > 0 && (
        <section className="space-y-3" aria-labelledby="pages-h">
          <h2 id="pages-h" className="text-base font-semibold">
            Partner pages
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Give a confirmed partner’s contact their own page: what they offered, a way to update it, and anything you share with them. It shows nothing about individual job seekers.
            {free ? ` Your free workspace gives access to ${FREE_PARTNER_CONTACTS} people (${contacts.length} used).` : ''}
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {confirmed.map((r) => {
              const mine = contacts.filter((c) => c.partnerId === r.id)
              return (
                <li key={r.id} className="space-y-2 p-3 text-sm">
                  <p className="font-medium">{r.name}</p>
                  {mine.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {c.email} <span className="text-xs text-muted-foreground">· {c.acceptedAt ? 'Signed in' : 'Invited'}</span>
                      </span>
                      {!ctx.readOnly && <RemoveAccessButton slug={slug} id={c.id} email={c.email} />}
                    </div>
                  ))}
                  {!ctx.readOnly && <GiveAccessForm slug={slug} partnerId={r.id} name={r.name} defaultEmail={r.claimEmail ?? ''} />}
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <p className="max-w-3xl text-xs text-muted-foreground">What a partner can offer when it asks to join: {COMMITMENTS.map((c) => c.label.toLowerCase()).join('; ')}.</p>
    </div>
  )
}
