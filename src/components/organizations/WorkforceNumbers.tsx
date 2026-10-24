import { AudienceSection } from '@/components/organizations/AudienceShell'
import { WorkforceStatsTracker } from '@/components/organizations/WorkforceStatsTracker'
import { loadEntryLevelLine, loadWorkforceNumbers } from '@/lib/marketing/workforce-numbers'

/**
 * "By the numbers" for workforce boards: live counts from the board, the skills taxonomy, the
 * pivot map and the learning library (src/lib/marketing/workforce-numbers.ts). A figure that
 * fails to load drops its tile; if nothing loads, the section is not rendered.
 */
export async function WorkforceNumbers({ page }: { page: string }) {
  const [groups, entryLine] = await Promise.all([loadWorkforceNumbers(), loadEntryLevelLine()])
  if (groups.length === 0) return null
  const keys = groups.flatMap((g) => g.tiles.map((t) => t.key))
  return (
    <AudienceSection id="by-the-numbers" title="By the numbers">
      <WorkforceStatsTracker page={page} tiles={keys}>
        <div className="space-y-8">
          {groups.map((g) => (
            <div key={g.key}>
              <h3 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">{g.title}</h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.tiles.map((t) => (
                  <li key={t.key} className="rounded-2xl bg-muted/40 p-5">
                    <p className="font-display text-3xl font-semibold tracking-tight text-ink">{t.value}</p>
                    <p className="mt-1 font-semibold text-ink">{t.label}</p>
                    {t.detail && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.detail}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {entryLine && <p className="mt-6 text-base text-ink">{entryLine}</p>}
        <p className="mt-6 text-sm text-muted-foreground">
          <span className="font-semibold text-ink">How we count:</span> every figure comes from our live database, is refreshed daily and is
          rounded down (“+” means more than shown); open jobs leave out internships and expired or closed postings, a job listed more than once counts once, and each employer counts once.
        </p>
      </WorkforceStatsTracker>
    </AudienceSection>
  )
}
