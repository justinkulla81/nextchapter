import { ActionLink } from '@/components/candidate/ActionLink'
import { RowList } from '@/components/candidate/RowList'
import { FactList, SectionBlock } from '@/components/candidate/Blocks'
import { getFeedbackImpact, getFeedbackRequests } from '@/lib/companies/ex-employee-feedback'

// Two things for a member who has worked at companies on the board: a request for
// anonymous feedback where one is hiring now, and — once they have shared — what it
// did (how many members looked, how many applied).
export async function FeedbackRequests({ candidateId }: { candidateId: string }) {
  const [requests, impact] = await Promise.all([getFeedbackRequests(candidateId), getFeedbackImpact(candidateId)])
  if (requests.length === 0 && impact.length === 0) return null

  return (
    <div className="space-y-6">
      {requests.length > 0 && (
        <SectionBlock id="feedback-h" title="What is it like where you worked?" why="These companies are hiring. Your answer is anonymous and helps members decide whether to apply.">
          <RowList
            label="Companies asking for feedback"
            items={requests.map((r) => ({
              key: r.companyId,
              title: r.companyName,
              why: `${r.openRoles} open ${r.openRoles === 1 ? 'role' : 'roles'}.`,
              actions: (
                <ActionLink href={`/dashboard/companies/${encodeURIComponent(r.slug)}`} event="company_feedback_started" props={{ companyId: r.companyId, source: 'companies' }}>
                  Share feedback
                </ActionLink>
              ),
            }))}
          />
        </SectionBlock>
      )}
      {impact.length > 0 && (
        <SectionBlock id="impact-h" title="What your feedback did">
          <FactList
            label="Feedback results"
            items={impact.map((i) => ({
              key: i.slug,
              name: <span className="font-semibold">{i.companyName}</span>,
              fact: `${i.viewed !== null ? `${i.viewed} members looked` : i.viewedAny ? 'fewer than 5 members looked' : 'no one has looked yet'}, ${i.applied !== null ? `${i.applied} applied` : i.appliedAny ? 'fewer than 5 applied' : 'no one has applied yet'}`,
            }))}
          />
        </SectionBlock>
      )}
    </div>
  )
}
