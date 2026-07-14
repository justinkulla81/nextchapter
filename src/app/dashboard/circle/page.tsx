import { redirect } from 'next/navigation'

// The Circle merged into Community as a single, ungated page — this route
// stays only so any existing bookmark/link doesn't dead-end.
export default function CirclePage() {
  redirect('/dashboard/community')
}
