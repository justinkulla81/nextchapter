import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getDossierSections } from '@/lib/reports/dossier-sections'
import { getRecruiterReportData } from '@/lib/reports/recruiter-report'
import { DossierSectionsView } from '@/components/dashboard/DossierSections'
import { DossierReportSections } from '@/components/dashboard/DossierReportSections'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { selectDisplayedWorkHistory, sanitizeRoleTitle } from '@/lib/work-history/sanitize'

export const maxDuration = 30

// Admin's own rich, "LinkedIn but improved" view of a candidate — unlike the
// recruiter-facing version, not gated on privacyTier/grade (admin sees
// everything), and unlike dossier-sections.ts's hiring-manager-facing
// output, DOES show the photo — this route is strictly internal-admin, a
// different audience than the anti-bias exclusion that comment guards
// against. Combines the same getRecruiterReportData + getDossierSections
// pairing /dashboard/recruiter-report already renders for candidates (via
// the shared DossierReportSections component, so the two never drift), plus
// content that page doesn't show at all: narratives, interview Q&A "proof
// points," and education.
export default async function AdminCandidateProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profilePictureUrl: true,
      currentCity: true,
      currentState: true,
      currentCountry: true,
      knownFor: true,
      workHistory: { orderBy: { startDate: 'desc' } },
    },
  })
  if (!candidate) notFound()

  const [dossier, reportData, narratives, interviewResponses, education] = await Promise.all([
    getDossierSections(id),
    getRecruiterReportData(id),
    prisma.candidateNarrative.findMany({ where: { candidateId: id }, orderBy: { generatedAt: 'asc' } }),
    prisma.interviewResponse.findMany({
      where: { candidateId: id, responseType: 'text', responseText: { not: null } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.educationEntry.findMany({ where: { candidateId: id }, orderBy: { graduationDate: 'desc' } }),
  ])

  const displayName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'Unnamed'
  const location = [candidate.currentCity, candidate.currentState].filter(Boolean).join(', ') || candidate.currentCountry
  const displayedHistory = selectDisplayedWorkHistory(candidate.workHistory)

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <Link href={`/support/admin/candidates/${id}`} className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to candidate
      </Link>

      <div className="flex items-start gap-4">
        <AvatarDisplay name={displayName} url={candidate.profilePictureUrl} size={72} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
          {location && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {location}
            </p>
          )}
          {candidate.knownFor && <p className="mt-1 text-sm text-foreground">{candidate.knownFor}</p>}
        </div>
      </div>

      {displayedHistory.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Work history</h2>
          <ul className="space-y-1.5 text-sm">
            {displayedHistory.map((entry) => (
              <li key={entry.id} className="text-foreground">
                {sanitizeRoleTitle(entry.roleTitle)} at {entry.companyName}
                <span className="ml-2 text-xs text-muted-foreground">
                  {entry.startDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} –{' '}
                  {entry.isCurrent ? 'Present' : entry.endDate?.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </span>
                {entry.keyAchievement && <p className="text-muted-foreground">{entry.keyAchievement}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {education.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Education</h2>
          <ul className="space-y-1 text-sm text-foreground">
            {education.map((entry) => (
              <li key={entry.id}>
                {entry.schoolName}
                {entry.degree && ` — ${entry.degree}`}
                {entry.fieldOfStudy && `, ${entry.fieldOfStudy}`}
                {entry.graduationDate && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {entry.graduationDate.toLocaleDateString(undefined, { year: 'numeric' })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {narratives.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Narratives</h2>
          <div className="space-y-2">
            {narratives.map((narrative) => (
              <details key={narrative.id} className="group rounded-lg border border-border p-3">
                <summary className="cursor-pointer list-none text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  {narrative.label}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{narrative.coreStatement}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {interviewResponses.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Proof points (interview practice)
          </h2>
          <div className="space-y-2">
            {interviewResponses.map((response) => (
              <details key={response.id} className="group rounded-lg border border-border p-3">
                <summary className="cursor-pointer list-none text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  {response.questionText}
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{response.responseText}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-muted-foreground">Profile / Executive Dossier</p>
      </div>

      <div className="space-y-5">
        <DossierSectionsView dossier={dossier} readOnly />
        <DossierReportSections data={reportData} />
      </div>
    </div>
  )
}
