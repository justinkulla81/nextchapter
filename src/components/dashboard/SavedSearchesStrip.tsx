import { TrackedLink } from '@/components/marketing/TrackedLink'
import { prisma } from '@/lib/prisma'
import { searchLabel } from '@/lib/leads/job-alerts'

// Searches the member saved on the public /jobs page before signing up, found by the email they used.
// Each opens the job board with that search. Renders nothing when there are none.
export async function SavedSearchesStrip({ email }: { email: string | null }) {
  if (!email) return null
  const rows = await prisma.homepageLead
    .findMany({
      where: { email: email.toLowerCase(), kind: 'job_alert', unsubscribedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, searchQ: true, searchLoc: true, searchRemote: true, confirmedAt: true },
    })
    .catch(() => [])
  if (rows.length === 0) return null

  return (
    <section aria-labelledby="saved-searches-heading" className="text-sm">
      <h2 id="saved-searches-heading" className="font-semibold">Your saved searches</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {rows.map((r) => {
          const params = new URLSearchParams()
          if (r.searchQ) params.set('q', r.searchQ)
          if (r.searchLoc) params.set('loc', r.searchLoc)
          if (r.searchRemote) params.set('remote', 'remote')
          const qs = params.toString()
          return (
            <li key={r.id}>
              <TrackedLink
                href={`/dashboard/find-my-job${qs ? `?${qs}` : ''}`}
                event="saved_search_opened"
                properties={{ leadId: r.id, q: r.searchQ, loc: r.searchLoc, remote: r.searchRemote, alertsOn: !!r.confirmedAt }}
                className="inline-block rounded-full border border-border px-3 py-1 hover:bg-muted"
              >
                {searchLabel(r)}
                {r.confirmedAt ? ' · alerts on' : ''}
              </TrackedLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
