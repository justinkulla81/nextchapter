import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { ScholarshipApplicationForm } from '@/components/dashboard/ScholarshipApplicationForm'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Scholarship application' }

export default async function ScholarshipPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getOrCreateCandidateProfile(user.id)

  const applications = await prisma.scholarshipApplication.findMany({
    where: { candidateId: profile.id },
    orderBy: { createdAt: 'desc' },
  })
  const latest = applications[0]

  return (
    <div className="max-w-2xl space-y-8 pb-12">
      <div>
        <Link href="/dashboard/plans" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Plans
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-foreground">Scholarship application</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          If cost is what&apos;s standing between you and Coaching Premium, tell us what&apos;s going on and
          we&apos;ll see what we can do. This isn&apos;t about proving anything — a person reads every
          application and reaches out either way.
        </p>
      </div>

      {latest && latest.status !== 'REJECTED' ? (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p
              className={cn(
                'inline-block rounded-full px-2 py-0.5 text-xs font-medium uppercase',
                latest.status === 'APPROVED' && 'bg-success/10 text-success',
                latest.status === 'PENDING' && 'bg-orange/10 text-orange'
              )}
            >
              {latest.status === 'PENDING' ? 'Under review' : latest.status}
            </p>
            <p className="text-sm text-foreground">
              {latest.status === 'PENDING'
                ? "We've got your application — a real person is reviewing it, and we'll follow up by email."
                : "You're approved. We'll be in touch shortly about next steps."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {latest?.status === 'REJECTED' && (
            <p className="text-sm text-muted-foreground">
              {latest.decisionNote ||
                "We weren't able to approve your last application, but circumstances change — feel free to apply again."}
            </p>
          )}
          <ScholarshipApplicationForm />
        </>
      )}
    </div>
  )
}
