import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { getEmployerUnreadCount } from '@/lib/messaging/threads'
import { getCandidatesLookingForYourRoles } from '@/lib/talent/candidate-discovery'
import { captureServerEvent } from '@/lib/posthog/server'
import { CandidateCard } from '@/components/talent/CandidateCard'

export default async function TalentHomePage() {
  const employer = await getTalentDashboardData()

  const [activeRoleCount, interactionsByStatus, jobBoardPostings, unreadMessages, candidatesLookingForRoles] = await Promise.all([
    prisma.roleProfile.count({ where: { employerId: employer.id, isActive: true } }),
    prisma.candidateInteraction.groupBy({ by: ['status'], where: { employerId: employer.id }, _count: true }),
    prisma.exclusiveJobPosting.findMany({
      where: { submittedByEmployerId: employer.id, archivedAt: null },
      select: { id: true, title: true, status: true, rejectionReason: true },
    }),
    getEmployerUnreadCount(employer.id),
    getCandidatesLookingForYourRoles(employer.id),
  ])

  if (candidatesLookingForRoles.length > 0) {
    captureServerEvent(employer.id, 'candidate_discovery_section_viewed', {
      employerId: employer.id,
      matchCount: candidatesLookingForRoles.length,
    })
  }

  const inConversation = interactionsByStatus.find((s) => s.status === 'IN_CONVERSATION')?._count ?? 0
  const hired = interactionsByStatus.find((s) => s.status === 'HIRED')?._count ?? 0
  const totalInteractions = interactionsByStatus.reduce((sum, s) => sum + s._count, 0)
  const rejectedPostings = jobBoardPostings.filter((p) => p.status === 'rejected')
  const pendingPostings = jobBoardPostings.filter((p) => p.status === 'pending')

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Hiring Managers</p>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back{employer.companyName ? `, ${employer.companyName}` : ''}</h1>
      </div>

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Needs your attention</h2>
        {rejectedPostings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing waiting on approval right now.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {rejectedPostings.map((p) => (
              <Link
                key={p.id}
                href="/talent/job-board/submissions"
                className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-primary"
              >
                <div>
                  <p className="font-medium text-foreground">{p.title} — rejected</p>
                  {p.rejectionReason && <p className="text-sm text-muted-foreground">{p.rejectionReason}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {candidatesLookingForRoles.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
            Candidates looking for roles like yours
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Matched on what they say they&apos;re looking for, across all your active roles — not just a
            job-title search.
          </p>
          <div className="mt-3 space-y-3">
            {candidatesLookingForRoles.map(({ candidate, match, roleId, roleTitle, effortSummary, locked }) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                match={match}
                roleId={roleId}
                effortSummary={effortSummary}
                roleLabel={`Matches: ${roleTitle}`}
                locked={locked}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">At a glance</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{activeRoleCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Active roles</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{totalInteractions}</p>
            <p className="mt-1 text-sm text-muted-foreground">Candidates in pipeline</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{inConversation}</p>
            <p className="mt-1 text-sm text-muted-foreground">In conversation</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{hired}</p>
            <p className="mt-1 text-sm text-muted-foreground">Hired via NextChapter</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{pendingPostings.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Job Board postings pending review</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Notifications</h2>
        <div className="mt-3">
          <Link
            href="/talent/messages"
            className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-primary"
          >
            <p className="font-medium text-foreground">Messages</p>
            {unreadMessages > 0 && (
              <span className="rounded-full bg-orange/20 px-2.5 py-0.5 text-sm font-semibold text-orange">
                {unreadMessages} unread
              </span>
            )}
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Quick links</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link href="/talent/roles/new" className="rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">Post a Role</p>
            <p className="mt-1 text-sm text-muted-foreground">Describe a role and get matched candidates.</p>
          </Link>
          <Link href="/talent/roles" className="rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">My Roles</p>
            <p className="mt-1 text-sm text-muted-foreground">Manage roles you&apos;ve posted.</p>
          </Link>
          <Link href="/talent/candidates" className="rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">Candidate Inbox</p>
            <p className="mt-1 text-sm text-muted-foreground">Everyone you&apos;ve viewed or expressed interest in.</p>
          </Link>
          <Link href="/talent/saved" className="rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">Saved Candidates</p>
            <p className="mt-1 text-sm text-muted-foreground">Your shortlist.</p>
          </Link>
          <Link href="/talent/job-board/submissions" className="rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">Job Board</p>
            <p className="mt-1 text-sm text-muted-foreground">Track status of your Job Board submissions.</p>
          </Link>
          <Link href="/talent/analytics" className="rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">Hiring Analytics</p>
            <p className="mt-1 text-sm text-muted-foreground">Outcomes across everyone you&apos;ve hired.</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
