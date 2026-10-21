import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getRecruiterReportData } from '@/lib/reports/recruiter-report'
import { getDossierSections, getDossierSectionCompleteness } from '@/lib/reports/dossier-sections'
import { PrintReportButton } from '@/components/dashboard/PrintReportButton'
import { SubmitButton } from '@/components/ui/submit-button'
import { Spinner } from '@/components/ui/spinner'
import { regenerateDossierSections } from './actions'
import { DossierSectionsView } from '@/components/dashboard/DossierSections'
import { DossierReportSections } from '@/components/dashboard/DossierReportSections'
import { PreparedForField } from '@/components/dashboard/PreparedForField'
import { Logo } from '@/components/Logo'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { Meter } from '@/components/candidate/ui'

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

  // The redesign: one sentence and a bar. The ring, the boxed list with lock icons and the dashed empty state are gone;
  // which sections are filled in opens on demand.
  if (completedCount === 0) {
    return (
      <EmptyCard
        title="Your dossier is empty so far"
        why="Add a reference, log a work sample or finish How I work, and each one fills a section below. Nothing here is made up: a section stays blank until there is something real to show."
      />
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-base text-ink">
        <span className="font-semibold">
          {completedCount} of {sectionCompleteness.length} sections are filled in.
        </span>{' '}
        Each one fills as you add real proof.
      </p>
      <Meter pct={Math.round((completedCount / sectionCompleteness.length) * 100)} label="Dossier sections filled in" tone={completedCount === sectionCompleteness.length ? 'good' : 'ink'} />
      <details className="text-base">
        <summary className="cursor-pointer text-sm font-medium text-brand underline underline-offset-4">Which sections</summary>
        <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {sectionCompleteness.map((s) => (
            <li key={s.id} className="text-ink">
              {s.title}: <span className="text-muted-foreground">{s.hasContent ? 'filled in' : 'empty'}</span>
            </li>
          ))}
        </ul>
      </details>
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
  const profile = await getDashboardProfile()
  const data = await getRecruiterReportData(profile.id)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-4 print:hidden">
        <PageHeader
          title="What recruiters see"
          intro="One document with the proof behind your search: references, work samples and your effort. Hand it to a hiring manager, recruiter or coach. It is never sent unless you send it."
          action={<PrintReportButton />}
        />
        <ShowMore page="recruiter_report" label="Refresh the written sections">
          {/* Regenerates the two AI-written sections. They are cached after the first build. */}
          <form action={regenerateDossierSections} className="space-y-2">
            <p className="text-sm text-muted-foreground">Rewrites the proof-point follow-ups and the job-reaction pattern from your latest activity.</p>
            <SubmitButton variant="outline" pendingLabel="Refreshing…">
              Refresh AI sections
            </SubmitButton>
          </form>
        </ShowMore>
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
