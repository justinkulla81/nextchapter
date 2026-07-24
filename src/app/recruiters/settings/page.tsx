import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { RecruiterSettingsForm } from '@/components/recruiter/RecruiterSettingsForm'

export default async function RecruiterSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) redirect('/recruiters/signup')

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <Link href="/recruiters/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to dashboard
      </Link>

      <div className="mt-4 mb-6 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Recruiters</p>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Your name, firm, and specialty — shown on every listing you submit.</p>
      </div>

      <RecruiterSettingsForm recruiter={recruiter} />
    </div>
  )
}
