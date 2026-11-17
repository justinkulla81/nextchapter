import { prisma } from '@/lib/prisma'
import { getCurrentRecruiter } from '@/lib/recruiter/current-recruiter'
import { getRecruiterUnreadCount } from '@/lib/messaging/threads'
import { getLateSubmissions, STAGE_LABEL } from '@/lib/recruiter/submissions'
import { firstName, PortalHomeHeader, PortalHomeMore, PortalLinks, PortalNeeds, PortalNumbers, PortalTable, type NeedsItem } from '@/components/partners/PortalHome'

const POSTING_STATUS: Record<string, string> = { approved: 'Live', pending: 'Waiting for review', rejected: 'Not approved' }
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// The recruiter Home (the portal Home pattern, src/components/partners/PortalHome.tsx). Same reads as before: no new query.
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
  const submissionsHref = `/recruiters/job-board/submissions/${recruiter.accessToken}`

  const needs: NeedsItem[] = [
    ...lateSubmissions.map((s) => ({
      key: 'late_feedback',
      title: `${s.roleTitle} at ${s.companyName}: feedback is overdue`,
      why: `Still "${STAGE_LABEL[s.stage]}" ${s.hoursSinceUpdate} hours after the last update. The agreed time is ${s.slaHours} hours.`,
      href: `/recruiters/search/${s.candidateId}`,
      action: 'Update the candidate',
    })),
    ...(unreadMessages > 0
      ? [{ key: 'unread_messages', title: `${plural(unreadMessages, 'unread message')}`, why: 'From candidates in your searches.', href: '/recruiters/messages', action: 'Open messages' }]
      : []),
    ...(addedNotYetInvited > 0
      ? [{ key: 'not_invited', title: `${plural(addedNotYetInvited, 'candidate')} you added ${addedNotYetInvited === 1 ? 'is' : 'are'} not invited yet`, why: 'They cannot see your search until you invite them.', href: '/recruiters/candidates', action: 'Invite them' }]
      : []),
    ...rejectedPostings.map((p) => ({
      key: 'posting_rejected',
      title: `${p.title} at ${p.companyName} was not approved for the job board`,
      why: p.rejectionReason ?? 'Open the posting to see what to change.',
      href: submissionsHref,
      action: 'Fix the posting',
    })),
  ]

  const name = firstName(recruiter.fullName)
  return (
    <div className="space-y-8">
      <PortalHomeHeader
        portal="recruiter"
        eyebrow={recruiter.firmName ?? 'Recruiter'}
        title={name ? `Welcome back, ${name}` : 'Welcome back'}
        intro={needs.length === 0 ? 'Nothing is waiting on you right now.' : `${plural(needs.length, 'thing')} ${needs.length === 1 ? 'is' : 'are'} waiting on you.`}
        action={{ href: '/recruiters/search', label: 'Search candidates' }}
      />

      <PortalNeeds portal="recruiter" title="Waiting on you" items={needs} empty="Nothing is waiting on you right now." />

      <PortalNumbers
        items={[
          { value: String(signedUpCount), label: 'Signed up', source: `Of the ${totalSourced} candidates you added`, highlight: true },
          { value: String(invitedCount), label: 'Invited, not joined yet', source: 'From your invitations' },
          { value: String(pendingPostings.length), label: 'Postings waiting for review', source: 'Job board, reviewed by NextChapter' },
        ]}
      />

      <PortalTable
        title="Your job board postings"
        link={{ href: submissionsHref, label: 'See all postings' }}
        columns={['Role', 'Company', 'Status']}
        rows={postings.slice(0, 8).map((p) => ({ key: p.id, href: submissionsHref, cells: [p.title, p.companyName, POSTING_STATUS[p.status] ?? p.status] }))}
        empty="No postings yet. Post a search to the job board and it shows here."
      />

      <PortalHomeMore label="More for recruiters">
        <PortalLinks
          links={[
            { href: '/recruiters/candidates', label: 'My candidates', line: 'Add people from your own network and invite them.' },
            { href: `/recruiters/job-board/submit/${recruiter.accessToken}`, label: 'Post to the job board', line: 'Submit a new confidential or open search.' },
            { href: `/recruiters/calibrate/${recruiter.accessToken}`, label: 'Search calibration memo', line: 'Paste a client brief for an instant read.' },
            { href: '/recruiters/settings', label: 'Settings', line: 'Your name, firm and specialty.' },
            { href: '/auth/forgot-password', label: 'Change password', line: 'We email you a link.' },
          ]}
        />
      </PortalHomeMore>
    </div>
  )
}
