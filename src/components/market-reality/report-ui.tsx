import type { ReactNode } from 'react'
import { ASSESSMENT_LABEL, type Assessment } from '@/lib/reports/market-reality-brief/types'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { cn } from '@/lib/utils'

// The visual vocabulary of the Market Reality Report: numbered sections, ruled
// tables and a four-state assessment mark. Deliberately one ink color (navy)
// on white — nothing is red, amber or green, and nothing is a score. The
// document should read like an advisory firm's assessment, not a dashboard.

const LINK = 'text-primary underline underline-offset-4'

export function ReportSection({
  id,
  number,
  title,
  finding,
  children,
  className,
}: {
  id: string
  number?: string
  title: string
  /** The one-sentence takeaway the section leads with. */
  finding?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn('scroll-mt-24 border-t border-navy/20 pt-8', className)}>
      <div className="print:break-inside-avoid print:break-after-avoid">
        <div className="flex items-baseline gap-3">
          {number && <span className="text-sm font-semibold tabular-nums text-muted-foreground">{number}</span>}
          <h2 id={`${id}-title`} className="font-serif text-xl font-semibold tracking-tight text-navy">
            {title}
          </h2>
        </div>
        {finding && <p className="mt-3 max-w-3xl text-[0.95rem] leading-relaxed text-foreground">{finding}</p>}
      </div>
      <div className="mt-5 space-y-6 print:break-before-avoid">{children}</div>
    </section>
  )
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase print:break-after-avoid">{children}</h3>
}

/** A ruled table. `head` labels the columns; rows are plain nodes so cells can hold links. */
export function ReportTable({
  label,
  head,
  rows,
  className,
}: {
  label: string
  head: string[]
  rows: { key: string; cells: ReactNode[] }[]
  className?: string
}) {
  return (
    <div className={cn('overflow-x-auto print:overflow-visible', className)}>
      <table className="w-full min-w-[34rem] border-collapse text-sm" aria-label={label}>
        <thead>
          <tr className="border-b-2 border-navy text-left">
            {head.map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 text-xs font-semibold tracking-wide text-navy uppercase last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="break-inside-avoid border-b border-border align-top">
              {r.cells.map((c, i) => (
                <td key={i} className={cn('py-3 pr-4 last:pr-0', i === 0 && 'font-medium text-foreground')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Harvey-ball style mark plus the word, so the meaning never rests on the glyph alone. */
export function AssessmentMark({ value, label, className }: { value: Assessment; label?: string; className?: string }) {
  const r = 5.5
  return (
    <span className={cn('inline-flex items-center gap-2 whitespace-nowrap', value === 'development' ? 'font-semibold text-foreground' : 'text-foreground', className)}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
        {value === 'not_assessed' ? (
          <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
        ) : (
          <>
            <circle cx="7" cy="7" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-navy" />
            {value === 'strength' && <circle cx="7" cy="7" r={r} className="fill-navy" />}
            {value === 'adequate' && <path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5 Z" className="fill-navy" />}
          </>
        )}
      </svg>
      {label ?? ASSESSMENT_LABEL[value]}
    </span>
  )
}

/** A link that records what the reader acted on. */
export function ReportLink({
  href,
  event,
  properties,
  children,
}: {
  href: string
  event: string
  properties?: Record<string, unknown>
  children: ReactNode
}) {
  return (
    <TrackedLink href={href} event={event} properties={properties} className={LINK}>
      {children}
    </TrackedLink>
  )
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums text-navy">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

export function Estimate() {
  return (
    <span className="ml-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase" title="A working estimate that sharpens as more candidates use the product, not a fixed rule.">
      estimate
    </span>
  )
}
