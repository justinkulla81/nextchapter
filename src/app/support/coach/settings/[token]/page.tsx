import Link from 'next/link'
import { getCoachByToken } from '@/lib/coach/access'
import { CoachBrandingForm } from '@/components/coach/CoachBrandingForm'

export default async function CoachSettingsPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const coach = await getCoachByToken(token)

  if (!coach) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">This link isn&apos;t valid</h1>
        <p className="mt-2 text-muted-foreground">Double check the link you were sent.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <Link
        href={`/support/coach/clients/${token}`}
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        ← Back to clients
      </Link>

      <div className="mt-4 mb-6 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Practice settings</p>
        <h1 className="text-2xl font-semibold tracking-tight">Branding</h1>
        <p className="text-muted-foreground">
          Your name, logo, and accent color — used as we build out your branded practice tools.
        </p>
      </div>

      <CoachBrandingForm token={token} coach={coach} />
    </div>
  )
}
