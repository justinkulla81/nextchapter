import { COMPETENCY_ORDER, COMPETENCY_LABEL, SOURCE_ORDER, SOURCE_LABEL } from '@/lib/scoring/competency-grid'
import { cn } from '@/lib/utils'

// Partners Master Build Script §C3.1, section 2: "the problem, in one
// screen — the 15 competency cells, with the two a resume can fill
// highlighted and thirteen greyed. Show it, don't argue it."
//
// Uses the REAL 5 competencies x 3 sources grid the product actually scores
// (src/lib/scoring/competency-grid.ts) rather than an invented illustration.
// One honest adjustment from the spec's literal wording: the scoring engine
// deliberately assigns a resume 0 of 15 MEASURED cells (see that file's own
// comment — "a resume therefore fills 0 of 15 cells, this is the intended
// state"; a resume is self-reported, not verified evidence). So instead of
// claiming a resume "fills" 2 cells, this highlights the 2 cells a resume
// can plausibly speak to at all (Skills & Execution, Leadership — the
// things a bullet point claims) as "self-reported, unverified" rather than
// "measured" — which makes the same visual point the spec wants without
// contradicting how the product actually grades.
const RESUME_TOUCHES: { competency: (typeof COMPETENCY_ORDER)[number]; source: (typeof SOURCE_ORDER)[number] }[] = [
  { competency: 'skillsExecution', source: 'activity' },
  { competency: 'leadership', source: 'activity' },
]

function touchesResume(competency: (typeof COMPETENCY_ORDER)[number], source: (typeof SOURCE_ORDER)[number]) {
  return RESUME_TOUCHES.some((t) => t.competency === competency && t.source === source)
}

export function CompetencyGridVisual() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-xl border border-light-gray bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-light-gray bg-off-white px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Competency
              </th>
              {SOURCE_ORDER.map((source) => (
                <th
                  key={source}
                  className="border-b border-light-gray bg-off-white px-3 py-2 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {SOURCE_LABEL[source]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPETENCY_ORDER.map((competency) => (
              <tr key={competency} className="border-b border-light-gray last:border-b-0">
                <td className="px-3 py-3 text-sm font-medium text-navy">{COMPETENCY_LABEL[competency]}</td>
                {SOURCE_ORDER.map((source) => {
                  const isResume = touchesResume(competency, source)
                  return (
                    <td key={source} className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          'mx-auto flex size-8 items-center justify-center rounded-md text-xs font-medium',
                          isResume
                            ? 'border-2 border-dashed border-warning/60 bg-warning/10 text-warning'
                            : 'bg-muted text-muted-foreground/40'
                        )}
                        title={isResume ? 'Self-reported by resume — unverified' : 'Only filled by verification'}
                      >
                        {isResume ? '?' : ''}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <span className="font-medium text-warning">2 of 15 cells</span> are things a resume can even claim —
        and a claim isn&apos;t evidence. The other <span className="font-medium text-foreground">13</span> are
        filled only by references, a real assessment, and what you actually do — none of it comes from a
        document you wrote about yourself.
      </p>
    </div>
  )
}
