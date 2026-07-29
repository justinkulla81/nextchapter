import type { DossierSectionId, DossierData } from '@/lib/reports/dossier-sections'
import { PositioningStatementApproval } from '@/components/dashboard/PositioningStatementApproval'

// Shared rendering for the Executive Dossier's 9 dynamically-reweighted
// sections (Prompt 47) — used by both the candidate's own Dossier page and
// the Coach Dossier view (Prompt 54), so section content/generation logic
// is never duplicated between the two. `readOnly` disables the Positioning
// Statement's edit/approve form for the coach view — that gate belongs to
// the candidate alone.
export function DossierSectionsView({ dossier, readOnly = false }: { dossier: DossierData; readOnly?: boolean }) {
  return (
    <>
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

      {dossier.categoryStrengths.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Strengths</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {dossier.categoryStrengths.map((s) => (
              <div key={s.category} className="rounded-lg border border-border p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {s.label}
                  {s.confirmed && (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                      Confirmed
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {dossier.sections.map((section) => (
        <DossierSectionBlock key={section.id} id={section.id} title={section.title} dossier={dossier} readOnly={readOnly} />
      ))}
    </>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>
}

// Renders one of the 9 sections. Sections with nothing real to show yet
// render nothing — never a fabricated placeholder.
function DossierSectionBlock({
  id,
  title,
  dossier,
  readOnly,
}: {
  id: DossierSectionId
  title: string
  dossier: DossierData
  readOnly: boolean
}) {
  switch (id) {
    case 'positioning':
      // readOnly is the shared/printed view a hiring manager sees — show the
      // section only once there's approved text. It used to render an
      // "awaiting approval" placeholder, which advertised an incomplete
      // Dossier to exactly the audience it's meant to impress. The
      // candidate's own view (below) still shows the draft + approve control.
      if (readOnly && !dossier.positioning.approvedText) return null
      if (!dossier.positioning.draftText && !dossier.positioning.approvedText) return null
      return (
        <section>
          <SectionHeading>{title}</SectionHeading>
          <div className="mt-2">
            {readOnly ? (
              <p className="text-sm text-foreground">{dossier.positioning.approvedText}</p>
            ) : (
              <PositioningStatementApproval
                draftText={dossier.positioning.draftText ?? ''}
                approvedText={dossier.positioning.approvedText}
              />
            )}
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
