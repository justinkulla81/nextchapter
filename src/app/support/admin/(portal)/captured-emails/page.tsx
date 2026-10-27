import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { loadCapturedEmails, groupByEmail } from '@/lib/leads/captured-emails'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: 'Year' },
]

const DAY_MS = 24 * 60 * 60 * 1000
const TIME_ZONE = 'America/New_York'

function formatDay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TIME_ZONE })
}

// Everyone who gave us an email address on the public site, from every form
// in one list. The forms keep their own tables; this only reads them.
export default async function CapturedEmailsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const requested = Number(sp.days)
  const days = RANGES.some((r) => r.days === requested) ? requested : 30

  const rows = await loadCapturedEmails(new Date(Date.now() - days * DAY_MS))
  const people = groupByEmail(rows)

  const perChannel = new Map<string, number>()
  for (const r of rows) perChannel.set(r.channel, (perChannel.get(r.channel) ?? 0) + 1)
  const channels = [...perChannel.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Captured emails</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every email address given on the public site: journey picker, job alerts, newsletter, contact form, guides,
          résumé submissions and waitlists. One row per address.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <Link
            key={r.days}
            href={`/support/admin/captured-emails?days=${r.days}`}
            aria-current={r.days === days ? 'true' : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              r.days === days ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <p className="text-sm">
        <span className="font-medium">{people.length}</span> addresses in the last {days} days
        {channels.length > 0 && (
          <span className="text-muted-foreground">
            {' '}
            ({channels.map(([name, n]) => `${name} ${n}`).join(', ')})
          </span>
        )}
      </p>

      {people.length === 0 ? (
        <p className="rounded-md border p-6 text-sm text-muted-foreground">
          No emails captured in this window. Try a longer range.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-normal">Email</th>
                <th className="px-3 py-2 font-normal">Name</th>
                <th className="px-3 py-2 font-normal">Where</th>
                <th className="px-3 py-2 font-normal">Last seen</th>
                <th className="px-3 py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.email} className="border-t">
                  <td className="px-3 py-2">
                    <a href={`mailto:${p.email}`} className="hover:underline">
                      {p.email}
                    </a>
                  </td>
                  <td className="px-3 py-2">{p.name ?? ''}</td>
                  <td className="px-3 py-2">{p.channels.join(', ')}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatDay(p.lastSeen)}</td>
                  <td className="px-3 py-2">{p.unsubscribed ? 'Unsubscribed' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
