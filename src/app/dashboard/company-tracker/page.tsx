import { redirect } from 'next/navigation'

// The Company Tracker lives in My jobs on the job board — this route stays only
// to catch old bookmarks/links and send them there.
export default function CompanyTrackerPage() {
  redirect('/dashboard/find-my-job?tab=my_jobs#company-tracker')
}
