import type { RecruiterReportData } from '@/lib/reports/recruiter-report'
import { EvidenceTypeBadge } from '@/components/dashboard/EvidenceTypeBadge'
import { CHARACTER_SIGNAL_MIN_REFERENCES } from '@/lib/reports/evidence-type'

// The template-based (never LLM-generated — see recruiter-report.ts's own
// comment on why) section list shared by the candidate's own Certified
// Executive Dossier (/dashboard/recruiter-report) and the admin's read-only
// view of the same data (.../candidates/[id]/profile) — extracted so both
// stay in sync rather than maintaining two copies of the same markup.
export function DossierReportSections({ data }: { data: RecruiterReportData }) {
  const hasEffort = data.effortSummaryLines.length > 0

  return (
    <>
      <section>
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase print:text-[#0b2545]">
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
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase print:text-[#0b2545]">
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
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase print:text-[#0b2545]">
              References
            </h3>
            <EvidenceTypeBadge type="reference_verified" />
          </div>
          <div className="mt-2 space-y-3">
            {data.references.map((r, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-foreground">
                  {r.refereeName}
                  <span className="ml-2 text-xs text-muted-foreground">{r.relationshipLabel}</span>
                  {r.wouldHireAgain === true && (
                    <span className="ml-2 text-xs text-muted-foreground">Would hire again</span>
                  )}
                </p>
                {r.strengthSummary && <p className="text-sm text-muted-foreground">{r.strengthSummary}</p>}
              </div>
            ))}
          </div>
          {!data.characterSignalsUnlocked && (
            <p className="mt-2 text-xs text-muted-foreground italic">
              Character signals (what references say about how this candidate works) unlock once{' '}
              {CHARACTER_SIGNAL_MIN_REFERENCES}+ references are on file — a single account isn&apos;t enough to
              triangulate against.
            </p>
          )}
        </section>
      )}

      {data.aiProjects.length > 0 && (
        <section>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase print:text-[#0b2545]">
              AI Fluency
            </h3>
            <EvidenceTypeBadge type={data.aiProjects[0].evidenceType} />
          </div>
          <div className="mt-2 space-y-3">
            {data.aiProjects.map((project, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-foreground">
                  {project.title}
                  {project.toolUsed && <span className="ml-2 text-xs text-muted-foreground">{project.toolUsed}</span>}
                </p>
                {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
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
          <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase print:text-[#0b2545]">
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
          <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase print:text-[#0b2545]">
            On the gap in my history
          </h3>
          <p className="mt-2 text-sm text-foreground">{data.gapExplanation}</p>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase print:text-[#0b2545]">
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
              <dd className="font-medium text-foreground">{data.availability.targetIndustries.join(', ')}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-muted-foreground">Location</dt>
            <dd className="font-medium text-foreground">{data.availability.locationPreference}</dd>
          </div>
        </dl>
      </section>
    </>
  )
}
