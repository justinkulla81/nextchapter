import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { getCoachImpactReport } from '@/lib/coach/impact-report'

const HIGH_NEED_TAG = 'comfort_with_high_need_candidates'
const SPECIALIST_MIN_CLIENTS = 2

export default async function CoachHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const coach = await prisma.coach.findUnique({
    where: { userId: user.id },
    include: { _count: { select: { clients: true } } },
  })
  if (!coach) redirect('/support/coach/signup')

  const isSpecialist = coach.specializationTags.includes(HIGH_NEED_TAG) && coach._count.clients >= SPECIALIST_MIN_CLIENTS
  const impact = await getCoachImpactReport(coach.id)

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">NextChapter for Coaches</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {coach.fullName.split(' ')[0]}
          </h1>
          {coach.firmName && <p className="mt-1 text-muted-foreground">{coach.firmName}</p>}
          {isSpecialist && (
            <span className="mt-2 inline-block rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
              High-need specialist
            </span>
          )}
        </div>
        <SignOutButton />
      </div>

      {impact.clientCount > 0 && (
        <div className="rounded-lg border border-brand/30 bg-brand/5 p-4">
          <p className="text-sm font-medium text-foreground">Your impact this quarter</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {impact.improved} client{impact.improved === 1 ? '' : 's'} improved their grade, {impact.same} held
            steady, {impact.declined} declined
            {impact.noData > 0 ? `, ${impact.noData} not enough data yet` : ''}.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`/support/coach/clients/${coach.accessToken}`}
          className="rounded-lg border border-border p-4 hover:border-primary"
        >
          <p className="font-medium text-foreground">Your clients</p>
          <p className="mt-1 text-sm text-muted-foreground">Pre-session briefs and full client views.</p>
        </Link>
        <Link
          href={`/support/coach/caseload/${coach.accessToken}`}
          className="rounded-lg border border-border p-4 hover:border-primary"
        >
          <p className="font-medium text-foreground">Caseload</p>
          <p className="mt-1 text-sm text-muted-foreground">Roster-level grade trends and who&apos;s stalled.</p>
        </Link>
        <Link
          href="/support/coach/invite-client"
          className="rounded-lg border border-border p-4 hover:border-primary"
        >
          <p className="font-medium text-foreground">Invite a client by email</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite someone directly — they skip the confirmation step and start right away.
          </p>
        </Link>
        <Link
          href={`/support/coach/invite/${coach.accessToken}`}
          className="rounded-lg border border-border p-4 hover:border-primary"
        >
          <p className="font-medium text-foreground">Share invite link</p>
          <p className="mt-1 text-sm text-muted-foreground">A generic link anyone can sign up through.</p>
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
