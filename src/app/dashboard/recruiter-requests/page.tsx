import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { listRequestsForCandidate } from '@/lib/recruiter/introduction-requests'
import { SubmitButton } from '@/components/ui/submit-button'
import { answerRecruiterRequest } from './actions'

export const metadata: Metadata = { title: 'Recruiter requests' }

export default async function RecruiterRequestsPage() {
  const profile = await getDashboardData()
  const requests = await listRequestsForCandidate(profile.id)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Recruiter requests</h1>
        <p className="text-muted-foreground">
          These recruiters found you and asked for an introduction. They see nothing about you until you say yes,
          and you can take it back later in{' '}
          <Link href="/dashboard/privacy" className="underline underline-offset-4">
            privacy settings
          </Link>
          .
        </p>
      </div>
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requests waiting.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-4">
              <p className="font-medium text-foreground">{r.recruiter.fullName}</p>
              <p className="text-sm text-muted-foreground">{r.recruiter.firmName ?? 'Independent recruiter'}</p>
              <div className="mt-3 flex gap-2">
                <form action={answerRecruiterRequest.bind(null, r.id, true)}>
                  <SubmitButton size="sm" pendingLabel="Saving…">
                    Yes, introduce us
                  </SubmitButton>
                </form>
                <form action={answerRecruiterRequest.bind(null, r.id, false)}>
                  <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
                    No thanks
                  </SubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
