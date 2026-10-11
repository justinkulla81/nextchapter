import Link from 'next/link'

export function StatTile({ label, value, href, note }: { label: string; value: string | number; href?: string; note?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </>
  )
  return href ? (
    <Link href={href} className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-border bg-card p-4">{body}</div>
  )
}
