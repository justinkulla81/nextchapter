import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { getCurrentRecruiter } from '@/lib/recruiter/current-recruiter'
import { getRecruiterUnreadCount } from '@/lib/messaging/threads'
import { getLateSubmissions, STAGE_LABEL } from '@/lib/recruiter/submissions'

export default async function RecruiterDashboardPage() {
  const recruiter = await getCurrentRecruiter()

  const [unreadMessages, addedNotYetInvited, sourcedByStatus, postings, lateSubmissions] = await Promise.all([
    getRecruiterUnreadCount(recruiter.id),
    prisma.sourcedCandidate.count({ where: { recruiterId: recruiter.id, status: 'ADDED' } }),
    prisma.sourcedCandidate.groupBy({ by: ['status'], where: { recruiterId: recruiter.id }, _count: true }),
    prisma.exclusiveJobPosting.findMany({
      where: { submittedByRecruiterId: recruiter.id, archivedAt: null },
      select: { id: true, title: true, companyName: true, status: true, rejectionReason: true },
    }),
    getLateSubmissions(recruiter.id),
  ])

  const signedUpCount = sourcedByStatus.find((s) => s.status === 'SIGNED_UP')?._count ?? 0
  const invitedCount = sourcedByStatus.find((s) => s.status === 'INVITED')?._count ?? 0
  const totalSourced = sourcedByStatus.reduce((sum, s) => sum + s._count, 0)
  const rejectedPostings = postings.filter((p) => p.status === 'rejected')
  const pendingPostings = postings.filter((p) => p.status === 'pending')

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Recruiters</p>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {recruiter.fullName.split(' ')[0]}</h1>
        {recruiter.firmName && <p className="mt-1 text-muted-foreground">{recruiter.firmName}</p>}
      </div>

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Needs your attention</h2>
        {addedNotYetInvited === 0 && rejectedPostings.length === 0 && lateSubmissions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing waiting on you right now.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {lateSubmissions.map((s) => (
              <Link
                key={s.submissionId}
                href={`/recruiters/search/${s.candidateId}`}
                className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4 hover:border-destructive"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {s.roleTitle} at {s.companyName} — feedback overdue
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Still &ldquo;{STAGE_LABEL[s.stage]}&rdquo; {s.hoursSinceUpdate}h since the last update (SLA is {s.slaHours}h)
                  </p>
                </div>
              </Link>
            ))}
            {addedNotYetInvited > 0 && (
              <Link
                href="/recruiters/candidates"
                className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-primary"
              >
                <p className="font-medium text-foreground">Candidates added but not yet invited</p>
                <span className="rounded-full bg-orange/20 px-2.5 py-0.5 text-sm font-semibold text-orange">
                  {addedNotYetInvited}
                </span>
              </Link>
            )}
            {rejectedPostings.map((p) => (
              <Link
                key={p.id}
                href={`/recruiters/job-board/submissions/${recruiter.accessToken}`}
                className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-primary"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {p.title} at {p.companyName} — rejected
                  </p>
                  {p.rejectionReason && <p className="text-sm text-muted-foreground">{p.rejectionReason}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">At a glance</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{totalSourced}</p>
            <p className="mt-1 text-sm text-muted-foreground">Candidates sourced</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{invitedCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Invited, awaiting signup</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{signedUpCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Signed up</p>
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
            href="/recruiters/messages"
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
          <Link href="/recruiters/search" className="rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">Candidate search</p>
            <p className="mt-1 text-sm text-muted-foreground">Search the opted-in candidate pool and view briefs.</p>
          </Link>
          <Link href="/recruiters/candidates" className="rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">My candidates</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add people from your own network and invite them to NextChapter.
            </p>
          </Link>
          <Link
            href={`/recruiters/job-board/submit/${recruiter.accessToken}`}
            className="rounded-lg border border-border p-4 hover:border-primary"
          >
            <p className="font-medium text-foreground">Post to the Job Board</p>
            <p className="mt-1 text-sm text-muted-foreground">Submit a new confidential or open search.</p>
          </Link>
          <Link
            href={`/recruiters/job-board/submissions/${recruiter.accessToken}`}
            className="rounded-lg border border-border p-4 hover:border-primary"
          >
            <p className="font-medium text-foreground">My postings</p>
            <p className="mt-1 text-sm text-muted-foreground">Track status and reconfirm active listings.</p>
          </Link>
          <Link
            href={`/recruiters/calibrate/${recruiter.accessToken}`}
            className="rounded-lg border border-border p-4 hover:border-primary"
          >
            <p className="font-medium text-foreground">Search Calibration Memo</p>
            <p className="mt-1 text-sm text-muted-foreground">Paste a client brief for an instant read.</p>
          </Link>
          <Link href="/recruiters/settings" className="rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">Settings</p>
            <p className="mt-1 text-sm text-muted-foreground">Update your name, firm, and specialty.</p>
          </Link>
        </div>
      </section>

      <div className="border-t border-border pt-4">
        <Button nativeButton={false} render={<Link href="/auth/forgot-password" />} variant="outline" size="sm">
          Change password
        </Button>
      </div>
    </div>
  )
}
