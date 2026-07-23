import { redirect } from 'next/navigation'

// NC Job Board 2.0 — merged into the unified "Jobs" page's Discover section
// (find-my-job/page.tsx) alongside automated-partner listings, so a
// candidate has one place to browse instead of two. This route stays as a
// redirect for anyone with the old URL bookmarked.
export default function JobBoardPage() {
  redirect('/dashboard/find-my-job')
}
