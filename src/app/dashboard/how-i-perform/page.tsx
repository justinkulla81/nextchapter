import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { PerformanceAssessmentForm } from '@/components/dashboard/PerformanceAssessmentForm'
import { Button } from '@/components/ui/button'
import { HOW_I_PERFORM_ITEMS } from '@/lib/constants/how-i-perform-items'

export const metadata: Metadata = { title: 'How I Perform' }

export default async function HowIPerformPage() {
  const profile = await getDashboardData()

  const latestResponse = await prisma.performanceAssessmentResponse.findFirst({
    where: { candidateId: profile.id },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true },
  })

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">How I Perform</h1>
        <p className="text-muted-foreground">
          40 quick statements about how you execute, decide, hold up under pressure, and get
          things done through other people. Your references answer these same questions about
          you — the comparison is what hiring managers actually want to see. There are no wrong
          answers here, but there is a right and wrong end to each one — answer honestly.
        </p>
        {latestResponse && (
          <p className="text-sm text-muted-foreground">
            Last completed {latestResponse.completedAt.toLocaleDateString()}.
          </p>
        )}
        <Button nativeButton={false} variant="outline" render={<Link href="/dashboard/skills-assessments" />} size="sm">
          Back to Assessments
        </Button>
      </div>

      <PerformanceAssessmentForm items={HOW_I_PERFORM_ITEMS} />
    </div>
  )
}
