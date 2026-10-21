import { redirect } from 'next/navigation'

// Caseload merged into Clients (one page, the same at-a-glance numbers per
// client). Kept so old bookmarks and digest emails still land.
export default async function CoachCaseloadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  redirect(`/support/coach/clients/${token}`)
}
