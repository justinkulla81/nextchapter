import { coursesForSkills, programsForOccupation } from '@/lib/careers/training'
import { TrackedLink } from '@/components/dashboard/pivot/TrackedLink'

const money = (n: number) => `$${n.toLocaleString('en-US')}`

const MODE_LABEL: Record<string, string> = { IN_PERSON: 'In person', ONLINE: 'Online', HYBRID: 'Hybrid' }

// Training that closes the gaps shown on a pivot option: catalog courses tagged
// with those skills, and publicly funded programs in the person's state. Render
// inside <Suspense>.
export async function TrainingForOption({
  socCode,
  title,
  skillIds,
  stateCode,
}: {
  socCode: string
  title: string
  skillIds: string[]
  stateCode: string | null
}) {
  const [courses, programs] = await Promise.all([coursesForSkills(skillIds, 3), programsForOccupation(socCode, stateCode, 3)])

  if (courses.length === 0 && programs.length === 0) {
    return <p className="text-xs text-muted-foreground">We have no matched courses or funded programs for this role yet.</p>
  }

  return (
    <div className="space-y-3 text-sm">
      {courses.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium text-foreground">Courses that cover these skills</p>
          <ul className="space-y-1">
            {courses.map((c) => (
              <li key={c.id} className="text-muted-foreground">
                <TrackedLink href={c.url} event="pivot_course_clicked" properties={{ socCode, courseId: c.id, covers: c.covers }}>
                  {c.title}
                </TrackedLink>
                {c.sponsor ? `, ${c.sponsor}` : ''}
                {c.free ? ', free' : ''}. Covers {c.covers.join(', ')}.
              </li>
            ))}
          </ul>
        </div>
      )}
      {programs.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium text-foreground">Publicly funded programs in {stateCode}</p>
          <ul className="space-y-1">
            {programs.map((p) => {
              const facts = [
                p.credential,
                p.deliveryMode ? MODE_LABEL[p.deliveryMode] : null,
                p.durationWeeks ? `${p.durationWeeks} weeks` : null,
                p.costUsd !== null ? money(p.costUsd) : null,
              ].filter(Boolean)
              return (
                <li key={p.id} className="text-muted-foreground">
                  {p.url ? (
                    <TrackedLink href={p.url} event="pivot_program_clicked" properties={{ socCode, programId: p.id, state: stateCode, title }}>
                      {p.programName}
                    </TrackedLink>
                  ) : (
                    <span className="text-foreground">{p.programName}</span>
                  )}
                  , {p.providerName}
                  {facts.length > 0 ? ` (${facts.join(', ')})` : ''}
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            From the state&apos;s approved training list ({programs[0].sourceName}). Ask your local career center whether you qualify for funding.
          </p>
        </div>
      )}
    </div>
  )
}
