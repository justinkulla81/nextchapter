import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { loadCapturedEmailsForDays, groupByEmail } from '@/lib/leads/captured-emails'
import { loadLeadStatuses, loadOrigins } from '@/lib/leads/lead-status'
import { lifecycleEmailsOn } from '@/lib/leads/lifecycle/config'
import { SubmitButton } from '@/components/ui/submit-button'
import { sendLifecycleTests } from './actions'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: 'Year' },
]

const TIME_ZONE = 'America/New_York'
const CRM_PERSON = 'https://admin.launchyournextchapter.com/support/admin/crm/people'

function formatDay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TIME_ZONE })
}

// Everyone who gave us an email address on the public site, from every form
// in one list, with what has happened to each since: filed in the CRM, emailed,
// opened, clicked, registered. The forms keep their own tables; this reads them.
export default async function CapturedEmailsPage({ searchParams }: { searchParams: Promise<{ days?: string; tested?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const requested = Number(sp.days)
  const days = RANGES.some((r) => r.days === requested) ? requested : 30

  const rows = await loadCapturedEmailsForDays(days)
  const people = groupByEmail(rows)
  const [statuses, origins] = await Promise.all([
    loadLeadStatuses(people.map((p) => p.email)),
    loadOrigins(people.map((p) => p.ip ?? '')),
  ])

  const perChannel = new Map<string, number>()
  for (const r of rows) perChannel.set(r.channel, (perChannel.get(r.channel) ?? 0) + 1)
  const channels = [...perChannel.entries()].sort((a, b) => b[1] - a[1])

  const count = (pick: (s: NonNullable<ReturnType<typeof statuses.get>>) => boolean) =>
    people.filter((p) => {
      const s = statuses.get(p.email)
      return s ? pick(s) : false
    }).length
  const funnel = [
    ['In the CRM', count((s) => !!s.personId)],
    ['Emailed', count((s) => s.sent > 0)],
    ['Opened', count((s) => s.opened)],
    ['Clicked', count((s) => s.clicked)],
    ['Registered', count((s) => s.registered)],
  ] as const

  const tested = sp.tested != null ? Number(sp.tested) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Captured emails</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every email address given on the public site: journey picker, job alerts, newsletter, contact form, guides,
          résumé submissions and waitlists. One row per address, with what has happened since.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Time range">
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
        {channels.length > 0 && <span className="text-muted-foreground"> ({channels.map(([name, n]) => `${name} ${n}`).join(', ')})</span>}
      </p>

      <p className="text-sm text-muted-foreground">{funnel.map(([label, n]) => `${label} ${n}`).join(' · ')}</p>

      <section className="space-y-2 rounded-md border p-4">
        <h2 className="text-sm font-medium">Welcome and reminder emails</h2>
        <p className="text-sm text-muted-foreground">
          {lifecycleEmailsOn()
            ? 'On: new saved jobs, confirmed job alerts, newsletter signups and waitlist signups get a welcome, then up to two reminders until they make a profile.'
            : 'Off. Nobody is emailed yet. Send the seven test emails to yourself to review the copy, then switch them on.'}
        </p>
        <form action={sendLifecycleTests}>
          <SubmitButton pendingLabel="Sending…">Send me the test emails</SubmitButton>
        </form>
        {tested != null && (
          <p role="status" className="text-sm">
            {tested > 0 ? `Sent ${tested} test emails to your admin address. They are marked [TEST].` : 'No test emails were sent. Check that email sending is configured.'}
          </p>
        )}
      </section>

      {people.length === 0 ? (
        <p className="rounded-md border p-6 text-sm text-muted-foreground">No emails captured in this window. Try a longer range.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-normal">Email</th>
                <th className="px-3 py-2 font-normal">Name</th>
                <th className="px-3 py-2 font-normal">Where</th>
                <th className="px-3 py-2 font-normal">Came from</th>
                <th className="px-3 py-2 font-normal">Journey</th>
                <th className="px-3 py-2 font-normal">Emails</th>
                <th className="px-3 py-2 font-normal">Registered</th>
                <th className="px-3 py-2 font-normal">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const s = statuses.get(p.email)
                return (
                  <tr key={p.email} className="border-t">
                    <td className="px-3 py-2">
                      {s?.personId ? (
                        <a href={`${CRM_PERSON}/${s.personId}`} className="hover:underline">
                          {p.email}
                        </a>
                      ) : (
                        p.email
                      )}
                      {p.unsubscribed && <span className="ml-2 text-xs text-muted-foreground">unsubscribed</span>}
                    </td>
                    <td className="px-3 py-2">{p.name ?? ''}</td>
                    <td className="px-3 py-2">{p.channels.join(', ')}</td>
                    <td className="px-3 py-2">{p.ip ? (origins.get(p.ip) ?? '') : ''}</td>
                    <td className="px-3 py-2">{p.journey ?? ''}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {s && s.sent > 0 ? `${s.sent} sent${s.opened ? ', opened' : ''}${s.clicked ? ', clicked' : ''}` : ''}
                    </td>
                    <td className="px-3 py-2">{s?.registered ? 'Yes' : ''}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatDay(p.lastSeen)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
