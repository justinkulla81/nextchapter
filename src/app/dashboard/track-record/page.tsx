import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { TrackRecordForm } from '@/components/dashboard/TrackRecordForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Track Record' }

export default async function TrackRecordPage() {
  const profile = await getDashboardProfile()

  const response = await prisma.trackRecordResponse.findUnique({
    where: { candidateId: profile.id },
  })

  if (isRedesignOn(profile.email)) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Track record"
          intro="Why we ask: scope and ownership are what a résumé cannot show. Your answers build your dossier, and one becomes a question we ask your references to confirm. Retake it any time your scope changes."
        />
        <section aria-label="Your track record" className="rounded-2xl border border-border p-6">
          <TrackRecordForm response={response} isPeopleManager={profile.isPeopleManager} />
        </section>
        <Link href="/dashboard/skills-assessments" className="inline-block text-sm font-medium text-brand underline underline-offset-4">
          Back to skills and behavioral assessments
        </Link>
      </div>
    )
  }

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
