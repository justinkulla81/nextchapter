import { BoardSearchBar } from '@/components/dashboard/one-board/BoardSearchBar'
import { LookingForChoice } from '@/components/dashboard/one-board/LookingForChoice'
import { NextMoveCard } from '@/components/dashboard/NextMoveSection'
import { nextMove } from '@/lib/market/next-move'

// Find a job, simplified (owner, 2026-11-17): search, one question, one next move with its reason, the jobs.
// Everything else sits in one fold under the list. Sample data.
const tune = { pct: 55, asks: [{ ask: 'Add your city.', gain: "We'd check commute distance on 197 matches we can't place today." }, { ask: 'Confirm your tools.', gain: 'A sharper skills match on every job.' }] }
const MOVES = [
  nextMove({ market: { open: 163, growth: 0, prompt: 'healthy', senior: true }, tune: { ...tune, pct: 90 } })!,
  nextMove({ market: { open: 12, growth: -0.3, prompt: 'too_few', senior: false }, tune: { ...tune, pct: 90 } })!,
  nextMove({ market: { open: 80, growth: -0.4, prompt: 'shrinking', senior: false }, tune })!,
  nextMove({ market: { open: 163, growth: 0, prompt: 'healthy', senior: true }, tune })!,
]

function NextMove({ m }: { m: (typeof MOVES)[number] }) {
  return <NextMoveCard move={m} track={{}} />
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
