import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { SignOutButton } from '@/components/auth/SignOutButton'

export default async function RecruiterDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) redirect('/recruiters/signup')

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">NextChapter for Recruiters</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {recruiter.fullName.split(' ')[0]}
          </h1>
          {recruiter.firmName && <p className="mt-1 text-muted-foreground">{recruiter.firmName}</p>}
        </div>
        <SignOutButton />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/recruiters/search" className="rounded-lg border border-border p-4 hover:border-primary">
          <p className="font-medium text-foreground">Candidate search</p>
          <p className="mt-1 text-sm text-muted-foreground">Search the opted-in candidate pool and view briefs.</p>
        </Link>
        <Link
          href={`/recruiters/job-board/submit/${recruiter.accessToken}`}
          className="rounded-lg border border-border p-4 hover:border-primary"
        >
          <p className="font-medium text-foreground">Post to the Job Board</p>
          <p className="mt-1 text-sm text-muted-foreground">Submit a new confidential or open search.</p>
        </Link>
        <Link
          href={`/recruiters/job-board/submissions/${recruiter.accessToken}`}
          className="rounded-lg border border-border p-4 hover:border-primary"
        >
          <p className="font-medium text-foreground">My postings</p>
          <p className="mt-1 text-sm text-muted-foreground">Track status and reconfirm active listings.</p>
        </Link>
        <Link
          href={`/recruiters/calibrate/${recruiter.accessToken}`}
          className="rounded-lg border border-border p-4 hover:border-primary"
        >
          <p className="font-medium text-foreground">Search Calibration Memo</p>
          <p className="mt-1 text-sm text-muted-foreground">Paste a client brief for an instant read.</p>
        </Link>
        <Link
          href="/recruiters/settings"
          className="rounded-lg border border-border p-4 hover:border-primary"
        >
          <p className="font-medium text-foreground">Settings</p>
          <p className="mt-1 text-sm text-muted-foreground">Update your name, firm, and specialty.</p>
        </Link>
      </div>

      <div className="border-t border-border pt-4">
        <Button nativeButton={false} render={<Link href="/auth/forgot-password" />} variant="outline" size="sm">
          Change password
        </Button>
      </div>
    </div>
  )
}
