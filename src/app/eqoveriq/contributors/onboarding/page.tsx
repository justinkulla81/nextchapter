import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { ContributorApplicationForm } from '@/components/eqoveriq/contributors/ContributorApplicationForm'

export const metadata: Metadata = {
  title: { absolute: 'EQoverIQ — Your application' },
  robots: { index: false, follow: false },
}

export default async function EqOverIqContributorOnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/eqoveriq/contributors/login')

  const profile = await prisma.eqOverIqContributorProfile.findUnique({ where: { userId: user.id } })
  if (!profile) redirect('/eqoveriq/contributors/signup')
  if (profile.submittedAt) redirect('/eqoveriq/contributors')

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">EQoverIQ for Contributors</p>
        <h1 className="text-2xl font-semibold tracking-tight">Tell us about you</h1>
        <p className="text-muted-foreground">
          We review every application by hand — there&apos;s no automated test here. Give us the real picture.
        </p>
      </div>
      <ContributorApplicationForm />
    </div>
  )
}
