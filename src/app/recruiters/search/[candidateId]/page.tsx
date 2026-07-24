import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { generateHiringManagerReport } from '@/lib/reports/hiring-manager-report'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 30

export default async function RecruiterCandidateBriefPage({
  params,
}: {
  params: Promise<{ candidateId: string }>
}) {
  const { candidateId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) redirect('/recruiters/signup')

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { id: true, recruiterDatabaseOptIn: true, privacyTier: true },
  })
  if (!candidate || !candidate.recruiterDatabaseOptIn || candidate.privacyTier === 'LOCKED' || candidate.privacyTier === 'STEALTH') {
    notFound()
  }

  const brief = await generateHiringManagerReport(candidateId)
  captureServerEvent(recruiter.id, 'recruiter_candidate_brief_viewed', { candidateId })

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/recruiters/search" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to search
      </Link>

      <div className="mt-4 mb-8 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Candidate Brief</p>
        <h1 className="text-2xl font-semibold tracking-tight">{brief.candidateName}</h1>
      </div>

      <div className="space-y-5">
        {brief.profileConsistencyAlert && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <p className="text-sm font-medium text-foreground">{brief.profileConsistencyAlert.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{brief.profileConsistencyAlert.message}</p>
          </div>
        )}

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">{brief.redFlags.label}</p>
          <ul className="mt-2 space-y-1">
            {brief.redFlags.summary.map((line, i) => (
              <li key={i} className="text-sm text-foreground">
                {line}
              </li>
            ))}
          </ul>
          {brief.redFlags.interviewAuditFocusAreas.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">Interview audit focus areas</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {brief.redFlags.interviewAuditFocusAreas.map((area) => (
                  <span key={area} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {brief.frictionExamples.length > 0 && (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">Self vs. reference friction examples</p>
            <div className="mt-3 space-y-4">
              {brief.frictionExamples.map((ex) => (
                <div key={ex.dimension}>
                  <p className="text-sm font-medium text-foreground">{ex.dimensionLabel}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Self-described:</span> {ex.candidateDescription}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">References described:</span>{' '}
                    {ex.referenceDescription}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">Self-awareness</p>
          <p className="mt-1 text-sm text-foreground">
            {brief.selfAwarenessLabel
              ? `${brief.selfAwarenessLabel} — how closely this candidate's self-report matches how references described them.`
              : 'Not enough reference data yet to assess.'}
          </p>
        </div>
      </div>
    </div>
  )
}
