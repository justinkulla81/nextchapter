import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { listRequestsForCandidate } from '@/lib/recruiter/introduction-requests'
import { answerRecruiterRequest } from './actions'
import { recruiterRequestsIntro } from '@/lib/redesign/network-pages'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { NetworkParts } from '@/components/network/NetworkParts'

export const metadata: Metadata = { title: 'Recruiter requests' }

export default async function RecruiterRequestsPage() {
  const profile = await getDashboardProfile()
  const requests = await listRequestsForCandidate(profile.id)

  // The redesign (docs/candidate-redesign.md): who asked, and a yes or no for each. You decide every time.
  captureServerEvent(profile.id, 'recruiter_requests_viewed', { requests: requests.length })
  return (
    <div className="space-y-8">
      <PageHeader title="Recruiters" intro={recruiterRequestsIntro(requests.length)} />
      <NetworkParts current="recruiters" />
      {requests.length === 0 ? (
        <EmptyCard
          title="No requests waiting"
          why="When a recruiter who places people like you asks to meet you, it shows up here. You can take back a yes any time in privacy settings."
          action={
            <TrackedAction variant="secondary" href="/dashboard/privacy" event="privacy_opened" properties={{ source: 'recruiter_requests_empty' }}>
              Change who can find you
            </TrackedAction>
          }
        />
      ) : (
        <RowList label="Recruiters who asked to meet you">
          {requests.map((r) => (
            <ListRow
              key={r.id}
              name={r.recruiter.fullName}
              title={r.recruiter.fullName}
              fact={r.recruiter.firmName ?? 'Independent recruiter'}
              actions={
                <>
                  <form action={answerRecruiterRequest.bind(null, r.id, true)}>
                    <ActionSubmit variant="secondary" pendingLabel="Saving…" event="recruiter_request_answered" props={{ requestId: r.id, answer: 'yes' }}>
                      Yes, introduce us
                    </ActionSubmit>
                  </form>
                  <form action={answerRecruiterRequest.bind(null, r.id, false)}>
                    <ActionSubmit variant="secondary" pendingLabel="Saving…" event="recruiter_request_answered" props={{ requestId: r.id, answer: 'no' }}>
                      No thanks
                    </ActionSubmit>
                  </form>
                </>
              }
            />
          ))}
        </RowList>
      )}
    </div>
  )
}
