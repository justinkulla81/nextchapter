import { ApplyHelperPage } from '@/components/dashboard/ApplyHelperPage'
import { ApplyHelperConnect } from '@/components/dashboard/ApplyHelperConnect'

// The member install page for the Apply Helper (dashboard/apply-helper), the code that ships, with a sample code.
export function ApplyHelperLive() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <ApplyHelperPage connect={<ApplyHelperConnect sample />} />
    </div>
  )
}
