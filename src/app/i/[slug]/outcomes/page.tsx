import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { institutionEntitlements } from '@/lib/plans/entitlements'
import { prisma } from '@/lib/prisma'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { outcomesByMajor, outcomesReport } from '@/lib/higher-ed/outcomes-report'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { PrintButton } from '@/components/higher-ed/PrintButton'

async function load(slug: string) {
  return prisma.institution.findUnique({ where: { slug }, select: { id: true, name: true, programBrandName: true, logoUrl: true, accentColor: true, isDemo: true, plan: true } })
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const inst = await load((await params).slug)
  if (!inst) return {}
  return { title: `${inst.name} career outcomes`, description: `How ${inst.name} alumni land their next role, counted from alumni who chose to share.`, robots: inst.isDemo ? { index: false, follow: false } : undefined }
}

const pct = (x: number | null) => (x === null ? null : `${Math.round(x * 100)}%`)
const money = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }))

// The public Career Outcomes report: a page for the college's website and
// admissions, printable as a PDF. Counts only; anything under MIN_CELL_SIZE
// is withheld rather than shown.
export default async function OutcomesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const inst = await load(slug)
  // The public outcomes report is part of reporting, which the free plan does not include.
  if (!inst || !institutionEntitlements({ plan: inst.plan }).reporting) notFound()
  const [r, majors] = await Promise.all([outcomesReport(inst.id), outcomesByMajor(inst.id)])
  const accent = inst.accentColor ?? '#2e7d5b'
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const stats = [
    { label: 'Alumni using the program', value: r.joined?.toLocaleString() },
    { label: 'Landed a new role', value: r.landed?.toLocaleString() },
    { label: 'Median days from search to offer', value: r.medianDaysToLand?.toString() },
    { label: `Said ${inst.name} helped`, value: pct(r.helpedShare) },
    { label: 'Promoted to VP or above', value: r.promotions?.toLocaleString() },
    { label: 'Certificates and programs completed', value: r.programsCompleted?.toLocaleString() },
    { label: 'Calls alumni mentors took', value: r.mentorCalls?.toLocaleString() },
  ].filter((s) => s.value)
  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent) }}>
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
            <p className="font-semibold">{inst.name}</p>
          </div>
          <PrintButton />
        </div>
        <section className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Career outcomes</h1>
          <p className="text-muted-foreground">
            {fmt(r.from)} to {fmt(r.to)}. Every {inst.name} alum can use {inst.programBrandName ?? 'the program'} for any career move: a new job, a promotion, a career change, a layoff. These are counts from
            alumni who chose to share; numbers under {MIN_CELL_SIZE} are left out.
          </p>
        </section>
        {stats.length ? (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-4">
                <dd className="text-3xl font-semibold tabular-nums">{s.value}</dd>
                <dt className="mt-1 text-sm text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Too early to report: numbers appear once enough alumni share.</p>
        )}
        {r.topEmployers.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Where alumni landed</h2>
            <p className="text-sm text-muted-foreground">Employers that hired at least {MIN_CELL_SIZE} alumni who share where they work.</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {r.topEmployers.map((e) => (
                <li key={e.employer} className="flex justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span>{e.employer}</span>
                  <span className="tabular-nums text-muted-foreground">{e.n}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {majors.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">What graduates do, by major</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {majors.slice(0, 8).map((m) => (
                <div key={m.major} className="rounded-lg border border-border p-4 text-sm">
                  <p className="font-medium">{m.major}</p>
                  {m.employers.length > 0 && <p className="mt-1 text-muted-foreground">At {m.employers.slice(0, 4).map((e) => e.employer).join(', ')}</p>}
                  {m.titles.length > 0 && <p className="mt-1 text-muted-foreground">As {m.titles.slice(0, 3).map((t) => t.title.toLowerCase()).join(', ')}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
        {r.peers && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">How {inst.name} compares</h2>
            <p className="text-sm text-muted-foreground">
              Against {r.peers.peers.length} {r.peers.peerScope}. Federal College Scorecard and IPEDS data.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {r.peers.metrics.map((m) => (
                <li key={m.key} className="rounded-lg border border-border p-3 text-sm">
                  <span className="font-medium">{m.label}:</span> {m.format === 'percent' ? pct(m.value) : money(m.value)}
                  {m.rank && <span className="text-muted-foreground"> · #{m.rank} of {m.of}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-xs text-muted-foreground">powered by NextChapter</p>
      </main>
    </div>
  )
}
