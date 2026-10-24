import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Video } from 'lucide-react'
import { getCoachByToken, getCoachClient } from '@/lib/coach/access'
import { loadPrep } from '@/lib/coach/prep/load'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Avatar, Section, TextLink } from '@/components/candidate/ui'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ChangeRow, PrepCard, SharedItem, Unavailable, Why } from '@/components/coach/prep/PrepParts'
import { PrepPrimaryAction, PrepViewed } from '@/components/coach/prep/PrepClient'

export const metadata: Metadata = { title: 'Before you meet' }

// "Before you meet <first name>": the approved session prep (dev-preview mockup coach-session.tsx), on real data.
// First view: this week, what you agreed last time, and three questions. Everything else is behind Show more.
// The notes page lives on another branch; until it lands "Open notes" goes to the log-session form on the client page.
export default async function SessionPrepPage({ params }: { params: Promise<{ token: string; clientId: string }> }) {
  const { token, clientId } = await params
  const coach = await getCoachByToken(token)
  if (!coach) notFound()
  const candidate = await getCoachClient(coach.id, clientId)
  if (!candidate) notFound()

  const { view, primary, firstName, fullName, weekNumber, consented, confidential, meetUrl } = await loadPrep(coach, candidate)
  const clientHref = `/support/coach/clients/${token}/${clientId}`
  const notesHref = `${clientHref}#log-session`
  const place = [candidate.primaryFunction, [candidate.currentCity, candidate.currentState].filter(Boolean).join(', ')].filter(Boolean).join(' · ')

  return (
    <div className="theme-redesign space-y-8">
      <PrepViewed
        properties={{
          coachId: coach.id,
          candidateId: candidate.id,
          consented,
          confidential,
          hasMeetUrl: meetUrl !== null,
          weekSection: view.week.status,
          agreedSection: view.agreed.status,
          marketSection: view.market.status,
          strengthsSection: view.strengths.status,
          questionRules: view.questions.map((q) => q.rule),
        }}
      />
      <p className="text-sm text-muted-foreground">
        <Link href={`/support/coach/clients/${token}`} className="underline underline-offset-4">
          Clients
        </Link>{' '}
        <span aria-hidden>›</span>{' '}
        <Link href={clientHref} className="underline underline-offset-4">
          {fullName}
        </Link>{' '}
        <span aria-hidden>›</span> <span className="text-ink">Before you meet</span>
      </p>

      <PageHeader
        title={view.title}
        intro={view.intro}
        action={<PrepPrimaryAction label={primary.label} hint={primary.hint} meetUrl={primary.meetUrl} notesHref={notesHref} coachId={coach.id} candidateId={candidate.id} />}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
        <div className="space-y-8">
          <Section id="week" title={`Where ${firstName} is this week`}>
            {view.week.status === 'ok' ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  {view.week.data.stats.map((s) => (
                    <PrepCard key={s.label} className="space-y-1">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="font-display text-2xl font-semibold text-ink">{s.value}</p>
                      <p className="text-sm text-muted-foreground">{s.detail}</p>
                    </PrepCard>
                  ))}
                </div>
                <Why>{view.week.data.why}</Why>
                {view.week.data.changes.length > 0 && (
                  <div className="rounded-2xl bg-muted/60 p-5">
                    <p className="mb-2 text-sm font-semibold text-ink">{view.week.data.changesTitle}</p>
                    <ul className="space-y-2">
                      {view.week.data.changes.map((c) => (
                        <ChangeRow key={c.text} change={c} />
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <Unavailable>{view.week.message}</Unavailable>
            )}
          </Section>

          <Section id="last" title="What you agreed last time">
            {view.agreed.status === 'ok' ? (
              <>
                {view.agreed.data.items.length > 0 && (
                  <ul className="divide-y divide-border rounded-2xl border border-border">
                    {view.agreed.data.items.map((item) => (
                      <li key={`${item.owner}-${item.text}`} className="flex items-start gap-3 p-4">
                        <span
                          aria-hidden
                          className={item.status === 'done' ? 'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-success bg-success text-xs text-white' : 'mt-0.5 inline-flex size-5 shrink-0 rounded-full border border-border'}
                        >
                          {item.status === 'done' ? '✓' : ''}
                        </span>
                        <div>
                          <p className="text-base font-semibold text-ink">{item.text}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.owner === 'coach' ? 'Yours' : `${firstName}’s`} · {item.status === 'done' ? 'Done' : 'Open'}
                            {item.dueAt ? ` · due ${item.dueAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Why>{view.agreed.data.why}</Why>
              </>
            ) : (
              <Unavailable>{view.agreed.message}</Unavailable>
            )}
          </Section>

          <Section id="ask" title="Three questions to start with">
            <ol className="space-y-3">
              {view.questions.map((q, i) => (
                <li key={q.rule} className="flex gap-4 rounded-2xl border border-border p-5">
                  <span className="font-display text-2xl font-semibold text-ink/40" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="space-y-1.5">
                    <p className="text-base font-semibold text-ink">{q.text}</p>
                    <Why>{q.reason}</Why>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <ShowMore page="coach_prep" label="Show more" event="coach_prep_show_more_opened" properties={{ coachId: coach.id, candidateId: candidate.id }}>
            <h2 className="font-display text-2xl font-semibold text-ink">Background for the conversation</h2>
            <Section id="market" title={`${firstName}’s market, in plain words`}>
              {view.market.status === 'ok' ? (
                <ul className="space-y-4">
                  {view.market.data.items.map((m) => (
                    <li key={m.headline}>
                      <p className="text-base font-semibold text-ink">{m.headline}</p>
                      <p className="text-sm text-ink">{m.body}</p>
                      <p className="text-xs text-muted-foreground">{m.source}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Unavailable>{view.market.message}</Unavailable>
              )}
            </Section>
            <Section id="strengths" title={`${firstName}’s strengths, from the dossier`}>
              {view.strengths.status === 'ok' ? (
                <>
                  <ul className="space-y-4">
                    {view.strengths.data.items.map((s) => (
                      <li key={s.label}>
                        <p className="text-base font-semibold text-ink">
                          {s.label} <span className="text-sm font-normal text-muted-foreground">· {s.level}</span>
                        </p>
                        <p className="text-sm text-ink">{s.body}</p>
                      </li>
                    ))}
                  </ul>
                  <Why>{view.strengths.data.why}</Why>
                </>
              ) : (
                <Unavailable>{view.strengths.message}</Unavailable>
              )}
            </Section>
          </ShowMore>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start" aria-label={`What ${firstName} shares`}>
          <PrepCard className="space-y-2">
            <div className="flex items-center gap-3">
              <Avatar name={fullName} size="sm" />
              <p className="text-base font-semibold text-ink">{fullName}</p>
            </div>
            <p className="text-sm text-muted-foreground">{[weekNumber !== null ? `Week ${weekNumber} of their search` : null, place || null].filter(Boolean).join(' · ') || 'Search details not shared yet'}</p>
          </PrepCard>
          <PrepCard>
            <h2 className="font-display text-lg font-semibold text-ink">What {firstName} shares with you</h2>
            <ul className="mt-2 divide-y divide-border">
              {view.shares.map((row) => (
                <SharedItem key={row.label} row={row} />
              ))}
            </ul>
            <div className="mt-3">
              <TextLink href={`${clientHref}/full`}>Open the full client profile</TextLink>
            </div>
          </PrepCard>
          {meetUrl && (
            <PrepCard className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Video className="size-5 text-ink/70" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-ink">Meet link ready</p>
                  <p className="text-xs text-muted-foreground">Added when {firstName} booked</p>
                </div>
              </div>
              <TextLink href="/support/coach/booking">Manage</TextLink>
            </PrepCard>
          )}
        </aside>
      </div>
    </div>
  )
}
