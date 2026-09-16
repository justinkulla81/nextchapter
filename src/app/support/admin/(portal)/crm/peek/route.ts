import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { ORG_TYPE_LABELS, sinceLabel, formatDate } from '@/lib/crm/labels'

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
      affiliations: {
        include: { org: { select: { id: true, name: true, _count: { select: { affiliations: true } } } } },
        orderBy: { isPrimary: 'desc' },
      },
      activities: { orderBy: { occurredAt: 'desc' }, take: 8 },
      opportunities: { include: { pipeline: true, stage: true }, take: 5 },
      introPathsAsTarget: { include: { connectorPerson: { select: { fullName: true } } }, take: 5 },
    },
  })
  if (!person) return Response.json({ error: 'Not found' }, { status: 404 })
  const primaryOrg = person.affiliations[0]?.org ?? null

  return Response.json({
    kind: 'person',
    id: person.id,
    title: person.fullName,
    subtitle: person.affiliations[0]?.title ?? null,
    href: `/support/admin/crm/people/${person.id}`,
    // Raw enum values — the panel edits these directly via a multi-select
    // (CrmInlineRoles), not just displays them.
    roles: person.roles,
    // Raw enum values for the panel's own inline <select>s — QUALITY_LABELS
    // etc. are used to render the option list client-side.
    editable: { leadQuality: person.leadQuality, warmth: person.warmth, priority: person.priority },
    company: primaryOrg
      ? { id: primaryOrg.id, name: primaryOrg.name, otherPeopleCount: Math.max(0, primaryOrg._count.affiliations - 1) }
      : null,
    facts: [
      { label: 'Last contacted', value: sinceLabel(person.lastTouchedAt) },
      { label: 'Touches', value: String(person.touchCount) },
      person.email ? { label: 'Email', value: person.email } : null,
      person.phone ? { label: 'Phone', value: person.phone } : null,
    ].filter(Boolean),
    body: person.notes ?? null,
    linkedinUrl: person.linkedinUrl,
    // A follow-up can be flagged with no specific date — dueAt is null then,
    // not the whole follow-up.
    followUp: person.nextFollowUpAt || person.nextFollowUpNote
      ? { dueAt: person.nextFollowUpAt ? formatDate(person.nextFollowUpAt) : null, note: person.nextFollowUpNote }
      : null,
    activities: person.activities.map((a) => ({
      subject: a.subject ?? a.type, when: formatDate(a.occurredAt), auto: a.isAutoLogged, body: a.body,
      // FIELD_CHANGED/STAGE_CHANGED are record edits, not contact with the
      // person — kept as their own "Profile activity" block in the panel,
      // separate from real interactions (calls, emails, meetings, ...).
      isProfileChange: a.type === 'FIELD_CHANGED' || a.type === 'STAGE_CHANGED',
    })),
    pipelines: person.opportunities.map((o) => ({ label: o.pipeline.label, stage: o.stage.label })),
    paths: person.introPathsAsTarget.map((p) => ({
      via: p.connectorPerson?.fullName ?? p.connectorName ?? 'Unknown',
      strength: p.strength, status: p.status,
    })),
  })
}
