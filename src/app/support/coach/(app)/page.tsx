import { prisma } from '@/lib/prisma'
import { getCurrentCoach } from '@/lib/coach/current-coach'
import { getCoachImpactReport } from '@/lib/coach/impact-report'
import { getCoachUnreadCount } from '@/lib/messaging/threads'
import { getCoachCaseload } from '@/lib/coach/caseload'
import { firstName, PortalHomeHeader, PortalHomeMore, PortalLinks, PortalNeeds, PortalNumbers, PortalTable, type NeedsItem } from '@/components/partners/PortalHome'

const HIGH_NEED_TAG = 'comfort_with_high_need_candidates'
const SPECIALIST_MIN_CLIENTS = 2
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function lastActive(d: Date | null, now: Date): string {
  if (!d) return 'Not yet'
  const days = Math.floor((now.getTime() - new Date(d).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

// The coach Home (the portal Home pattern, src/components/partners/PortalHome.tsx). Same reads as before: no new query.
export default async function CoachHomePage() {
  const coach = await getCurrentCoach()

  const [clientCount, impact, unreadMessages, caseload, pendingInvites] = await Promise.all([
    prisma.candidateProfile.count({ where: { coachId: coach.id } }),
    getCoachImpactReport(coach.id),
    getCoachUnreadCount(coach.id),
    getCoachCaseload(coach.id),
    prisma.coachClientInvite.count({ where: { coachId: coach.id, acceptedAt: null } }),
  ])
  const isSpecialist = coach.specializationTags.includes(HIGH_NEED_TAG) && clientCount >= SPECIALIST_MIN_CLIENTS
  const clientsHref = `/support/coach/clients/${coach.accessToken}`
  const clientHref = (id: string) => `${clientsHref}/${id}`
  const now = new Date()
  const activeThisWeek = caseload.filter((c) => c.activityThisWeekPoints > 0).length

  // Risk first (a real trigger), then quiet clients, then the inbox.
  const needs: NeedsItem[] = [
    ...caseload.flatMap((c) =>
      c.triggers.filter((t) => t.type === 'RISK').map((t) => ({ key: `risk_${t.key}`, title: `${c.name}: ${t.label}`, why: t.detail, href: clientHref(c.id), action: 'Open the client' })),
    ),
    ...caseload
      .filter((c) => c.isStalled && !c.triggers.some((t) => t.type === 'RISK'))
      .map((c) => ({
        key: 'stalled',
        title: `${c.name} has gone quiet`,
        why: `${c.weekNumber !== null ? `Week ${c.weekNumber}` : 'Not started yet'}${c.executionGrade ? `, grade ${c.executionGrade}` : ''}. Last active: ${lastActive(c.lastActiveAt, now).toLowerCase()}.`,
        href: clientHref(c.id),
        action: 'Open the client',
      })),
    ...(unreadMessages > 0 ? [{ key: 'unread_messages', title: plural(unreadMessages, 'unread message'), why: 'From your clients.', href: '/support/coach/messages', action: 'Open messages' }] : []),
    ...(pendingInvites > 0
      ? [{ key: 'pending_invites', title: `${plural(pendingInvites, 'invitation')} not accepted yet`, why: 'A short note from you is often what gets someone to join.', href: '/support/coach/invite-client', action: 'See invitations' }]
      : []),
  ]

  const name = firstName(coach.fullName)
  return (
    <div className="space-y-8">
      <PortalHomeHeader
        portal="coach"
        eyebrow={[coach.firmName ?? 'Coach', isSpecialist ? 'High-need specialist' : null].filter(Boolean).join(' · ')}
        title={name ? `Welcome back, ${name}` : 'Welcome back'}
        intro={
          clientCount === 0
            ? 'Invite someone you already coach. Once they join, their weekly progress, grade and stalls show up here.'
            : `${plural(clientCount, 'client')}, ${activeThisWeek} active this week.`
        }
        action={clientCount === 0 ? { href: '/support/coach/invite-client', label: 'Invite a client' } : { href: clientsHref, label: 'Open your clients' }}
      />

      <PortalNeeds portal="coach" title="Before your next sessions" items={needs} empty="No client needs you right now: nobody is stalled or at risk." />

      <PortalNumbers
        items={[
          { value: String(clientCount), label: 'Active clients', source: 'Linked to you on NextChapter' },
          { value: String(activeThisWeek), label: 'Active this week', source: 'Did search work this week' },
          { value: String(impact.improved), label: 'Improved their grade', source: `This quarter, of ${plural(impact.clientCount, 'client')}${impact.declined > 0 ? `; ${impact.declined} declined` : ''}`, highlight: true },
        ]}
      />

      <PortalTable
        title="Your clients"
        link={clientCount > 0 ? { href: clientsHref, label: `See all ${clientCount}` } : undefined}
        columns={['Client', 'Search week', 'Grade', 'This week', 'Last active']}
        rows={caseload.slice(0, 8).map((c) => ({
          key: c.id,
          href: clientHref(c.id),
          cells: [
            c.name,
            c.weekNumber !== null ? `Week ${c.weekNumber}` : 'Not started',
            c.executionGrade ?? '—',
            c.isStalled ? 'Quiet' : `${c.activityThisWeekPoints} min of search work`,
            lastActive(c.lastActiveAt, now),
          ],
        }))}
        empty="No clients yet. Invite someone you coach and they show here."
      />

      <PortalHomeMore label="More for coaches">
        <PortalLinks
          links={[
            { href: '/support/coach/invite-client', label: 'Invite a client by email', line: 'They skip the confirmation step and start right away.' },
            { href: `/support/coach/invite/${coach.accessToken}`, label: 'Share your invite link', line: 'A link anyone can sign up through.' },
            { href: '/support/coach/settings', label: 'Settings', line: 'Branding and your coaching onboarding form.' },
            { href: '/auth/forgot-password', label: 'Change password', line: 'We email you a link.' },
          ]}
        />
      </PortalHomeMore>
    </div>
  )
}
