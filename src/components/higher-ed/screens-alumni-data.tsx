// Alumni Relations › Alumni data. Where alumni work (function, seniority,
// industry, company size, region), founders, the last year's moves, and the
// roster's class decades and majors. Counts only; every panel says how many
// alumni it covers, and groups under five are folded into "Other".

import { BarChart3 } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { alumniData, type Breakdown } from '@/lib/higher-ed/alumni-data'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { EmptyState } from '@/components/ui/empty-state'
import { StatTile } from './StatTile'

type Props = { ctx: WorkspaceContext; base: string }

const fmt = (n: number) => n.toLocaleString()
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–')
const orFew = (n: number | null) => (n === null ? `<${MIN_CELL_SIZE}` : fmt(n))

function BreakdownPanel({ title, b, of, ofLabel, id }: { title: string; b: Breakdown; of: number; ofLabel: string; id: string }) {
  const max = Math.max(...b.slices.map((s) => s.n), b.other, 1)
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h3 id={id} className="text-sm font-semibold">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">
          Known for {fmt(b.covered)} of {fmt(of)} {ofLabel} ({pct(b.covered, of)})
        </p>
      </div>
      {b.slices.length ? (
        <ul className="space-y-2">
          {[...b.slices, ...(b.other ? [{ label: `Other (groups under ${MIN_CELL_SIZE})`, n: b.other }] : [])].map((s) => (
            <li key={s.label} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate" title={s.label}>
                {s.label}
              </span>
              <span className="h-2 rounded-full bg-muted" aria-hidden="true">
                <span className="block h-2 rounded-full bg-muted-foreground/60" style={{ width: `${Math.max(2, (s.n / max) * 100)}%` }} />
              </span>
              <span className="tabular-nums text-muted-foreground">
                {fmt(s.n)} <span className="text-xs">({pct(s.n, b.covered)})</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No group has {MIN_CELL_SIZE} or more alumni yet. This fills in as alumni join and share their work.</p>
      )}
    </section>
  )
}

export async function AlumniData({ ctx }: Props) {
  const d = await alumniData(ctx.institution.id)
  const enough = d.sharing >= MIN_CELL_SIZE
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Where your alumni work, from the alumni who joined and share their work with you, and your roster for class year and major. Counts only: groups under{' '}
        {MIN_CELL_SIZE} are folded into “Other,” and every panel says how many alumni it covers. It grows as more alumni join. Updated every 10 minutes.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Alumni on your roster" value={fmt(d.roster)} />
        <StatTile label="Joined NextChapter" value={fmt(d.joined)} note={`${pct(d.joined, d.roster)} of the roster`} />
        <StatTile label="Share where they work" value={orFew(atLeastOrNull(d.sharing))} note="The base for the work panels below" />
      </div>

      {enough ? (
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Where they work</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownPanel id="ad-function" title="Function" b={d.function} of={d.sharing} ofLabel="sharing alumni" />
            <BreakdownPanel id="ad-seniority" title="Seniority" b={d.seniority} of={d.sharing} ofLabel="sharing alumni" />
            <BreakdownPanel id="ad-industry" title="Industry" b={d.industry} of={d.sharing} ofLabel="sharing alumni" />
            <BreakdownPanel id="ad-size" title="Employer size" b={d.size} of={d.sharing} ofLabel="sharing alumni" />
            <BreakdownPanel id="ad-region" title="Region" b={d.region} of={d.sharing} ofLabel="sharing alumni" />
            <section aria-labelledby="ad-founders" className="space-y-3 rounded-lg border border-border bg-card p-4">
              <h3 id="ad-founders" className="text-sm font-semibold">
                Founders and owners
              </h3>
              <p className="text-2xl font-semibold tabular-nums">{orFew(d.founders)}</p>
              <p className="text-xs text-muted-foreground">Sharing alumni whose current title is founder, co-founder, owner or founding partner.</p>
            </section>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="Not enough alumni sharing yet"
          description={`The work panels appear once ${MIN_CELL_SIZE} or more joined alumni share where they work. Invite alumni from Admin › Roster.`}
        />
      )}

      <div className="space-y-4">
        <h2 className="text-base font-semibold">The last 12 months</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Reported a new job" value={orFew(d.moves.newJobs)} />
          <StatTile label="Promoted to VP or above" value={orFew(d.moves.promotions)} />
          <StatTile label="At an employer with a layoff" value={orFew(d.moves.layoffMatches)} note="Matched from layoff notices, whole roster" />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold">Your roster</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownPanel id="ad-decade" title="Class decade" b={d.decade} of={d.roster} ofLabel="alumni on the roster" />
          <BreakdownPanel id="ad-major" title="Major" b={d.major} of={d.roster} ofLabel="alumni on the roster" />
          {d.school.covered > 0 && <BreakdownPanel id="ad-school" title="School or college" b={d.school} of={d.roster} ofLabel="alumni on the roster" />}
          {d.department.covered > 0 && <BreakdownPanel id="ad-department" title="Department" b={d.department} of={d.roster} ofLabel="alumni on the roster" />}
        </div>
      </div>
    </div>
  )
}

function atLeastOrNull(n: number): number | null {
  return n >= MIN_CELL_SIZE ? n : null
}
