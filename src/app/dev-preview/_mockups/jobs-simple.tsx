import { BoardSearchBar } from '@/components/dashboard/one-board/BoardSearchBar'
import { LookingForChoice } from '@/components/dashboard/one-board/LookingForChoice'

// Find a job, simplified (owner, 2026-11-17): search, one question, one next move with its reason, the jobs.
// Everything else sits in one fold under the list. Sample data.
const MOVES = [
  {
    kind: 'Stay the course',
    text: "You're in a good pool: about 163 advertised roles fit you, and the number is steady.",
    why: 'At your level most roles are filled through introductions, so reaching people at these companies does more than widening the search.',
    action: 'See who to contact at these jobs',
  },
  {
    kind: 'Consider a pivot',
    text: 'Only about 12 roles fit you, and your field is shrinking.',
    why: 'Operations finance has 3 times the openings for your experience and asks for skills you already have.',
    action: 'See where to widen',
  },
  {
    kind: 'Add a skill',
    text: 'Half the roles that fit you ask for SQL or Power BI.',
    why: 'You have neither on your profile. Either one opens about 40 more roles.',
    action: 'See the skills to add',
  },
  {
    kind: 'Finish your profile',
    text: 'Your matches are 55% tuned.',
    why: "Add your city and confirm your tools: we'll check commute on 197 jobs we can't place and sharpen the skills match.",
    action: 'Improve my matches',
  },
]

function NextMove({ m }: { m: (typeof MOVES)[number] }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-muted/50 p-4">
      <div className="max-w-2xl space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your next move: {m.kind}</p>
        <p className="text-base font-medium text-ink">{m.text}</p>
        <p className="text-sm text-muted-foreground">{m.why}</p>
      </div>
      <a href="#" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        {m.action}
      </a>
    </section>
  )
}

function Job({ title, meta, why }: { title: string; meta: string; why: string }) {
  return (
    <li className="space-y-1 border-b border-border px-4 py-3 last:border-0">
      <p className="font-medium text-ink">{title}</p>
      <p className="text-sm text-muted-foreground">{meta}</p>
      <p className="text-sm text-foreground">{why}</p>
    </li>
  )
}

export function FindSimple() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="font-serif text-4xl text-ink">Find a job</h1>
      <BoardSearchBar />
      <LookingForChoice selected="fractional" />
      <NextMove m={MOVES[0]} />
      <div>
        <p className="mb-2 text-sm font-medium text-ink">6 jobs, best fit first</p>
        <ul className="rounded-lg border border-border bg-card">
          <Job title="Interim Chief Financial Officer (CFO), Carey & Co" meta="Carey · New York, NY · Contract · posted 97 days ago" why="Fits your level. Executive leadership, a field next to yours." />
          <Job title="Fractional CFO, Series B SaaS" meta="Northwind · Remote · Part-time · posted 3 days ago" why="Fits your level and your software background." />
        </ul>
      </div>
      <details className="rounded-lg border border-border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-ink">More filters and options</summary>
        <p className="mt-2 text-sm text-muted-foreground">Where to look, filters and views, paid expert calls, jobs you passed on, roles posted directly by employers.</p>
      </details>
      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-xs text-muted-foreground">The other three versions of the next-move card:</p>
        {MOVES.slice(1).map((m) => (
          <NextMove key={m.kind} m={m} />
        ))}
      </div>
    </div>
  )
}
