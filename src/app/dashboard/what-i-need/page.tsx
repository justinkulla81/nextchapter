import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { WhatINeedForm } from '@/components/dashboard/WhatINeedForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { WorkValueDomain, ImportanceRating, WhatINeedItemRating } from '@/lib/constants/what-i-need'

export const metadata: Metadata = { title: 'What I Need' }

export default async function WhatINeedPage() {
  const profile = await getDashboardData()

  const response = await prisma.whatINeedResponse.findUnique({
    where: { candidateId: profile.id },
  })

  const initialRatings: Record<string, ImportanceRating> = {}
  if (response?.itemRatings) {
    for (const r of response.itemRatings as unknown as WhatINeedItemRating[]) {
      initialRatings[r.itemId] = r.rating
    }
  }
  const initialDomainRank = (response?.domainRank ?? []) as WorkValueDomain[]

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/skills-assessments"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Skills & Behavioral Assessments
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">What I Need</h1>
        <p className="mt-1 text-muted-foreground">
          The work values you&apos;re not willing to trade away, ranked. This feeds your Search
          Strategy and Coaching Notes — the more current it is, the better the guidance. Retake it
          any time your priorities shift.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">What matters to you</CardTitle>
        </CardHeader>
        <CardContent>
          <WhatINeedForm initialRatings={initialRatings} initialDomainRank={initialDomainRank} />
        </CardContent>
      </Card>
    </div>
  )
}
