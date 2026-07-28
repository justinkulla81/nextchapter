import { redirect } from 'next/navigation'

// Messages merged into the Support Network page (see /dashboard/community) —
// this route stays only so old bookmarks and in-flight notification emails
// still land somewhere real.
export default async function CandidateThreadRedirect({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params
  redirect(`/dashboard/community?tab=messages&thread=${threadId}`)
}
