import { prisma } from '@/lib/prisma'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { getEmployerUnreadCount } from '@/lib/messaging/threads'
import { getCandidatesLookingForYourRoles } from '@/lib/talent/candidate-discovery'
import { captureServerEvent } from '@/lib/posthog/server'
import { CandidateCard } from '@/components/talent/CandidateCard'
import { firstName, PortalHomeHeader, PortalHomeMore, PortalLinks, PortalNeeds, type NeedsItem } from '@/components/partners/PortalHome'
import { OrgHomeHero } from '@/components/partners/OrgHomeHero'
import { brandOwnerKey, readEmployerBrand } from '@/lib/employer/brand'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// The hiring Home (the portal Home pattern, src/components/partners/PortalHome.tsx). One read added: the company's Home
// picture (one small EmployerBrand row).
export default async function TalentHomePage() {
  const employer = await getTalentDashboardData()

  const [activeRoleCount, interactionsByStatus, jobBoardPostings, unreadMessages, candidatesLookingForRoles, brand] = await Promise.all([
    prisma.roleProfile.count({ where: { employerId: employer.id, isActive: true } }),
    prisma.candidateInteraction.groupBy({ by: ['status'], where: { employerId: employer.id }, _count: true }),
    prisma.exclusiveJobPosting.findMany({
      where: { submittedByEmployerId: employer.id, archivedAt: null },
      select: { id: true, title: true, status: true, rejectionReason: true },
    }),
    getEmployerUnreadCount(employer.id),
    getCandidatesLookingForYourRoles(employer.id),
    readEmployerBrand(brandOwnerKey({ companyId: employer.companyId, employerProfileId: employer.id })!),
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

  const needs: NeedsItem[] = [
    ...(unreadMessages > 0
      ? [{ key: 'unread_messages', title: plural(unreadMessages, 'unread message'), why: 'From candidates you contacted.', href: '/talent/messages', action: 'Open messages' }]
      : []),
    ...rejectedPostings.map((p) => ({
      key: 'posting_rejected',
      title: `${p.title} was not approved for the job board`,
      why: p.rejectionReason ?? 'Open the posting to see what to change.',
      href: '/talent/job-board/submissions',
      action: 'Fix the posting',
    })),
    ...(activeRoleCount === 0
      ? [{ key: 'no_roles', title: 'You have no active role', why: 'Candidates are matched to your roles. Describe one and matches start showing here.', href: '/talent/roles/new', action: 'Describe a role' }]
      : []),
  ]

  const contact = firstName(employer.contactName)
  return (
    <div className="space-y-8">
      <PortalHomeHeader
        portal="hiring"
        eyebrow={employer.companyName}
        title={contact ? `Welcome back, ${contact}` : 'Welcome back'}
        intro={
          candidatesLookingForRoles.length > 0
            ? `${plural(candidatesLookingForRoles.length, 'candidate')} ${candidatesLookingForRoles.length === 1 ? 'is' : 'are'} looking for roles like your ${plural(activeRoleCount, 'active role')}.`
            : `You have ${plural(activeRoleCount, 'active role')}.`
        }
        action={{ href: '/talent/roles/new', label: 'Post a role' }}
      />

      {/* The company's splash (owner decision 2026-11-17): its office, logo and product, with the three pipeline numbers that
          used to sit in their own row. Edited by anyone on the team in Settings. */}
      <OrgHomeHero
        name={employer.companyName}
        line={brand?.productName ? `${employer.companyName} · ${brand.productName}` : employer.companyName}
        tagline={brand?.tagline ?? null}
        imageUrl={brand?.officeImageUrl ?? null}
        logoUrl={brand?.logoUrl ?? null}
        inset={brand?.productImageUrl ? { url: brand.productImageUrl, label: brand.productName ?? 'Our product' } : null}
        placeholder="office"
        edit={{ brandingHref: '/talent/settings#home-picture', readOnly: false }}
        stats={[
          { value: String(totalInteractions), label: 'Candidates in your pipeline', note: 'Everyone you viewed, saved or contacted' },
          { value: String(inConversation), label: 'In conversation', note: 'Marked in conversation by your team' },
          { value: String(hired), label: 'Hired through NextChapter', note: 'Marked hired by your team' },
        ]}
      />

      <PortalNeeds portal="hiring" title="Waiting on you" items={needs} empty="Nothing is waiting on you right now." />

      <section aria-labelledby="looking-h" className="space-y-3">
        <h2 id="looking-h" className="font-display text-xl font-semibold text-ink">
          Candidates looking for roles like yours
        </h2>
        {candidatesLookingForRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No new matches right now. Matches come from what candidates say they are looking for, across all your active roles.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Matched on what they say they are looking for, across all your active roles, not a job-title search.</p>
            <div className="space-y-3">
              {candidatesLookingForRoles.map(({ candidate, match, roleId, roleTitle, effortSummary, evidence }) => (
                <CandidateCard key={candidate.id} candidate={candidate} match={match} roleId={roleId} effortSummary={effortSummary} roleLabel={`Matches: ${roleTitle}`} evidence={evidence} />
              ))}
            </div>
          </>
        )}
      </section>

      <PortalHomeMore label="More for your hiring team">
        {pendingPostings.length > 0 && <p className="text-sm text-muted-foreground">{plural(pendingPostings.length, 'job board posting')} waiting for review by NextChapter.</p>}
        <PortalLinks
          links={[
            { href: '/talent/roles', label: 'My roles', line: 'Manage the roles you posted.' },
            { href: '/talent/candidates', label: 'Candidate inbox', line: 'Everyone you viewed or showed interest in.' },
            { href: '/talent/saved', label: 'Saved candidates', line: 'Your shortlist.' },
            { href: '/talent/job-board/submissions', label: 'Job board', line: 'The status of your job board postings.' },
            { href: '/talent/analytics', label: 'Hiring analytics', line: 'Outcomes across everyone you hired.' },
          ]}
        />
      </PortalHomeMore>
    </div>
  )
}
