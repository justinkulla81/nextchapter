import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getRecruiterReportData } from '@/lib/reports/recruiter-report'
import { getDossierSections, getDossierSectionCompleteness } from '@/lib/reports/dossier-sections'
import { PrintReportButton } from '@/components/dashboard/PrintReportButton'
import { SubmitButton } from '@/components/ui/submit-button'
import { Spinner } from '@/components/ui/spinner'
import { regenerateDossierSections } from './actions'
import { DossierSectionsView } from '@/components/dashboard/DossierSections'
import { DossierCompletenessRing } from '@/components/dashboard/DossierCompletenessRing'
import { DossierReportSections } from '@/components/dashboard/DossierReportSections'
import { PreparedForField } from '@/components/dashboard/PreparedForField'
import { StatusRow } from '@/components/ui/status-icon'
import { EmptyState } from '@/components/ui/empty-state'
import { Logo } from '@/components/Logo'

// Two things this document deliberately never shows, per the spec's own
// honesty rule (a false claim discovered once destroys the whole effect):
// - A scarcity line ("one of N candidates verified this quarter") — no
//   cohort-size data exists anywhere in the schema to back it.
// - A "Verified Scope" block corroborating a specific stated scope/budget
//   claim against what a reference said — that needs Track Record (not yet
//   built) to have a scope claim to corroborate in the first place.

export const metadata: Metadata = { title: 'Certified Executive Dossier' }

// getDossierSections (cached per-request via React's cache(), see
// dossier-sections.ts) chains up to 4 live Anthropic calls plus an
// LLM-per-employer loop — both the completeness summary near the top of the
// page and the full dossier view further down need it, so each gets its own
// Suspense boundary rather than blocking the rest of this page (candidate
// name, effort summary, references, etc., all from the fast
// getRecruiterReportData call) on either one.
async function DossierCompletenessSection({ candidateId }: { candidateId: string }) {
  const dossier = await getDossierSections(candidateId)
  const sectionCompleteness = getDossierSectionCompleteness(dossier)
  const completedCount = sectionCompleteness.filter((s) => s.hasContent).length

  if (completedCount === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Your Dossier doesn't have much yet"
        description="Add references, log a work sample, or complete How I Work Best — each one fills in a section below. Nothing here is fabricated; sections stay blank until there's something real to show."
      />
    )
  }
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <DossierCompletenessRing completed={completedCount} total={sectionCompleteness.length} />
      <div className="grid gap-x-6 gap-y-1.5 border-t border-border pt-3 sm:grid-cols-2">
        {sectionCompleteness.map((s) => (
          <StatusRow key={s.id} status={s.hasContent ? 'success' : 'locked'} label={s.title} />
        ))}
      </div>
    </div>
  )
}

async function DossierContentSection({ candidateId }: { candidateId: string }) {
  const dossier = await getDossierSections(candidateId)
  return <DossierSectionsView dossier={dossier} />
}

function DossierSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
      <Spinner size={16} />
      Putting together your dossier…
    </div>
  )
}

export default async function RecruiterReportPage() {
  const profile = await getDashboardData()
  const data = await getRecruiterReportData(profile.id)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Certified Executive Dossier</h1>
          <p className="mt-1 text-muted-foreground">
            Every reference, work sample, and network signal you&apos;ve
            built here, plus your execution score, in one document. Hand it to any hiring manager,
            recruiter, or coach alongside your resume and cover letter. You control when this is
            generated and shared; it&apos;s never sent automatically.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* Regenerates the two AI-written sections (proof-point follow-ups,
              job-reaction pattern). They're cached after the first build so
              opening this page stays fast and doesn't re-run the models. */}
          <form action={regenerateDossierSections}>
            <SubmitButton variant="outline" pendingLabel="Refreshing…">
              Refresh AI sections
            </SubmitButton>
          </form>
          <PrintReportButton />
        </div>
      </div>

      <div className="print:hidden">
        <Suspense fallback={<DossierSkeleton />}>
          <DossierCompletenessSection candidateId={profile.id} />
        </Suspense>
      </div>

      <div
        className="space-y-8 rounded-xl border border-border p-8 print:space-y-6 print:rounded-none print:border-0 print:bg-[#FDFBF7] print:p-12 print:font-serif print:text-[#1a1a1a] print:[&>section]:border-t print:[&>section]:border-[#0b2545]/20 print:[&>section]:pt-6"
      >
        <div className="space-y-2 border-b border-border pb-4 print:border-[#0b2545]/40">
          <div className="flex items-center justify-between">
            <Logo className="text-xl print:text-2xl" />
            <p className="text-sm text-muted-foreground">
              Generated {data.generatedAt.toLocaleDateString()}
            </p>
          </div>
          <PreparedForField />
          {data.verification.referenceCount > 0 && (
            <p className="hidden text-sm text-muted-foreground print:block">
              Verified · {data.verification.referenceCount} reference
              {data.verification.referenceCount === 1 ? '' : 's'}
              {data.verification.verifiedMonthYear ? ` · ${data.verification.verifiedMonthYear}` : ''}
            </p>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground print:font-serif print:text-2xl">
            {data.candidateName}
          </h2>
          {data.availability.targetRoleType && (
            <p className="text-muted-foreground">Targeting: {data.availability.targetRoleType}</p>
          )}
        </div>

        <Suspense fallback={<DossierSkeleton />}>
          <DossierContentSection candidateId={profile.id} />
        </Suspense>

        <DossierReportSections data={data} />

        {/* First 8 characters of the candidate's own id — a stable,
            non-fabricated per-candidate identifier. Never a cross-candidate
            count (no real cohort data exists to back one — see the top of
            this file). */}
        <p className="pt-2 text-center text-xs tracking-wide text-muted-foreground print:border-t print:border-[#0b2545]/20 print:pt-4 print:text-[#0b2545]">
          Document {profile.id.slice(0, 8).toUpperCase()}
          {' · Confidential · Prepared at the candidate’s request'}
        </p>
      </div>

      <p className="text-xs text-muted-foreground print:hidden">
        Want to see your work history reflected here?{' '}
        <Link href="/dashboard/resume" className="text-primary underline underline-offset-4">
          Add or edit it on your Resume page
        </Link>
        .
      </p>
    </div>
  )
}
