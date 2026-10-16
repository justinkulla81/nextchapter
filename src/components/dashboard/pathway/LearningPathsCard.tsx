import { completePathStep } from '@/app/dashboard/pivot-paths/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { nextStep, pathPercent, type LearningPath, type PathProgress } from '@/lib/journey/learning-paths'

// Each learning path serves one goal, and says whether they told us or we inferred it.
export function LearningPathsCard({ paths, progress }: { paths: LearningPath[]; progress: PathProgress }) {
  if (paths.length === 0) {
    return (
      <section className="space-y-1 rounded-lg border border-border p-4" aria-labelledby="learning-paths-heading">
        <h2 id="learning-paths-heading" className="text-lg font-semibold tracking-tight">
          Your learning paths
        </h2>
        <p className="text-sm text-muted-foreground">
          A learning path is built around a goal. Tell us the next level you want, a skill to build, or a field you are open to on Search Strategy, and your paths appear here.
        </p>
      </section>
    )
  }
  return (
    <section className="space-y-4" aria-labelledby="learning-paths-heading">
      <div>
        <h2 id="learning-paths-heading" className="text-lg font-semibold tracking-tight">
          Your learning paths
        </h2>
        <p className="text-sm text-muted-foreground">Each one is tied to a goal. Your weekly plan shows the next step of the first two.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {paths.map((p) => {
          const done = new Set(progress[p.id] ?? [])
          const next = nextStep(p, progress)
          return (
            <article key={p.id} className="space-y-3 rounded-lg border border-border p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Goal: {p.goal} · {p.source === 'expressed' ? 'you told us' : 'we inferred this'}
                </p>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.because}</p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted" role="progressbar" aria-valuenow={pathPercent(p, progress)} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.title} progress`}>
                <div className="h-1.5 rounded-full bg-brand" style={{ width: `${pathPercent(p, progress)}%` }} />
              </div>
              <ol className="space-y-1.5 text-sm">
                {p.steps.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3">
                    <span className={done.has(s.id) ? 'text-muted-foreground line-through' : next?.id === s.id ? 'font-medium' : 'text-muted-foreground'}>
                      {s.title}
                      {s.hours ? ` (about ${s.hours} hours)` : ''}
                    </span>
                    {next?.id === s.id && (
                      <form action={completePathStep}>
                        <input type="hidden" name="pathId" value={p.id} />
                        <input type="hidden" name="stepId" value={s.id} />
                        <SubmitButton size="sm" variant="outline">
                          Mark done
                        </SubmitButton>
                      </form>
                    )}
                  </li>
                ))}
              </ol>
            </article>
          )
        })}
      </div>
    </section>
  )
}
