import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CopyLinkButton } from '@/components/dashboard/CopyLinkButton'

export default async function CoachInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const coach = await prisma.coach.findUnique({ where: { accessToken: token } })

  if (!coach) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">This link isn&apos;t valid</h1>
        <p className="mt-2 text-muted-foreground">Double check the link you were sent.</p>
      </div>
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const inviteUrl = `${appUrl}/api/coach-invite/${coach.accessToken}`

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Coaches</p>
        <h1 className="text-2xl font-semibold tracking-tight">Hi {coach.fullName}</h1>
        <p className="text-muted-foreground">
          Send this link to clients you want on NextChapter. Anyone who signs up through it shows
          up on your client list automatically.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border p-3">
        <p className="flex-1 truncate text-sm text-muted-foreground">{inviteUrl}</p>
        <CopyLinkButton url={inviteUrl} />
      </div>

      <p className="mt-6 text-sm">
        <Link
          href={`/support/coach/clients/${coach.accessToken}`}
          className="text-primary underline underline-offset-4"
        >
          View my client list →
        </Link>
      </p>
    </div>
  )
}
