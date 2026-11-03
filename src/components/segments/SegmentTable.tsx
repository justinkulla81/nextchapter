import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { LINK } from '@/components/topics/blocks'
import { stateName, stateSlug } from '@/lib/seo/states'
import type { SegmentJob, SegmentRow } from '@/lib/segments/types'

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function Change({ n }: { n: number | null }) {
  if (n == null) return <span className="text-xs text-muted-foreground">new</span>
  if (n === 0) return <span aria-label="no change" className="text-xs text-muted-foreground">–</span>
  return <span className={`text-xs tabular-nums ${n > 0 ? 'text-success' : 'text-muted-foreground'}`} aria-label={`${n > 0 ? 'up' : 'down'} ${Math.abs(n)}`}>{n > 0 ? '▲' : '▼'} {Math.abs(n)}</span>
}

/** A ranked list with a bar behind each value. `hrefs` maps a row key to a page (an employer page); state rows link to their state page. */
export function SegmentTable({ rows, valueHead, nounHead, hrefs, segment, cut, limit }: {
  rows: SegmentRow[]
  valueHead: string
  nounHead: string
  hrefs?: Map<string, string>
  segment: string
  cut: string
  limit?: number
}) {
  const shown = limit ? rows.slice(0, limit) : rows
  const hrefOf = (r: SegmentRow) => (nounHead === 'State' ? `/places/${stateSlug(r.key)}` : hrefs?.get(r.key) ?? null)
  const hasChange = shown.some((r) => r.change != null)
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="w-12 px-4 py-2 font-medium">#</th>
            <th scope="col" className="px-2 py-2 font-medium">{nounHead}</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">{valueHead}</th>
            {hasChange && <th scope="col" className="w-16 px-4 py-2 text-right font-medium">Since last month</th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const href = hrefOf(r)
            return (
              <tr key={r.key} className="border-b border-border last:border-0">
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.rank}</td>
                <td className="px-2 py-3">
                  {href ? (
                    <TrackedLink href={href} event="segment_list_clicked" properties={{ segment, cut, kind: 'row', to: href }} className="font-medium text-navy hover:underline">{nounHead === 'State' ? stateName(r.key) : r.name}</TrackedLink>
                  ) : (
                    <span className="font-medium text-navy">{nounHead === 'State' ? stateName(r.key) : r.name}</span>
                  )}
                  {(r.sub || r.stats.length > 0) && (
                    <span className="block text-xs text-muted-foreground">{[r.sub, ...r.stats.map((s) => `${s.label} ${s.value}`)].filter(Boolean).join(' · ')}</span>
                  )}
                </td>
                <td className="px-2 py-3 text-right">
                  <span className="font-semibold tabular-nums text-navy">{r.valueLabel}</span>
                  <span aria-hidden className="mt-1 ml-auto block h-1.5 max-w-32 rounded-full bg-tint-sky"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.round(r.bar * 100)}%` }} /></span>
                </td>
                {hasChange && <td className="px-4 py-3 text-right"><Change n={r.change} /></td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function SegmentJobs({ jobs, segment, cut, allHref }: { jobs: SegmentJob[]; segment: string; cut: string; allHref: string }) {
  if (!jobs.length) return <p className="text-sm text-muted-foreground">No new jobs in the last seven days. <Link href={allHref} className={LINK}>Search all jobs</Link>.</p>
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-white">
      {jobs.map((j) => (
        <li key={j.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3">
          <div className="min-w-0">
            <TrackedLink href={`/jobs/${j.id}`} event="segment_job_clicked" properties={{ segment, cut, jobId: j.id }} className="font-medium text-navy hover:underline">{j.title}</TrackedLink>
            <p className="text-sm text-muted-foreground">{j.company}{j.location ? ` · ${j.location}` : ''}</p>
          </div>
          <p className="text-sm tabular-nums text-muted-foreground">{j.pay ? `${j.pay} · ` : ''}{day(j.postedAt)}</p>
        </li>
      ))}
    </ul>
  )
}
