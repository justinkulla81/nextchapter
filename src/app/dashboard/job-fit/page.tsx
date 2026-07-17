import { redirect } from 'next/navigation'

// Renamed to Find My Job — this route stays only so any existing
// bookmark/link doesn't dead-end.
export default function JobFitRedirectPage() {
  redirect('/dashboard/find-my-job')
}
