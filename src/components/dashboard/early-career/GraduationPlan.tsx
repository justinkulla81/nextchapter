import { ShowMore } from '@/components/candidate/ShowMore'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { Chip, H2 } from '@/components/candidate/ui'
import { GRAD_PHASE_LABEL, SCHOOL_HELP, STUDENT_NOTE_STARTER, gradPhase, gradStepsByTrack } from '@/lib/early-career/graduation-plan'

// "Before you graduate": positioning, the school's network and proof, timed to the graduation date. It is for students who may not
// have a job lined up, so class projects and clubs count as experience. Shared by the page and the dev preview.
export function GraduationPlan({ graduation, schoolName, now }: { graduation: Date | null; schoolName: string | null; now?: Date }) {
  const phase = gradPhase(graduation, now)
  const groups = gradStepsByTrack(phase)
  return (
    <section className="space-y-5" aria-labelledby="grad-plan">
      <div className="flex flex-wrap items-center gap-2">
        <H2 id="grad-plan">{phase === 'graduated' ? 'Now that you have graduated' : 'Before you graduate'}</H2>
        <Chip tone="ink">{GRAD_PHASE_LABEL[phase]}</Chip>
      </div>
      <p className="text-sm text-muted-foreground">
        {graduation ? '' : 'Add your graduation year under Your school and these steps match your timing. '}
        Position yourself, use {schoolName ? `${schoolName}’s` : 'your school’s'} network, and build proof. No job yet is normal: class projects and clubs count.
      </p>
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.track} className="space-y-2">
            <p className="text-base font-semibold text-ink">{g.label}</p>
            <ul className="space-y-2">
              {g.steps.slice(0, 2).map((s) => (
                <li key={s.id} className="space-y-1 rounded-2xl border border-border p-4 text-sm">
                  <p className="font-semibold text-ink">{s.text}</p>
                  <p className="text-muted-foreground">Why: {s.why}</p>
                  <TrackedAction href={s.href} variant="text" event="graduation_step_clicked" properties={{ step: s.id, phase, track: s.track }}>
                    Open
                  </TrackedAction>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <ShowMore label="More steps, who at school can help, and a note to start from" event="graduation_plan_more_opened" properties={{ phase }}>
        {groups.map((g) =>
          g.steps.length > 2 ? (
            <div key={g.track} className="space-y-2">
              <p className="text-base font-semibold text-ink">{g.label}, more</p>
              <ul className="space-y-2">
                {g.steps.slice(2).map((s) => (
                  <li key={s.id} className="space-y-1 rounded-2xl border border-border p-4 text-sm">
                    <p className="font-semibold text-ink">{s.text}</p>
                    <p className="text-muted-foreground">Why: {s.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
        <div className="space-y-2">
          <p className="text-base font-semibold text-ink">Who at your school can help</p>
          <ul className="space-y-2">
            {SCHOOL_HELP.map((h) => (
              <li key={h.who} className="rounded-2xl border border-border p-4 text-sm">
                <p className="font-semibold text-ink">{h.who}</p>
                <p className="text-muted-foreground">{h.what}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2 rounded-2xl bg-muted p-5 text-sm text-ink">
          <p className="font-semibold">A note to an alum, to start from</p>
          <p className="text-muted-foreground">Change every bracket and make it yours. You send it, not us.</p>
          <p>{STUDENT_NOTE_STARTER}</p>
        </div>
      </ShowMore>
    </section>
  )
}
