import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getRecruiterReportData } from '@/lib/reports/recruiter-report'
import { getDossierSections, type DossierSectionId, type DossierData } from '@/lib/reports/dossier-sections'
import { PrintReportButton } from '@/components/dashboard/PrintReportButton'
import { PositioningStatementApproval } from '@/components/dashboard/PositioningStatementApproval'
import { EvidenceTypeBadge } from '@/components/dashboard/EvidenceTypeBadge'
import { CHARACTER_SIGNAL_MIN_REFERENCES } from '@/lib/reports/evidence-type'
import { Logo } from '@/components/Logo'

export default async function RecruiterReportPage() {
  const profile = await getDashboardData()
  const [data, dossier] = await Promise.all([
    getRecruiterReportData(profile.id),
    getDossierSections(profile.id),
  ])

  const hasEffort = data.effortSummaryLines.length > 0

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
          <PrintReportButton />
        </div>
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

        {dossier.closedLoopCallouts.length > 0 && (
          <section className="rounded-lg bg-primary/5 p-4 print:bg-transparent print:border print:border-border">
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Addressing what Market Reality flagged
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {dossier.closedLoopCallouts.map((callout, i) => (
                <li key={i}>
                  Market Reality flagged: <span className="italic">{callout.namedReasonText}</span> — this Dossier
                  addresses it with <span className="font-medium">{callout.sectionTitle}</span>.
                </li>
              ))}
            </ul>
          </section>
        )}

        {dossier.sections.map((section) => (
          <DossierSectionBlock key={section.id} id={section.id} title={section.title} dossier={dossier} />
        ))}

        <section>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
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
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
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
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
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
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
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
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
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

        <section>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>
  )
}

// Renders one of the 9 dynamically-reweighted Dossier sections (Prompt 47).
// Sections with nothing real to show yet render nothing — never a
// fabricated placeholder.
function DossierSectionBlock({
  id,
  title,
  dossier,
}: {
  id: DossierSectionId
  title: string
  dossier: DossierData
}) {
  switch (id) {
    case 'positioning':
      if (!dossier.positioning.draftText && !dossier.positioning.approvedText) return null
      return (
        <section>
          <SectionHeading>{title}</SectionHeading>
          <div className="mt-2">
            <PositioningStatementApproval
              draftText={dossier.positioning.draftText ?? ''}
              approvedText={dossier.positioning.approvedText}
            />
          </div>
        </section>
      )

    case 'howIOperate':
      if (dossier.howIOperate.dimensionSummaries.length === 0 && dossier.howIOperate.superpowers.length === 0)
        return null
      return (
        <section>
          <SectionHeading>{title}</SectionHeading>
          {dossier.howIOperate.dimensionSummaries.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
              {dossier.howIOperate.dimensionSummaries.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          {dossier.howIOperate.superpowers.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Superpowers</p>
              {dossier.howIOperate.superpowers.map((sp, i) => (
                <p key={i} className="text-sm text-foreground">
                  {sp.label}
                  {sp.referenceConfirmed && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      Self-identified as a strength — independently confirmed by {sp.confirmedByCount} of{' '}
                      {sp.totalReferences} references.
                    </span>
                  )}
                </p>
              ))}
            </div>
          )}
        </section>
      )

    case 'whatDrivesMe':
      if (!dossier.whatDrivesMe.effortStatText && !dossier.whatDrivesMe.motivationNarrative) return null
      return (
        <section>
          <SectionHeading>{title}</SectionHeading>
          {dossier.whatDrivesMe.effortStatText && (
            <p className="mt-2 text-sm font-medium text-foreground">{dossier.whatDrivesMe.effortStatText}</p>
          )}
          {dossier.whatDrivesMe.motivationNarrative && (
            <p className="mt-2 text-sm text-foreground">{dossier.whatDrivesMe.motivationNarrative}</p>
          )}
        </section>
      )

    case 'aiFluency':
      if (!dossier.aiFluencyExample) return null
      return (
        <section>
          <SectionHeading>{title}</SectionHeading>
          <p className="mt-2 text-sm text-foreground">{dossier.aiFluencyExample}</p>
        </section>
      )

    case 'impactOnPeople':
      if (dossier.impactOnPeople.quotes.length === 0 && !dossier.impactOnPeople.communityNarrative) return null
      return (
        <section>
          <SectionHeading>{title}</SectionHeading>
          {dossier.impactOnPeople.quotes.length > 0 && (
            <div className="mt-2 space-y-3">
              {dossier.impactOnPeople.quotes.map((q, i) => (
                <blockquote key={i} className="border-l-2 border-border pl-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{q.theme}</p>
                  <p className="text-sm italic text-foreground">&ldquo;{q.quoteText}&rdquo;</p>
                  <p className="text-xs text-muted-foreground">— {q.refereeName}</p>
                </blockquote>
              ))}
            </div>
          )}
          {dossier.impactOnPeople.communityNarrative && (
            <p className="mt-3 text-sm text-foreground">{dossier.impactOnPeople.communityNarrative}</p>
          )}
        </section>
      )

    case 'selfAwareness':
      if (dossier.selfAwareness.growthEdges.length === 0) return null
      return (
        <section>
          <SectionHeading>{title}</SectionHeading>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            {dossier.selfAwareness.growthEdges.map((edge, i) => (
              <li key={i}>{edge}</li>
            ))}
          </ul>
        </section>
      )

    case 'learningGrowth':
      if (dossier.learningGrowth.items.length === 0) return null
      return (
        <section>
          <SectionHeading>{title}</SectionHeading>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {dossier.learningGrowth.items.map((item, i) => (
              <li key={i}>
                {item.title}
                {item.closedGapArea && (
                  <span className="text-muted-foreground"> — closed a gap in {item.closedGapArea}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )

    case 'fit':
      if (!dossier.fit.patternSummary) return null
      return (
        <section>
          <SectionHeading>{title}</SectionHeading>
          <p className="mt-2 text-sm text-foreground">{dossier.fit.patternSummary}</p>
        </section>
      )

    case 'proofPoints':
      if (dossier.proofPoints.length === 0) return null
      return (
        <section>
          <SectionHeading>{title}</SectionHeading>
          <div className="mt-2 space-y-4">
            {dossier.proofPoints.map((pp, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-foreground">{pp.question}</p>
                <p className="mt-1 text-sm text-muted-foreground">{pp.response}</p>
                {pp.followUps.length > 0 && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                    {pp.followUps.map((f, j) => (
                      <li key={j}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )
  }
}
