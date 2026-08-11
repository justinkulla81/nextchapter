import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { TrackRecordForm } from '@/components/dashboard/TrackRecordForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Track Record' }

export default async function TrackRecordPage() {
  const profile = await getDashboardData()

  const response = await prisma.trackRecordResponse.findUnique({
    where: { candidateId: profile.id },
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/skills-assessments"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Skills & Behavioral Assessments
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Track Record</h1>
        <p className="mt-1 text-muted-foreground">
          Scope, ownership, and the kind of situations you&apos;ve operated in. This feeds your
          Executive Dossier and Hiring Manager Notes — and one answer becomes a specific question
          we ask your references to confirm. Retake it any time your scope changes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Your track record</CardTitle>
        </CardHeader>
        <CardContent>
          <TrackRecordForm response={response} isPeopleManager={profile.isPeopleManager} />
        </CardContent>
      </Card>
    </div>
  )
}
