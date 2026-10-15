import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isNcAdmin } from '@/lib/higher-ed/resolve'
import { canSeeSystem, systemDashboard } from '@/lib/higher-ed/systems'
import { captureServerEvent } from '@/lib/posthog/server'

export const metadata = { title: 'System dashboard' }

const n = (x: number | null) => (x === null ? '<5' : x.toLocaleString())
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)

// One license over several campuses: the same counts per campus, side by
// side. Read-only; each campus runs its own portal. Counts under five show
// as "<5" so no one is identifiable.
export default async function SystemDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/auth/login?next=/systems/${slug}`)
  const systemId = await canSeeSystem(slug, user.email ?? null, await isNcAdmin(user.id, user.email ?? null))
  if (!systemId) notFound()
  const d = await systemDashboard(systemId)
  captureServerEvent(user.id, 'he_system_dashboard_viewed', { systemSlug: slug, campuses: d.campuses.length })
  const cols = [
    ['Alumni on roster', (c: (typeof d.campuses)[number]) => c.members.toLocaleString()],
    ['Joined', (c: (typeof d.campuses)[number]) => c.joined.toLocaleString()],
    ['Participation', (c: (typeof d.campuses)[number]) => pct(c.participation)],
    ['Landed (12 mo)', (c: (typeof d.campuses)[number]) => n(c.landed)],
    ['In transition', (c: (typeof d.campuses)[number]) => n(c.inTransition)],
    ['Program completions', (c: (typeof d.campuses)[number]) => n(c.completions)],
    ['Mentor calls', (c: (typeof d.campuses)[number]) => n(c.mentorCalls)],
    ['Event attendance', (c: (typeof d.campuses)[number]) => n(c.eventAttendance)],
  ] as const
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{d.name}</h1>
        <p className="text-sm text-muted-foreground">
          {d.campuses.length} campuses · {d.totals.members.toLocaleString()} alumni on rosters · {pct(d.totals.participation)} joined. Last 12 months. Counts under five show as &lt;5.
        </p>
      </div>
      {d.campuses.length ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-3 font-medium">Campus</th>
                {cols.map(([h]) => (
                  <th key={h} scope="col" className="p-3 text-right font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.campuses.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <th scope="row" className="p-3 text-left font-medium">
                    <Link className="hover:underline" href={`/i/${c.slug}`}>{c.name}</Link>
                  </th>
                  {cols.map(([h, f]) => (
                    <td key={h} className="p-3 text-right tabular-nums">{f(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No campuses are in this system yet. NextChapter adds them.</p>
      )}
      <p className="text-xs text-muted-foreground">Campus names open that campus’s own portal, if you have a seat there.</p>
    </main>
  )
}
