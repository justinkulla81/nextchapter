import { redirect } from 'next/navigation'

// Followed companies live on What you follow; this route stays only to catch old bookmarks and links.
export default function CompanyTrackerPage() {
  redirect('/dashboard/following')
}
