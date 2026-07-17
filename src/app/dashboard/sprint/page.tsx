import { redirect } from 'next/navigation'

// The Weekly Search Sprint now lives directly on the Success Dashboard,
// folded into the daily motivation card — this route stays only so any
// existing bookmark/link doesn't dead-end.
export default function SprintRedirectPage() {
  redirect('/dashboard')
}
