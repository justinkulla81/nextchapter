import type { Metadata } from 'next'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { donorReport } from '@/lib/higher-ed/fund'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { PrintButton } from '@/components/higher-ed/PrintButton'

export const metadata: Metadata = { title: 'Resilience Fund report', robots: { index: false, follow: false } }

const usd = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

// The donor report (spec §5.3): one printable page, counts only. "Save as
// PDF" from the print dialog is the PDF.
export default async function FundReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireWorkspace(slug, 'development')
  const r = await donorReport(ctx.institution.id)
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const stats = [
    { label: 'Raised', value: r.fund ? usd(r.fund.raisedCents) : '—', note: r.fund?.goalCents ? `of a ${usd(r.fund.goalCents)} goal` : null },
    { label: 'Alumni funded', value: r.awards.toLocaleString(), note: `${usd(r.awardedCents)} in coaching and seats` },
    { label: 'Back at work since their award', value: r.placed.toLocaleString(), note: null },
    { label: 'Chose to share their story', value: r.sharedStories.toLocaleString(), note: null },
  ]
  return (
    <main className="mx-auto max-w-2xl space-y-8 bg-background px-6 py-10 print:py-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <InstitutionMark name={ctx.institution.name} logoUrl={ctx.institution.logoUrl} />
          <p className="font-semibold">{ctx.institution.name}</p>
        </div>
        <PrintButton />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{r.fund?.name ?? 'Resilience Fund'}</h1>
        {r.fund?.description && <p className="mt-1 text-muted-foreground">{r.fund.description}</p>}
        <p className="mt-1 text-sm text-muted-foreground">Report as of {today}</p>
      </div>
      <dl className="grid grid-cols-2 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border p-4">
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</dd>
            {s.note && <dd className="mt-1 text-xs text-muted-foreground">{s.note}</dd>}
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        Every number here is a count. Alumni decide for themselves whether to share their story; no one&apos;s search details are in this report.
      </p>
      <p className="text-xs text-muted-foreground">powered by NextChapter</p>
    </main>
  )
}
