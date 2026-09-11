import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { PERSON_ROLE_LABELS, ORG_TYPE_LABELS, QUALITY_LABELS, WARMTH_LABELS, sinceLabel, formatDate } from '@/lib/crm/labels'

export const maxDuration = 20

/**
 * Compact summary for the slide-over.
 *
 * Returns only what the panel shows. The full record page still exists and the
 * panel links to it — this is for the common case of "who is this again",
 * which should not cost a navigation and a full re-render of a 100-row table.
 */
export async function GET(req: NextRequest) {
  await requireAdmin()
  const id = req.nextUrl.searchParams.get('id')
  const kind = req.nextUrl.searchParams.get('kind') ?? 'person'
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  if (kind === 'org') {
    const org = await prisma.crmOrganization.findUnique({
      where: { id },
      include: {
        investorProfile: true,
        outplacementProfile: true,
        affiliations: {
          take: 8,
          include: { person: { select: { id: true, fullName: true, lastTouchedAt: true } } },
        },
        opportunities: { include: { pipeline: true, stage: true }, take: 5 },
        deadlines: { where: { dueAt: { not: null } }, orderBy: { dueAt: 'asc' }, take: 3 },
        _count: { select: { affiliations: true } },
      },
    })
    if (!org) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({
      kind: 'org',
      id: org.id,
      title: org.name,
      subtitle: org.orgTypes.map((t) => ORG_TYPE_LABELS[t]).join(' · '),
      href: `/support/admin/crm/organizations/${org.id}`,
      facts: [
        org.hqRegion ? { label: 'Where', value: org.hqRegion } : null,
        org.investorProfile?.checkSizeNote ? { label: 'Check size', value: org.investorProfile.checkSizeNote } : null,
        org.investorProfile?.responsiveness ? { label: 'Responsiveness (est.)', value: org.investorProfile.responsiveness } : null,
        org.outplacementProfile?.headcountAffected
          ? { label: 'Roles affected', value: org.outplacementProfile.headcountAffected.toLocaleString() } : null,
        { label: 'People we know', value: String(org._count.affiliations) },
      ].filter(Boolean),
      body: org.focus ?? null,
      people: org.affiliations.map((a) => ({
        id: a.person.id, name: a.person.fullName, detail: a.title ?? null,
        touched: sinceLabel(a.person.lastTouchedAt),
      })),
      pipelines: org.opportunities.map((o) => ({ label: o.pipeline.label, stage: o.stage.label })),
      dates: org.deadlines.map((d) => ({ label: d.label, value: formatDate(d.dueAt) })),
    })
  }

  const person = await prisma.crmPerson.findUnique({
    where: { id },
    include: {
      affiliations: { include: { org: { select: { id: true, name: true } } }, orderBy: { isPrimary: 'desc' } },
      activities: { orderBy: { occurredAt: 'desc' }, take: 5 },
      opportunities: { include: { pipeline: true, stage: true }, take: 5 },
      introPathsAsTarget: { include: { connectorPerson: { select: { fullName: true } } }, take: 5 },
    },
  })
  if (!person) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({
    kind: 'person',
    id: person.id,
    title: person.fullName,
    subtitle: [person.affiliations[0]?.title, person.affiliations[0]?.org.name].filter(Boolean).join(' at ') || null,
    href: `/support/admin/crm/people/${person.id}`,
    roles: person.roles.map((r) => PERSON_ROLE_LABELS[r]),
    facts: [
      { label: 'Quality', value: QUALITY_LABELS[person.leadQuality] },
      { label: 'Warmth', value: WARMTH_LABELS[person.warmth] },
      { label: 'Last contacted', value: sinceLabel(person.lastTouchedAt) },
      { label: 'Touches', value: String(person.touchCount) },
      person.email ? { label: 'Email', value: person.email } : null,
    ].filter(Boolean),
    body: person.notes ?? null,
    linkedinUrl: person.linkedinUrl,
    activities: person.activities.map((a) => ({
      subject: a.subject ?? a.type, when: formatDate(a.occurredAt), auto: a.isAutoLogged,
    })),
    pipelines: person.opportunities.map((o) => ({ label: o.pipeline.label, stage: o.stage.label })),
    paths: person.introPathsAsTarget.map((p) => ({
      via: p.connectorPerson?.fullName ?? p.connectorName ?? 'Unknown',
      strength: p.strength, status: p.status,
    })),
  })
}
