import Link from 'next/link'

/**
 * Two to four choices as adjacent buttons (design principle 1), each a link
 * so the choice lives in the query string and the view is bookmarkable.
 */
export function LinkButtonGroup({ label, items }: { label: string; items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs" role="group" aria-label={label}>
      <span className="mr-1 text-muted-foreground">{label}</span>
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          aria-current={i.active ? 'true' : undefined}
          className={`rounded-md border px-2.5 py-1 ${i.active ? 'border-brand bg-brand/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  )
}
