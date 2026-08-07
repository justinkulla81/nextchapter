import { redirect } from 'next/navigation'

// Merged into the Live Conversations page's "Automatic Tracking" section —
// this stub just carries forward the OAuth-callback query params (?gmailConnected=1
// etc.) for any bookmarks or in-flight redirects still pointing here.
export default async function EmailActivityRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  redirect(qs ? `/dashboard/network?${qs}` : '/dashboard/network')
}
