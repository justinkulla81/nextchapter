import { redirect } from 'next/navigation'

// Job Discovery merged into Job Fit as a single page — this route stays
// only so any existing bookmark/link doesn't dead-end.
export default function JobDiscoveryPage() {
  redirect('/dashboard/find-my-job')
}
