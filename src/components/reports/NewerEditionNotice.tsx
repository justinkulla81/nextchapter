import Link from 'next/link'
import { latestReport, reportPath } from '@/lib/reports'

/**
 * On an edition that is no longer the newest, say so and link the newest one, so a reader (or an assistant) who lands on an older
 * month is not left quoting superseded figures. Renders nothing on the newest edition, so adding next month's edition to
 * REPORT_EDITIONS switches it on here with no other change.
 */
export function NewerEditionNotice({ slug, month }: { slug: string; month: string }) {
  const latest = latestReport()
  if (!latest || latest.slug === slug) return null
  return (
    <div className="border-b border-brand/30 bg-brand/5">
      <div className="mx-auto w-full max-w-5xl px-6 py-2.5 text-sm text-navy">
        <span className="font-semibold">This is the {month} edition.</span>{' '}
        The latest is {latest.month}: <Link href={reportPath(latest)} className="font-medium underline underline-offset-4">{latest.title}</Link>.
      </div>
    </div>
  )
}
