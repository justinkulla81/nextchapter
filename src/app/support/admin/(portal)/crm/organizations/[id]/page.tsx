import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CrmIntroPaths } from '@/components/admin/CrmIntroPaths'
import { ORG_TYPE_LABELS, ELIGIBILITY_LABELS, formatDate } from '@/lib/crm/labels'

export const maxDuration = 30

export default async function CrmOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const org = await prisma.crmOrganization.findUnique({
    where: { id },
    include: {
      affiliations: { include: { person: { select: { id: true, fullName: true, roles: true, lastTouchedAt: true } } } },
      opportunities: { include: { pipeline: true, stage: true } },
      deadlines: { orderBy: [{ dueAt: 'asc' }] },
      researchItems: true,
      introPathsAsTarget: {
        include: { connectorPerson: { select: { id: true, fullName: true } } },
        orderBy: [{ strength: 'asc' }, { createdAt: 'asc' }],
      },
      investorProfile: true,
      outplacementProfile: true,
      partnerProfile: true,
      researchProfile: true,
      company: { select: { id: true, name: true } },
    },
  })
  if (!org) notFound()

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm/organizations" className="text-muted-foreground hover:underline">← All organizations</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">{org.name}</h1>
        <p className="mt-1 flex flex-wrap gap-1">
          {org.orgTypes.map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">{ORG_TYPE_LABELS[t]}</span>
          ))}
        </p>
        <p className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
          {org.hqRegion && <span>{org.hqRegion}</span>}
          {org.website && <a href={org.website} target="_blank" rel="noreferrer" className="underline">Website</a>}
          {org.company && <Link href={`/support/admin/companies/${org.company.id}`} className="underline">Company intel</Link>}
        </p>
        {org.focus && <p className="mt-3 max-w-3xl text-sm">{org.focus}</p>}
      </header>

      {org.investorProfile && (
        <section className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold">Investor profile</h2>
          <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
            <Field label="Check size" value={org.investorProfile.checkSizeNote} />
            <Field label="Eligibility" value={ELIGIBILITY_LABELS[org.investorProfile.eligibility]} />
            <Field label="Responsiveness (estimate)" value={org.investorProfile.responsiveness} />
          </dl>
          {org.investorProfile.thesis && <p className="mt-3 text-sm text-muted-foreground">{org.investorProfile.thesis}</p>}
        </section>
      )}

      {org.outplacementProfile && (
        <section className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold">Outplacement lead</h2>
          <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-4">
            <Field label="Headcount affected" value={org.outplacementProfile.headcountAffected?.toLocaleString() ?? null} />
            <Field label="White collar" value={org.outplacementProfile.pctWhiteCollar} />
            <Field label="Announced" value={org.outplacementProfile.announcedAt ? formatDate(org.outplacementProfile.announcedAt) : null} />
            <Field label="Incumbent provider" value={org.outplacementProfile.incumbentProvider} />
          </dl>
        </section>
      )}

      {org.affiliations.length === 0 && (
        <p className="rounded-lg border border-orange/40 bg-orange/5 p-3 text-sm">
          Nobody here is in your network. A route in is the whole job for this one — add one below.
        </p>
      )}

      <CrmIntroPaths
        targetOrgId={org.id}
        targetName={org.name}
        paths={org.introPathsAsTarget.map((p) => ({
          id: p.id,
          connectorPersonId: p.connectorPersonId,
          connectorName: p.connectorName,
          connectorRecordName: p.connectorPerson?.fullName ?? null,
          relationshipNote: p.relationshipNote,
          strength: p.strength,
          status: p.status,
          askedAt: p.askedAt ? p.askedAt.toISOString() : null,
        }))}
      />

      <section>
        <h2 className="mb-2 text-lg font-semibold">People ({org.affiliations.length})</h2>
        {org.affiliations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nobody here yet. Add someone from the people page.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {org.affiliations.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <Link href={`/support/admin/crm/people/${a.person.id}`} className="font-medium hover:underline">{a.person.fullName}</Link>
                  {a.title && <span className="text-muted-foreground"> — {a.title}</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {a.person.lastTouchedAt ? `Last contacted ${formatDate(a.person.lastTouchedAt)}` : 'Never contacted'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {org.deadlines.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Dates</h2>
          <ul className="rounded-lg border border-border divide-y divide-border">
            {org.deadlines.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="font-medium">{d.label}</span>
                <span className="text-xs text-muted-foreground">
                  {d.dueAt ? formatDate(d.dueAt) : `${d.rawText ?? 'No date'} — no date to track`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {org.opportunities.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Pipelines</h2>
          <ul className="rounded-lg border border-border divide-y divide-border">
            {org.opportunities.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>{o.title}</span>
                <span className="text-xs text-muted-foreground">{o.pipeline.label} · {o.stage.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value ?? '—'}</dd>
    </div>
  )
}
