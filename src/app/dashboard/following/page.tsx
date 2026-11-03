import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { loadFollowedCompanies } from '@/lib/following/load'
import { parseSort, sortFollowRows, type FollowGroup, type FollowRow, type FollowSort } from '@/lib/following/build'
import { myConferences } from '@/lib/conferences/queries'
import { USER_STATUSES, USER_STATUS_LABEL, type UserStatus } from '@/lib/conferences/constants'
import { whenLabel, whereLabel } from '@/lib/events/format'
import type { ConferenceRow } from '@/lib/events/types'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { Chip, SecondaryButton } from '@/components/candidate/ui'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { EmailTopicToggles } from '@/components/candidates/EmailTopicToggles'
import { StatusSelect } from '@/components/conferences/StatusSelect'
import { FollowCompanyForm } from '@/components/following/FollowCompanyForm'
import { SuggestionActions } from '@/components/following/SuggestionActions'
import { UnfollowButton } from '@/components/following/UnfollowButton'
import { setStatusAction } from '@/app/dashboard/conferences/actions'
import { EMAIL_TOPICS, type EmailTopicField } from '@/lib/constants/notifications'

export const metadata: Metadata = { title: 'What you follow' }

type Tab = 'companies' | 'events' | 'emails'
const TABS: { key: Tab; label: string }[] = [{ key: 'companies', label: 'Companies' }, { key: 'events', label: 'Events' }, { key: 'emails', label: 'Email updates' }]
const SORTS: { key: FollowSort; label: string }[] = [{ key: 'attention', label: 'Needs attention first' }, { key: 'newest', label: 'Newest follow' }, { key: 'az', label: 'A to Z' }]
const GROUP_TITLE: Record<FollowGroup, string> = { attention: 'Needs your attention', hiring: 'Hiring in your field', quiet: 'Quiet for now' }

const parseTab = (v: string | undefined): Tab => (v === 'events' || v === 'emails' ? v : 'companies')

export default async function FollowingPage({ searchParams }: { searchParams: Promise<{ tab?: string; sort?: string }> }) {
  const params = await searchParams
  const tab = parseTab(params.tab)
  const sort = parseSort(params.sort)
  const profile = await getDashboardProfile()
  const [companyCount, eventCount] = await Promise.all([
    prisma.companyWatchlistEntry.count({ where: { candidateId: profile.id } }),
    prisma.userConference.count({ where: { candidateId: profile.id } }).catch(() => 0),
  ])
  after(() => captureServerEvent(profile.id, 'following_viewed', { tab, sort, companies: companyCount, events: eventCount }))
  const counts: Record<Tab, number | null> = { companies: companyCount, events: eventCount, emails: null }

  return (
    <div className="space-y-6">
      <PageHeader title="What you follow" intro="Companies, events and emails in one place, with the ones that need you on top." />
      <nav aria-label="What you follow" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <TrackedLink
            key={t.key}
            href={t.key === 'companies' ? '/dashboard/following' : `/dashboard/following?tab=${t.key}`}
            event="following_tab_clicked"
            properties={{ tab: t.key }}
            className={t.key === tab ? 'rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white' : 'rounded-full border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-muted'}
          >
            {t.label}{counts[t.key] != null && <span className="opacity-70"> {counts[t.key]}</span>}
          </TrackedLink>
        ))}
      </nav>
      {tab === 'companies' && <CompaniesTab candidateId={profile.id} sort={sort} />}
      {tab === 'events' && <EventsTab candidateId={profile.id} />}
      {tab === 'emails' && <EmailsTab candidateId={profile.id} />}
    </div>
  )
}

function RowView({ row }: { row: FollowRow }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-base font-semibold text-ink">{row.name} <Chip tone={row.tone}>{row.verdict}</Chip></p>
        <p className="text-sm text-ink">{row.reason}</p>
        <p className="text-sm text-muted-foreground">{row.fact}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <TrackedLink
          href={row.primary.href}
          event="following_company_opened"
          properties={{ company: row.name, group: row.group }}
          className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted"
        >
          {row.primary.label}
        </TrackedLink>
        <UnfollowButton company={row.name} entryId={row.entryId} />
      </div>
    </li>
  )
}

async function CompaniesTab({ candidateId, sort }: { candidateId: string; sort: FollowSort }) {
  const { rows, suggestions, profileThin } = await loadFollowedCompanies(candidateId)
  const sorted = sortFollowRows(rows, sort)
  // Grouped only in the default order; the other two orders are one flat list.
  const sections: { key: string; title: string | null; rows: FollowRow[]; collapsed?: boolean }[] =
    sort === 'attention'
      ? (['attention', 'hiring', 'quiet'] as FollowGroup[]).map((g) => ({ key: g, title: GROUP_TITLE[g], rows: sorted.filter((r) => r.group === g), collapsed: g === 'quiet' })).filter((s) => s.rows.length > 0)
      : [{ key: 'all', title: null, rows: sorted }]
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Sort companies" className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <TrackedLink
              key={s.key}
              href={s.key === 'attention' ? '/dashboard/following' : `/dashboard/following?sort=${s.key}`}
              event="following_sorted"
              properties={{ sort: s.key }}
              className={s.key === sort ? 'rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-ink' : 'rounded-lg border border-border px-3 py-2 text-sm text-ink hover:bg-muted'}
            >
              {s.label}
            </TrackedLink>
          ))}
        </div>
        <FollowCompanyForm />
      </div>

      {rows.length === 0 ? (
        <EmptyCard
          title="You do not follow any companies yet"
          why="Follow a company and we tell you here when it posts roles that fit you or files a layoff notice."
        />
      ) : (
        sections.map((s) =>
          s.collapsed ? (
            <details key={s.key} className="rounded-2xl border border-border">
              <summary className="cursor-pointer p-4 text-sm font-semibold text-ink">{s.title} ({s.rows.length})</summary>
              <ul className="divide-y divide-border border-t border-border">{s.rows.map((r) => <RowView key={r.entryId} row={r} />)}</ul>
            </details>
          ) : (
            <section key={s.key} aria-label={s.title ?? 'Companies you follow'} className="space-y-2">
              {s.title && <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{s.title}</h2>}
              <ul className="divide-y divide-border rounded-2xl border border-border">{s.rows.map((r) => <RowView key={r.entryId} row={r} />)}</ul>
            </section>
          )
        )
      )}

      <section aria-label="Companies we think fit you" className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">We think these fit you</h2>
        {suggestions.length > 0 ? (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {suggestions.map((s) => (
              <li key={s.companyId} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0 space-y-0.5">
                  <Link href={s.href} className="text-base font-semibold text-ink underline-offset-4 hover:underline">{s.name}</Link>
                  <p className="text-sm text-ink"><span className="font-semibold">Why:</span> {s.reason}</p>
                  {s.fact && <p className="text-sm text-muted-foreground">{s.fact}</p>}
                </div>
                <SuggestionActions companyId={s.companyId} name={s.name} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyCard
            title="No suggestions yet"
            why={profileThin ? 'We pick companies from your city, field and industry. Fill those in and we start suggesting.' : 'Nothing new fits you right now. We look again as hiring changes.'}
            action={profileThin ? <SecondaryButton href="/dashboard/improve">Improve your search</SecondaryButton> : undefined}
          />
        )}
      </section>
      <p className="text-sm text-muted-foreground">Suggestions come from your résumé and the city, field and industries you chose.</p>
    </div>
  )
}

async function EventsTab({ candidateId }: { candidateId: string }) {
  const mine = await myConferences(candidateId).catch(() => [])
  if (mine.length === 0) {
    return (
      <EmptyCard
        title="You do not follow any events yet"
        why="Save a conference and we tell you when its dates and speaker calls are announced."
        action={<SecondaryButton href="/dashboard/network/events">See events that fit you</SecondaryButton>}
      />
    )
  }
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {mine.map(({ uc, series }) => (
          <li key={uc.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="min-w-0 space-y-0.5">
              <Link href={`/dashboard/conferences/${series.id}`} className="text-base font-semibold text-ink underline-offset-4 hover:underline">{series.name}</Link>
              <p className="text-sm text-ink">{USER_STATUS_LABEL[uc.status as UserStatus] ?? uc.status} · {whenLabel(series as ConferenceRow)}{whereLabel(series as ConferenceRow) ? ` · ${whereLabel(series as ConferenceRow)}` : ''}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {series.datesConfirmed && series.startDate && (
                <TrackedLink href={`/dashboard/conferences/calendar?id=${encodeURIComponent(series.id)}`} event="following_event_calendar_clicked" properties={{ seriesId: series.id }} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">
                  Add to my calendar
                </TrackedLink>
              )}
              <StatusSelect
                action={setStatusAction} hidden={{ seriesId: series.id }} value={uc.status} label={`Status for ${series.name}`} none="Stop following" event="user_conference_status_changed"
                options={USER_STATUSES.map((s) => ({ value: s, label: USER_STATUS_LABEL[s as UserStatus] }))}
              />
            </div>
          </li>
        ))}
      </ul>
      <SecondaryButton href="/dashboard/conferences">Find or add a conference</SecondaryButton>
    </div>
  )
}

async function EmailsTab({ candidateId }: { candidateId: string }) {
  const p = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { weeklyReportOptedOut: true, marketDigestOptedOut: true, dailyEmailOptedOut: true, jobSearchDailyOptedOut: true } })
  const optedOut = Object.fromEntries(EMAIL_TOPICS.map((t) => [t.field, p?.[t.field] ?? false])) as Record<EmailTopicField, boolean>
  return (
    <div className="space-y-4">
      <EmailTopicToggles optedOut={optedOut} intro="Untick anything you do not want." />
      <p className="text-sm text-muted-foreground">How many emails you get overall is set under Account and privacy.</p>
    </div>
  )
}
