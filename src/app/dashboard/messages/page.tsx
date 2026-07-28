import { redirect } from 'next/navigation'

// Messages merged into the Support Network page (see /dashboard/community) —
// this route stays only so old bookmarks and in-flight notification emails
// still land somewhere real.
export default function CandidateMessagesRedirect() {
  redirect('/dashboard/community?tab=messages')
}
