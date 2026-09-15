// Native <details>/<summary> — free keyboard support and no client state to
// wire up, which is all "minimize/maximize this section" actually needs.
export function AdminCollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string
  /** Shown next to the title even while collapsed, e.g. a count. */
  summary?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 select-none">
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-90">▶</span>
          <span className="font-medium">{title}</span>
        </span>
        {summary && <span className="text-sm text-muted-foreground">{summary}</span>}
      </summary>
      <div className="border-t border-border p-3">{children}</div>
    </details>
  )
}
