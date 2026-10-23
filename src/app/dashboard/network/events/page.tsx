import type { Metadata } from 'next'
import { Suspense } from 'react'
import { after } from 'next/server'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { eventsFor } from '@/lib/events/member'
import { pendingCheckIns } from '@/lib/events/store'
import { recordEventOutcome } from './actions'
import { SENIORITIES, type Seniority } from '@/lib/events/types'
import type { EventFilters as Filters } from '@/lib/events/match'
import { captureServerEvent } from '@/lib/posthog/server'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { PageHeader } from '@/components/candidate/PageHeader'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { EventFilters } from '@/components/dashboard/EventFilters'
import { EventList } from '@/components/dashboard/EventList'

export const metadata: Metadata = { title: 'Events to attend' }

const WAYS = ['cheap', 'speak', 'invite'] as const

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ function?: string; industry?: string; level?: string; way?: string; q?: string }> }) {
  const sp = await searchParams
  const profile = await getDashboardData()
  const filters: Filters = {
    function: (PRIMARY_FUNCTION_OPTIONS as readonly string[]).includes(sp.function ?? '') ? sp.function : undefined,
    industry: INDUSTRY_BUCKET_NAMES.includes(sp.industry ?? '') ? sp.industry : undefined,
    seniority: (SENIORITIES as readonly string[]).includes(sp.level ?? '') ? (sp.level as Seniority) : undefined,
    q: sp.q?.trim().slice(0, 60) || undefined,
    way: (WAYS as readonly string[]).includes(sp.way ?? '') ? (sp.way as Filters['way']) : undefined,
  }
  const r = await eventsFor(profile, filters)
  const checkIns = await pendingCheckIns(profile.id).catch(() => [])
  after(() =>
    captureServerEvent(profile.id, 'conference_events_viewed', {
      shown: r.matches.length,
      total: r.total,
      ...filters,
      hasFunction: r.facts.functions.length > 0,
      hasIndustry: r.facts.industries.length > 0,
    }),
  )
  const filtered = Object.values(filters).some(Boolean)

  return (
    <div className="space-y-8">
      <PageHeader
        title={r.matches.length > 0 ? `${r.matches.length} events worth your time` : 'Events worth your time'}
        intro="Conferences and trade shows where people in your field hire, introduce and speak, best fit first. Each one says what it costs and how to get in cheaper, to speak, or by invitation."
      />
      {checkIns.length > 0 && (
        <section className="space-y-3 rounded-2xl bg-muted p-5" aria-label="How did it go?">
          <p className="font-semibold text-ink">How did it go?</p>
          {checkIns.map((c) => (
            <div key={c.eventId} className="flex flex-wrap items-center gap-2 text-sm text-ink">
              <span className="mr-2">{c.name}</span>
              {([['ATTENDED', 'I went'], ['SPOKE', 'I spoke'], ['DID_NOT_GO', 'I did not go']] as const).map(([o, label]) => (
                <form key={o} action={recordEventOutcome}>
                  <input type="hidden" name="eventId" value={c.eventId} />
                  <input type="hidden" name="outcome" value={o} />
                  <button type="submit" className="inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-muted">{label}</button>
                </form>
              ))}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Why we ask: if you went or spoke, we tell you when next year&apos;s dates are announced, early enough to ask about speaking and to book.</p>
        </section>
      )}
      <Suspense fallback={null}>
        <EventFilters functions={[...PRIMARY_FUNCTION_OPTIONS].filter((f) => f !== 'General' && f !== 'Other')} industries={INDUSTRY_BUCKET_NAMES.filter((i) => i !== 'Other')} />
      </Suspense>
      {r.matches.length > 0 ? (
        <EventList matches={r.matches} interests={r.interests} firstName={profile.firstName} />
      ) : (
        <EmptyCard
          title={filtered ? 'Nothing matches those filters' : 'Events are being added'}
          why={filtered ? 'Clear a filter to see more. Events with no field listed fit everyone and always show.' : 'We are checking each event on its own site before it appears here, so every cost and date you see is real.'}
        />
      )}
    </div>
  )
}
