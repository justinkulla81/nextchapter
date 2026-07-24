import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { SignOutButton } from '@/components/auth/SignOutButton'

export default async function CoachHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const coach = await prisma.coach.findUnique({ where: { userId: user.id } })
  if (!coach) redirect('/support/coach/signup')

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">NextChapter for Coaches</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {coach.fullName.split(' ')[0]}
          </h1>
          {coach.firmName && <p className="mt-1 text-muted-foreground">{coach.firmName}</p>}
        </div>
        <SignOutButton />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`/support/coach/clients/${coach.accessToken}`}
          className="rounded-lg border border-border p-4 hover:border-primary"
        >
          <p className="font-medium text-foreground">Your clients</p>
          <p className="mt-1 text-sm text-muted-foreground">Pre-session briefs and full client views.</p>
        </Link>
        <Link
          href={`/support/coach/invite/${coach.accessToken}`}
          className="rounded-lg border border-border p-4 hover:border-primary"
        >
          <p className="font-medium text-foreground">Invite a client</p>
          <p className="mt-1 text-sm text-muted-foreground">Share your invite link with someone you coach.</p>
        </Link>
        <Link href="/support/coach/settings" className="rounded-lg border border-border p-4 hover:border-primary">
          <p className="font-medium text-foreground">Settings</p>
          <p className="mt-1 text-sm text-muted-foreground">Branding and your Coaching Onboarding Form.</p>
        </Link>
      </div>

      <div className="border-t border-border pt-4">
        <a href="/auth/forgot-password" className="text-sm text-muted-foreground underline underline-offset-4">
          Change password
        </a>
      </div>
    </div>
  )
}
