import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { computeFunnel, type FunnelStage, type FunnelWindowDays } from '@/lib/admin/funnel'
import { computeClaimFunnel } from '@/lib/admin/claim-funnel'
import { ClaimFunnel } from '@/components/admin/ClaimFunnel'

export const metadata = { title: 'Funnel' }
export const maxDuration = 30

const WINDOWS: FunnelWindowDays[] = [7, 30, 90]

function parseWindow(raw: string | undefined): FunnelWindowDays {
  const n = Number(raw)
  return (WINDOWS as number[]).includes(n) ? (n as FunnelWindowDays) : 30
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return '–'
  const p = (part / whole) * 100
  return `${p >= 10 ? Math.round(p) : p.toFixed(1)}%`
}

// One bar per step, width relative to the first step of its band. Each row shows the step's
// share of the previous step (where people drop) and of the top of the band (the overall rate).
function Band({ title, note, stages }: { title: string; note: string; stages: FunnelStage[] }) {
  const top = stages[0]?.count ?? 0
  // The steepest loss between two steps, so the eye lands on the leak.
  let worstIndex = -1
  let worstKeep = 1
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1].count
    if (prev <= 0) continue
    const keep = stages[i].count / prev
    if (keep < worstKeep) {
      worstKeep = keep
      worstIndex = i
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      </div>
      <ol className="space-y-2">
        {stages.map((s, i) => {
          const width = top > 0 ? Math.max((s.count / top) * 100, s.count > 0 ? 1.5 : 0) : 0
          const prev = i > 0 ? stages[i - 1].count : null
          const isLeak = i === worstIndex
          return (
            <li key={s.key} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-medium">{s.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{s.definition}</span>
                </div>
                <div className="text-right tabular-nums">
                  <span className="text-lg font-semibold">{s.count.toLocaleString('en-US')}</span>
                  {i > 0 && (
                    <span className="ml-3 text-sm text-muted-foreground">
                      {pct(s.count, prev ?? 0)} of previous · {pct(s.count, top)} of top
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className={`h-full rounded-full ${isLeak ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${width}%` }}
                />
              </div>
              {isLeak && (
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                  Biggest drop in this band: only {pct(s.count, prev ?? 0)} of the previous step got here.
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default async function AdminFunnelPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin()
  const { days } = await searchParams
  const windowDays = parseWindow(days)
  const [data, claims] = await Promise.all([computeFunnel(windowDays), computeClaimFunnel(new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000))])

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Funnel</h1>
          <p className="mt-1 text-muted-foreground">
            From a visit to a job: traffic, email and journey, registration, onboarding, résumé, activation,
            engagement, Candidate+ and hired. Since {data.since.toLocaleDateString('en-US', { timeZone: 'America/New_York' })}.
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Time window">
          {WINDOWS.map((w) => (
            <Link
              key={w}
              href={`/support/admin/funnel?days=${w}`}
              aria-current={w === windowDays ? 'true' : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                w === windowDays ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              Last {w} days
            </Link>
          ))}
        </div>
      </div>

      <Band
        title="1 · Traffic to email"
        note="Anonymous visitors, counted once per IP (human traffic only). Visitors carry no account until they register, so this band and the next one are not the same people followed through."
        stages={data.traffic}
      />

      <Band
        title="2 · Members, from signup to hired"
        note="Everyone whose profile was created in this window, followed to today. A step means reached at any time, so recent signups have had less time to get to the later steps."
        stages={data.members}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Offers compared</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every way in, side by side: people who reached it, what they gave, and the rate. Sorted by rate. A row with
            very few people reached is noise; read the count before the percentage.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-1 font-normal">Offer</th>
              <th className="pb-1 text-right font-normal">Reached</th>
              <th className="pb-1 text-right font-normal">Gave</th>
              <th className="pb-1 text-right font-normal">Rate</th>
              <th className="pb-1 text-right font-normal">Later registered</th>
            </tr>
          </thead>
          <tbody>
            {[...data.offers]
              .sort((a, b) => (b.reached ? b.captured / b.reached : -1) - (a.reached ? a.captured / a.reached : -1))
              .map((o) => (
                <tr key={o.key} className="border-t align-top">
                  <td className="py-1.5">
                    <div className="font-medium">{o.label}</div>
                    <div className="text-xs text-muted-foreground">{o.where} · gave = {o.capturedMeans}</div>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{o.reached.toLocaleString('en-US')}</td>
                  <td className="py-1.5 text-right tabular-nums">{o.captured.toLocaleString('en-US')}</td>
                  <td className="py-1.5 text-right tabular-nums">{pct(o.captured, o.reached)}</td>
                  <td className="py-1.5 text-right tabular-nums">{o.becameMembers === null ? '–' : o.becameMembers}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">3 · Organizations (B2B)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visitors to each audience&apos;s pages, and who raised a hand. These are different people from the candidate band, so they are not part
            of the funnel above. A very small count of visitors makes the rate noise; read the counts first.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-1 font-normal">Audience</th>
              <th className="pb-1 text-right font-normal">Visitors</th>
              <th className="pb-1 text-right font-normal">Raised a hand</th>
              <th className="pb-1 text-right font-normal">Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.b2b.map((r) => (
              <tr key={r.key} className="border-t align-top">
                <td className="py-1.5">
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground">{r.where} · counts = {r.counts}</div>
                </td>
                <td className="py-1.5 text-right tabular-nums">{r.reached.toLocaleString('en-US')}</td>
                <td className="py-1.5 text-right tabular-nums">{r.raisedHand.toLocaleString('en-US')}</td>
                <td className="py-1.5 text-right tabular-nums">{pct(r.raisedHand, r.reached)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ClaimFunnel data={claims} />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Where emails come from
        </h2>
        {data.leadsBySource.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No emails or journeys captured in this window. Try a longer window.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <table className="w-full text-sm">
              <caption className="pb-1 text-left text-xs text-muted-foreground">By box</caption>
              <tbody>
                {data.leadsBySource.map((s) => (
                  <tr key={s.source} className="border-t">
                    <td className="py-1.5">{s.source}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.count.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full text-sm">
              <caption className="pb-1 text-left text-xs text-muted-foreground">By kind</caption>
              <tbody>
                {data.leadsByKind.map((k) => (
                  <tr key={k.kind} className="border-t">
                    <td className="py-1.5">{k.kind === 'journey' ? 'Journey (plan email)' : k.kind === 'job_alert' ? 'Saved search (job alert)' : k.kind}</td>
                    <td className="py-1.5 text-right tabular-nums">{k.count.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            First page people land on
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The first page each visitor saw in the window. “Emails from this box” is shown only for the home page, /jobs
            and /start, the three pages whose box maps one-to-one to a page.
          </p>
        </div>
        {data.landing.length === 0 ? (
          <p className="text-sm text-muted-foreground">No page views recorded in this window.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-1 font-normal">Page</th>
                <th className="pb-1 text-right font-normal">Visitors</th>
                <th className="pb-1 text-right font-normal">Emails from this box</th>
                <th className="pb-1 text-right font-normal">Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.landing.map((l) => (
                <tr key={l.path} className="border-t">
                  <td className="py-1.5">{l.path}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.visitors.toLocaleString('en-US')}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.leadsSameSource || '–'}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.leadsSameSource ? pct(l.leadsSameSource, l.visitors) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
