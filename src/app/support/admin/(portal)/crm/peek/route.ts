import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CRM_ACTIVITY_CUTOFF } from '@/lib/crm/cutoff'
import { ORG_TYPE_LABELS, sinceLabel, formatDate, MEMBERSHIP_STATUS_LABELS } from '@/lib/crm/labels'

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
      activities: {
        where: { occurredAt: { gte: CRM_ACTIVITY_CUTOFF } },
        orderBy: { occurredAt: 'desc' }, take: 8,
      },
      opportunities: { include: { pipeline: true, stage: true }, take: 5 },
      introPathsAsTarget: { include: { connectorPerson: { select: { fullName: true } } }, take: 5 },
      candidate: { select: { id: true, createdAt: true, membershipSubscription: { select: { status: true } } } },
    },
  })
  if (!person) return Response.json({ error: 'Not found' }, { status: 404 })
  // Sign-ups that look like someone invited from here, waiting on a yes/no.
  const inviteMatches = person.candidateId ? [] : await prisma.candidateIdentityMatch.findMany({
    where: { source: 'CRM_INVITE', sourceRecordId: person.id, status: 'PENDING' },
    select: { id: true, strength: true, candidate: { select: { firstName: true, lastName: true, email: true, createdAt: true } } },
  })
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
    // Editable in the panel now (CrmEmailBackfillPrompt / CrmInlineText /
    // CrmInlineGoals) rather than static facts — email used to sit in the
    // `facts` list below with no way to add or fix it from here at all.
    email: person.email,
    location: person.location,
    goals: person.goals,
    company: primaryOrg
      ? { id: primaryOrg.id, name: primaryOrg.name, otherPeopleCount: Math.max(0, primaryOrg._count.affiliations - 1) }
      : null,
    facts: [
      { label: 'Last contacted', value: sinceLabel(person.lastTouchedAt) },
      { label: 'Touches', value: String(person.touchCount) },
      person.phone ? { label: 'Phone', value: person.phone } : null,
      // Only set when this person is also a real NextChapter candidate.
      person.candidate ? { label: 'Membership', value: MEMBERSHIP_STATUS_LABELS[person.candidate.membershipSubscription?.status ?? 'FREE'] } : null,
    ].filter(Boolean),
    awaitingReply: person.awaitingReplySince !== null,
    nextChapter: {
      account: person.candidate
        ? { href: `/support/admin/candidates/${person.candidate.id}`, since: formatDate(person.candidate.createdAt) }
        : null,
      invitedAt: person.candidateInvitedAt ? formatDate(person.candidateInvitedAt) : null,
      possibleSignups: inviteMatches.map((m) => ({
        matchId: m.id,
        name: [m.candidate.firstName, m.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed',
        email: m.candidate.email,
        signedUp: formatDate(m.candidate.createdAt),
        sameEmail: m.strength === 'EMAIL_EXACT',
      })),
    },
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
