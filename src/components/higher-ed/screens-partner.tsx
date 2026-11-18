// Partner view: what a person at a confirmed ecosystem partner sees. Only their own partner's page (what it offers, who has access on its
// side) and the read-only views the organization shared with it. Nothing about individual job seekers.

import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { mainOrigin } from '@/lib/org-hosts'
import { commitmentLabel, ecoKindLabel } from '@/lib/workforce/ecosystem'
import { VIEW_SCOPES, viewStatus, viewUrl } from '@/lib/workforce/partner-views'
import { CommitmentsForm } from './PartnerPageForms'

type Props = { ctx: WorkspaceContext; searchParams: object; base: string }

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '—')

async function myPartner(ctx: WorkspaceContext) {
  const id = ctx.partnerIds?.[0]
  if (!id) return null
  return prisma.ecosystemPartner.findFirst({ where: { id, institutionId: ctx.institution.id }, select: { id: true, name: true, kind: true, status: true, commitments: true, decidedAt: true } })
}

const Empty = () => <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">This is the page the people at a partner organization see when they sign in: what they offer, what you share with them, referrals and the feed. It fills in once a partner is added in the Partner Hub. If you are a partner and see this, ask the person who gave you access.</p>

export async function PartnerOverview({ ctx }: Props) {
  const partner = await myPartner(ctx)
  if (!partner) return <Empty />
  const org = ctx.institution.programBrandName ?? ctx.institution.name
  const contacts = await prisma.ecosystemPartnerContact.findMany({ where: { partnerId: partner.id }, orderBy: { createdAt: 'asc' }, take: 20, select: { email: true, acceptedAt: true } })
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">{partner.name}</h2>
        <p className="text-sm text-muted-foreground">
          {ecoKindLabel(partner.kind)} · {partner.status === 'CONFIRMED' ? `Confirmed by ${org}${partner.decidedAt ? ` on ${day(partner.decidedAt)}` : ''}` : 'Not confirmed'}
        </p>
      </div>
      <section className="space-y-3" aria-labelledby="offer-h">
        <h2 id="offer-h" className="text-base font-semibold">
          What you offer
        </h2>
        <p className="text-sm text-muted-foreground">
          {org} sees this on its Ecosystem screen. {partner.commitments.length > 0 ? `Today: ${partner.commitments.map(commitmentLabel).join(', ')}.` : 'You have not listed anything yet.'}
        </p>
        <CommitmentsForm slug={ctx.institution.slug} selected={partner.commitments} readOnly={ctx.readOnly} />
      </section>
      <section className="space-y-2" aria-labelledby="who-h">
        <h2 id="who-h" className="text-base font-semibold">
          Who has access on your side
        </h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Just you, for now.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {contacts.map((c) => (
              <li key={c.email}>
                {c.email} <span className="text-xs text-muted-foreground">· {c.acceptedAt ? 'Signed in' : 'Invited'}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">To add or remove someone, ask {org}.</p>
      </section>
    </div>
  )
}

export async function PartnerShared({ ctx }: Props) {
  const partner = await myPartner(ctx)
  if (!partner) return <Empty />
  const org = ctx.institution.programBrandName ?? ctx.institution.name
  const origin = mainOrigin()
  const views = await prisma.partnerView.findMany({
    where: { ecosystemPartnerId: partner.id, institutionId: ctx.institution.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, token: true, scopes: true, note: true, expiresAt: true, revokedAt: true },
  })
  const open = views.filter((v) => viewStatus(v) === 'Active')
  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">What {org} shared with {partner.name}. Each is a read-only view of regional data, counts only, that expires on its own date.</p>
      {open.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Nothing shared with you yet. {org} can share the region’s skills, jobs and programs with you.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {open.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1 basis-64">
                <p className="font-medium">{v.scopes.map((s) => VIEW_SCOPES.find((x) => x.key === s)?.label ?? s).join(', ')}</p>
                {v.note && <p className="text-muted-foreground">“{v.note}”</p>}
                <p className="text-xs text-muted-foreground">Open until {day(v.expiresAt)}</p>
              </div>
              <a href={viewUrl(origin, ctx.institution.slug, v.token)} target="_blank" rel="noreferrer" className="font-medium text-[color:var(--accent-text,var(--primary))] hover:underline">
                Open the view
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
