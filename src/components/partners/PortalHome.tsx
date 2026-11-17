import type { ReactNode } from 'react'
import Link from 'next/link'
import { Highlight } from '@/components/ui/highlight'
import { PortalHomeLink } from '@/components/partners/PortalHomeLink'
import { cn } from '@/lib/utils'

// The portal Home (owner decision, 2026-11-17; preview src/app/dev-preview/_mockups/portal-look.tsx). Every portal's Home
// opens the same way: one headline with one line under it and one primary action, then three sections at most: what
// needs you (the portal's tint, each item with its reason and one action), three numbers that each say where they come
// from, and one dense working table. Anything else sits in PortalHomeMore, closed. The page headline's squiggle and type
// come from the portal frame (.theme-portal in globals.css).

export type PortalKey = 'recruiter' | 'employer' | 'hiring' | 'coach' | 'higher_ed' | 'workforce'

export function PortalHomeHeader({ eyebrow, title, intro, action, portal }: { eyebrow?: string; title: string; intro?: ReactNode; action?: { href: string; label: string }; portal: PortalKey }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-balance">{title}</h1>
        {intro && <p className="max-w-2xl pt-1 text-base text-muted-foreground">{intro}</p>}
      </div>
      {action && (
        <PortalHomeLink
          href={action.href}
          portal={portal}
          item="primary_action"
          className="nc-action inline-flex h-11 shrink-0 items-center rounded-lg px-5 text-sm font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {action.label}
        </PortalHomeLink>
      )}
    </header>
  )
}

export interface NeedsItem {
  /** A stable key for analytics ("late_feedback", "seat_requests"): which kind of item was acted on. */
  key: string
  title: string
  why?: string
  href: string
  action: string
}

export function PortalNeeds({ title = 'Needs you this week', items, empty, portal }: { title?: string; items: NeedsItem[]; empty: string; portal: PortalKey }) {
  return (
    <section aria-labelledby="portal-needs" className="rounded-3xl bg-[var(--portal-tint,var(--muted))] p-5 sm:p-6">
      <h2 id="portal-needs" className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
        <span aria-hidden="true" className="inline-block h-5 w-1.5 rounded-full bg-[var(--portal,var(--ink))]" />
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-white px-5 py-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((n) => (
            <li key={`${n.key}:${n.title}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-2xl bg-white px-5 py-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{n.title}</p>
                {n.why && <p className="mt-0.5 text-sm text-muted-foreground">{n.why}</p>}
              </div>
              <PortalHomeLink
                href={n.href}
                portal={portal}
                item={n.key}
                className="shrink-0 rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {n.action}
              </PortalHomeLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export interface PortalNumber {
  value: string
  label: string
  /** Where the figure comes from. Every number says it. */
  source: string
  /** The one number that matters gets the marker. At most one per page. */
  highlight?: boolean
}

export function PortalNumbers({ items, label = 'Your numbers' }: { items: PortalNumber[]; label?: string }) {
  return (
    <section aria-labelledby="portal-numbers">
      <h2 id="portal-numbers" className="sr-only">
        {label}
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((s) => (
          <div key={s.label} className="rounded-2xl border border-t-4 border-border border-t-[var(--portal,var(--ink))] bg-white p-5">
            <p className="font-display text-3xl font-semibold text-ink tabular-nums">{s.highlight ? <Highlight>{s.value}</Highlight> : s.value}</p>
            <p className="mt-1 font-semibold text-ink">{s.label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{s.source}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export interface PortalRow {
  key: string
  /** The first cell is the row's name; with href it links to the record. */
  href?: string
  cells: ReactNode[]
}

/** The working table: dense 40px rows, hairlines, no boxes. */
export function PortalTable({ title, link, columns, rows, empty }: { title: string; link?: { href: string; label: string }; columns: string[]; rows: PortalRow[]; empty: ReactNode }) {
  return (
    <section aria-labelledby="portal-table">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="portal-table" className="font-display text-xl font-semibold text-ink">
          {title}
        </h2>
        {link && (
          <Link href={link.href} className="text-sm font-semibold text-[color:var(--portal,var(--ink))] underline underline-offset-4">
            {link.label}
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                {columns.map((c) => (
                  <th key={c} scope="col" className="h-10 pr-4 font-medium whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/70">
                  {r.cells.map((c, i) => (
                    <td key={i} className={cn('h-10 pr-4', i === 0 ? 'font-semibold text-ink' : 'text-ink/80')}>
                      {i === 0 && r.href ? (
                        <Link href={r.href} className="hover:underline">
                          {c}
                        </Link>
                      ) : (
                        c
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** Everything that is not one of the three sections: closed by default, one click away. */
export function PortalHomeMore({ label = 'More', children }: { label?: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-border bg-white">
      <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-ink marker:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">
          ›
        </span>{' '}
        {label}
      </summary>
      <div className="space-y-6 border-t border-border px-5 py-5">{children}</div>
    </details>
  )
}

/** A plain list of places to go, for PortalHomeMore. */
export function PortalLinks({ links }: { links: { href: string; label: string; line: string }[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {links.map((l) => (
        <li key={l.href}>
          <Link href={l.href} className="block h-full rounded-xl border border-border p-4 transition-colors hover:border-[var(--portal,var(--ink))]">
            <p className="font-semibold text-ink">{l.label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{l.line}</p>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function firstName(full: string | null | undefined): string | null {
  const f = full?.trim().split(/\s+/)[0]
  return f || null
}
