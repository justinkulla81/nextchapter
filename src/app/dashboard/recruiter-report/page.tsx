import Link from 'next/link'
import { FileText } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getRecruiterReportData } from '@/lib/reports/recruiter-report'
import { getDossierSections, getDossierSectionCompleteness } from '@/lib/reports/dossier-sections'
import { PrintReportButton } from '@/components/dashboard/PrintReportButton'
import { SubmitButton } from '@/components/ui/submit-button'
import { regenerateDossierSections } from './actions'
import { DossierSectionsView } from '@/components/dashboard/DossierSections'
import { DossierCompletenessRing } from '@/components/dashboard/DossierCompletenessRing'
import { EvidenceTypeBadge } from '@/components/dashboard/EvidenceTypeBadge'
import { StatusRow } from '@/components/ui/status-icon'
import { EmptyState } from '@/components/ui/empty-state'
import { CHARACTER_SIGNAL_MIN_REFERENCES } from '@/lib/reports/evidence-type'
import { Logo } from '@/components/Logo'

export default async function RecruiterReportPage() {
  const profile = await getDashboardData()
  const [data, dossier] = await Promise.all([
    getRecruiterReportData(profile.id),
    getDossierSections(profile.id),
  ])

  const hasEffort = data.effortSummaryLines.length > 0
  const sectionCompleteness = getDossierSectionCompleteness(dossier)
  const completedCount = sectionCompleteness.filter((s) => s.hasContent).length

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
        {completedCount === 0 ? (
          <EmptyState
            icon={FileText}
            title="Your Dossier doesn't have much yet"
            description="Add references, log a work sample, or complete How I Work Best — each one fills in a section below. Nothing here is fabricated; sections stay blank until there's something real to show."
          />
        ) : (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <DossierCompletenessRing completed={completedCount} total={sectionCompleteness.length} />
            <div className="grid gap-x-6 gap-y-1.5 border-t border-border pt-3 sm:grid-cols-2">
              {sectionCompleteness.map((s) => (
                <StatusRow key={s.id} status={s.hasContent ? 'success' : 'locked'} label={s.title} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-8 rounded-xl border border-border p-8 print:border-0 print:p-0">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <Logo className="text-xl print:text-3xl" />
          <p className="text-sm text-muted-foreground">
            Generated {data.generatedAt.toLocaleDateString()}
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">{data.candidateName}</h2>
          {data.availability.targetRoleType && (
            <p className="text-muted-foreground">Targeting: {data.availability.targetRoleType}</p>
          )}
        </div>

        <DossierSectionsView dossier={dossier} />

        <section>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Effort summary
            </h3>
            {hasEffort && <EvidenceTypeBadge type={data.effortSummaryLines[0].evidenceType} />}
          </div>
          {hasEffort ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
              {data.effortSummaryLines.map((line, i) => (
                <li key={i}>{line.text}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              This candidate is just getting started — check back soon for more detail.
            </p>
          )}
        </section>

        {data.peerSupportLine && (
          <section>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Peer Support
              </h3>
              <EvidenceTypeBadge type={data.peerSupportLine.evidenceType} />
            </div>
            <p className="mt-2 text-sm text-foreground">{data.peerSupportLine.text}</p>
          </section>
        )}

        {data.references.length > 0 && (
          <section>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                References
              </h3>
              <EvidenceTypeBadge type="reference_verified" />
            </div>
            <div className="mt-2 space-y-3">
              {data.references.map((r, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-foreground">
                    {r.refereeName}
                    {r.wouldHireAgain === true && (
                      <span className="ml-2 text-xs text-muted-foreground">Would hire again</span>
                    )}
                  </p>
                  {r.strengthSummary && (
                    <p className="text-sm text-muted-foreground">{r.strengthSummary}</p>
                  )}
                </div>
              ))}
            </div>
            {!data.characterSignalsUnlocked && (
              <p className="mt-2 text-xs text-muted-foreground italic">
                Character signals (what references say about how this candidate works) unlock once{' '}
                {CHARACTER_SIGNAL_MIN_REFERENCES}+ references are on file — a single account isn&apos;t
                enough to triangulate against.
              </p>
            )}
          </section>
        )}

        {data.aiProjects.length > 0 && (
          <section>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                AI Fluency
              </h3>
              <EvidenceTypeBadge type={data.aiProjects[0].evidenceType} />
            </div>
            <div className="mt-2 space-y-3">
              {data.aiProjects.map((project, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-foreground">
                    {project.title}
                    {project.toolUsed && (
                      <span className="ml-2 text-xs text-muted-foreground">{project.toolUsed}</span>
                    )}
                  </p>
                  {project.description && (
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                  )}
                  {project.judgmentCall && (
                    <p className="mt-1 text-sm text-foreground">
                      <span className="font-medium">The judgment call: </span>
                      {project.judgmentCall}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.learningItems.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Learning
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {data.learningItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span>
                    {item.title}
                    {item.provider ? ` — ${item.provider}` : ''}{' '}
                    <span className="text-muted-foreground">
                      ({item.completedAt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })})
                    </span>
                  </span>
                  <EvidenceTypeBadge type={item.evidenceType} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.gapExplanation && (
          <section>
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              On the gap in my history
            </h3>
            <p className="mt-2 text-sm text-foreground">{data.gapExplanation}</p>
          </section>
        )}

        <section>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Availability &amp; fit
            </h3>
            <EvidenceTypeBadge type={data.availability.evidenceType} />
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
            {data.availability.statusLabel && (
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium text-foreground">{data.availability.statusLabel}</dd>
              </div>
            )}
            {data.availability.primaryFunction && (
              <div>
                <dt className="text-muted-foreground">Function</dt>
                <dd className="font-medium text-foreground">{data.availability.primaryFunction}</dd>
              </div>
            )}
            {data.availability.highestLevelReached && (
              <div>
                <dt className="text-muted-foreground">Level</dt>
                <dd className="font-medium text-foreground">{data.availability.highestLevelReached}</dd>
              </div>
            )}
            {data.availability.targetIndustries.length > 0 && (
              <div>
                <dt className="text-muted-foreground">Target industries</dt>
                <dd className="font-medium text-foreground">
                  {data.availability.targetIndustries.join(', ')}
                </dd>
              </div>
            )}
            <div className="col-span-2">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="font-medium text-foreground">{data.availability.locationPreference}</dd>
            </div>
          </dl>
        </section>
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
