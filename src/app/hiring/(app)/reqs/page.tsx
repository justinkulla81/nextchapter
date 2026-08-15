import { getCurrentHiringManager } from '@/lib/hiring/current-hiring-manager'
import { listReqs } from '@/lib/hiring/reqs'
import { ReqList } from '@/components/hiring/ReqList'

export default async function HiringReqsPage() {
  const hiringManager = await getCurrentHiringManager()
  const reqs = await listReqs(hiringManager.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My reqs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Candidates a recruiter submits for a matching role at {hiringManager.companyName} link here
          automatically once submitted.
        </p>
      </div>
      <ReqList reqs={reqs} />
    </div>
  )
}
