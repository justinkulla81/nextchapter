import { redirect } from 'next/navigation'

// Company Tracker now lives inside the Find Full-Time Jobs page — this
// route stays only to catch old bookmarks/links and send them there.
export default function CompanyTrackerPage() {
  redirect('/dashboard/find-my-job')
}
