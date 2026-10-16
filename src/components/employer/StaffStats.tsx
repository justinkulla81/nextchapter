// Count tiles for the Growth and Learning dashboards. A null count means too
// few people have joined to show it without pointing at someone.
export function StatTile({ label, value, of }: { label: string; value: number | null; of?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      {value === null ? (
        <p className="mt-1 text-sm text-muted-foreground">Shown once 10 people have joined</p>
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {value}
          {of !== undefined && <span className="text-sm font-normal text-muted-foreground"> of {of}</span>}
        </p>
      )}
    </div>
  )
}

export const showCell = (v: number | null) => (v === null ? '—' : String(v))

export function NotOnProgram({ program, what }: { program: string; what: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">{program}</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">{what}</p>
      <p className="text-sm text-muted-foreground">
        Your account doesn’t include {program} yet. To add it, email{' '}
        <a className="underline underline-offset-4" href={`mailto:support@launchyournextchapter.com?subject=${encodeURIComponent(`Adding ${program}`)}`}>
          support@launchyournextchapter.com
        </a>
        .
      </p>
    </div>
  )
}
