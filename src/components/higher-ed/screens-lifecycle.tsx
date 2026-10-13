// The college at every stage of an alum's move. Candidate: the stage panel
// on home, and the Network tab (intros, office hours, events, groups,
// milestones, what grads with my major do). Staff: events, segments,
// milestones, the board report. Workforce: ETPL helper and rapid response.

import Link from 'next/link'
import { ArrowRight, CalendarDays, Clock, Landmark, Megaphone, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { effectiveStage, getStage } from '@/lib/journey/journey'
import {
  alumniAtCompany,
  companiesWithAlumni,
  eventsForStaff,
  EVENT_KINDS,
  groupView,
  listMilestones,
  myAlumniIntros,
  myGroups,
  myOfficeHours,
  openOfficeHours,
  programRecommendations,
  stageHelp,
  upcomingEvents,
} from '@/lib/higher-ed/lifecycle'
import { outcomesByMajor, boardDashboard } from '@/lib/higher-ed/outcomes-report'
import { listSegments, segmentOptions } from '@/lib/higher-ed/segments'
import { etplMissing, etplRows, listPrograms } from '@/lib/higher-ed/programs'
import { listRapidResponses, regionNotices } from '@/lib/higher-ed/rapid-response'
import { deleteSegmentAction, cancelEvent, toggleRapidResponse } from '@/app/i/[slug]/(portal)/lifecycle-actions'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { StatTile } from './StatTile'
import { ConfirmActionButton } from './ConfirmActionButton'
import { AnswerIntro, AskIntro, BookSlot, CancelSlot, CheckInToggle, EventForm, OfficeHoursForm, RapidResponseForm, RsvpButton, SegmentForm } from './LifecycleForms'
import { PrintButton } from './PrintButton'

type Props = { ctx: WorkspaceContext; base: string; searchParams?: { q?: string; group?: string } }

const TZ = 'America/New_York'
const when = (d: Date) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(new Date(d))
const day = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d))
const yr = (y: number | null) => (y ? ` ’${String(y).slice(2)}` : '')
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)
const kindLabel = (k: string) => EVENT_KINDS.find((e) => e.key === k)?.label ?? k

// ── Candidate home: what the college offers at your stage ───────────────────

export async function StagePanel({ ctx }: { ctx: WorkspaceContext }) {
  if (!ctx.memberId) return null
  const m = await prisma.institutionMember.findUnique({ where: { id: ctx.memberId }, select: { candidateId: true, candidate: { select: { journey: true, journeyStage: true, currentJobStatus: true } } } })
  const stage = m?.candidate ? effectiveStage(m.candidate) : null
  if (stage === 'PAUSED') return null
  const id = ctx.institution.id
  const now = new Date()
  const [programs, slots, events, jobs, recs] = await Promise.all([
    prisma.cohort.count({ where: { program: { institutionId: id, isActive: true }, startsAt: { gte: now } } }),
    prisma.officeHourSlot.count({ where: { institutionId: id, startsAt: { gte: now }, bookedByMemberId: null, cancelledAt: null } }),
    prisma.collegeEvent.count({ where: { institutionId: id, startsAt: { gte: now }, cancelledAt: null } }),
    prisma.exclusiveJobPosting.count({ where: { institutionScopeId: id, status: 'approved', archivedAt: null } }),
    programRecommendations(id, m?.candidateId ?? null),
  ])
  const items = stageHelp(stage, ctx.institution.slug, { hasPrograms: programs > 0, hasOfficeHours: slots > 0, hasEvents: events > 0, hasJobs: jobs > 0 })
  if (!items.length && !recs.length) return null
  return (
    <section aria-labelledby="stage-help" className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 id="stage-help" className="text-base font-semibold">
          From {ctx.institution.name}, for where you are
        </h2>
        <p className="text-xs text-muted-foreground">{stage ? `You’re ${getStage(stage).label.toLowerCase()}. ` : ''}This changes as your search does.</p>
      </div>
      {recs.length > 0 && (
        <ul className="space-y-1">
          {recs.map((r) => (
            <li key={r.cohortId}>
              <Link href={`/i/${ctx.institution.slug}/candidate/programs`} className="flex items-start gap-2 text-sm hover:text-primary">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  {r.from === 'report' ? `Your Market Reality report flagged ${r.skill}.` : `You want to grow in ${r.skill}.`} {r.program} ({r.cohort}) starts {day(r.startsAt)}.
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key}>
            <Link href={i.href} className="group flex h-full flex-col rounded-md border border-border p-3 hover:border-primary">
              <span className="flex items-center justify-between text-sm font-medium">
                {i.title}
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
              </span>
              <span className="text-xs text-muted-foreground">{i.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Candidate › Network ─────────────────────────────────────────────────────

export async function CandidateNetwork({ ctx, searchParams }: Props) {
  const id = ctx.institution.id
  const memberId = ctx.memberId
  const slug = ctx.institution.slug
  const [companies, intros, slots, calls, events, groups, milestones, mentor, me] = await Promise.all([
    companiesWithAlumni(id, memberId, 12),
    memberId ? myAlumniIntros(memberId) : Promise.resolve({ sent: [], received: [] }),
    openOfficeHours(id, memberId),
    memberId ? myOfficeHours(memberId) : Promise.resolve({ booked: [], hosting: [] }),
    upcomingEvents(id, memberId),
    memberId ? myGroups(memberId) : Promise.resolve([]),
    listMilestones(id, { limit: 8 }),
    memberId ? prisma.institutionMentor.findUnique({ where: { memberId }, select: { isActive: true } }) : null,
    memberId ? prisma.institutionMember.findUnique({ where: { id: memberId }, select: { major: true } }) : null,
  ])
  const q = searchParams?.q?.trim() ?? ''
  const searched = q ? await alumniAtCompany(id, q, memberId) : null
  const shown = await Promise.all(companies.slice(0, 6).map(async (c) => ({ ...c, alumni: await alumniAtCompany(id, c.employer, memberId) })))
  const groupKey = searchParams?.group && groups.some((g) => g.key === searchParams.group) ? searchParams.group : groups[0]?.key
  const group = groupKey ? await groupView(id, groupKey) : null
  const major = me?.major ? (await outcomesByMajor(id, me.major))[0] : undefined
  const canAct = !!memberId && !ctx.readOnly
  const pendingForMe = intros.received.filter((r) => r.status === 'REQUESTED')

  return (
    <div className="space-y-10">
      {pendingForMe.length > 0 && (
        <section aria-labelledby="asks" className="space-y-3 rounded-lg border border-primary/40 bg-card p-4">
          <h2 id="asks" className="text-base font-semibold">
            {pendingForMe.length === 1 ? 'An alum would like 15 minutes' : `${pendingForMe.length} alumni would like 15 minutes`}
          </h2>
          <ul className="space-y-3">
            {pendingForMe.map((r) => (
              <li key={r.id} className="space-y-1">
                <p className="text-sm">
                  <span className="font-medium">{r.name}</span> · {r.purpose.toLowerCase()} at {r.companyName}
                </p>
                {r.note && <p className="text-xs text-muted-foreground">&ldquo;{r.note}&rdquo;</p>}
                {canAct && <AnswerIntro slug={slug} requestId={r.id} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="intros" aria-labelledby="intros-h" className="space-y-3">
        <h2 id="intros-h" className="text-base font-semibold">
          Alumni at the companies you’re targeting
        </h2>
        <p className="text-sm text-muted-foreground">
          Applying, interviewing or weighing an offer? Ask someone inside for 15 minutes. These alumni chose to share where they work; they accept or decline,
          and emails are shared only if they accept.
        </p>
        <form className="flex flex-wrap items-center gap-2" action={`/i/${slug}/candidate/network`}>
          <label htmlFor="co" className="sr-only">
            Company
          </label>
          <input id="co" name="q" defaultValue={q} placeholder="A company, e.g. UPMC" className="h-9 w-64 rounded-md border border-input bg-background px-2 text-sm" />
          <button type="submit" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            Find alumni
          </button>
        </form>
        {searched && (
          <div className="rounded-lg border border-border bg-card p-4">
            {searched.length ? (
              <ul className="space-y-3">
                {searched.map((a) => (
                  <li key={a.memberId} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">
                      {a.name}
                      {yr(a.classYear)}
                      {a.title ? ` · ${a.title}` : ''}
                    </span>
                    {canAct && <AskIntro slug={slug} targetMemberId={a.memberId} companyName={q} name={a.name} />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No alumni who share their employer work at &ldquo;{q}&rdquo; yet. Try a mentor in that industry.</p>
            )}
          </div>
        )}
        {shown.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((c) => (
              <li key={c.employer} className="space-y-2 rounded-lg border border-border bg-card p-4">
                <p className="font-medium">
                  {c.employer} <span className="text-sm font-normal text-muted-foreground">· {c.n} {c.n === 1 ? 'alum' : 'alumni'}</span>
                </p>
                <ul className="space-y-2">
                  {c.alumni.slice(0, 3).map((a) => (
                    <li key={a.memberId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        {a.name}
                        {yr(a.classYear)}
                        {a.title ? ` · ${a.title}` : ''}
                      </span>
                      {canAct && <AskIntro slug={slug} targetMemberId={a.memberId} companyName={c.employer} name={a.name} />}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {(intros.sent.length > 0 || intros.received.some((r) => r.status === 'ACCEPTED')) && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Your intros</p>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {intros.sent.map((s) => (
                <li key={s.id} className="flex flex-wrap justify-between gap-2 p-3">
                  <span>
                    {s.name} at {s.companyName}
                  </span>
                  <span className="text-muted-foreground">
                    {s.status === 'ACCEPTED' && s.email ? (
                      <a href={`mailto:${s.email}`} className="text-primary hover:underline">
                        {s.email}
                      </a>
                    ) : s.status === 'DECLINED' ? (
                      'Not right now'
                    ) : (
                      'Waiting'
                    )}
                  </span>
                </li>
              ))}
              {intros.received
                .filter((r) => r.status === 'ACCEPTED')
                .map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2 p-3">
                    <span>
                      {r.name} asked about {r.companyName}
                    </span>
                    {r.email && (
                      <a href={`mailto:${r.email}`} className="text-primary hover:underline">
                        {r.email}
                      </a>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      <section id="office-hours" aria-labelledby="oh-h" className="space-y-3">
        <h2 id="oh-h" className="text-base font-semibold">
          Office hours
        </h2>
        <p className="text-sm text-muted-foreground">Book 20 minutes with an alumni mentor: a résumé read, your story, a mock interview. Times are Eastern.</p>
        {(calls.booked.length > 0 || calls.hosting.length > 0) && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Your calls</p>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {calls.booked.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span>
                    {when(b.startsAt)} with {b.with} ·{' '}
                    <a href={`mailto:${b.email}`} className="text-primary hover:underline">
                      {b.email}
                    </a>
                  </span>
                  {canAct && <CancelSlot slug={slug} slotId={b.id} label="Cancel booking" />}
                </li>
              ))}
              {calls.hosting.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span>
                    {when(h.startsAt)} · {h.with ? (
                      <>
                        {h.with}
                        {h.email && (
                          <>
                            {' · '}
                            <a href={`mailto:${h.email}`} className="text-primary hover:underline">
                              {h.email}
                            </a>
                          </>
                        )}
                        {h.note ? ` · “${h.note}”` : ''}
                      </>
                    ) : (
                      'Open'
                    )}
                  </span>
                  {canAct && <CancelSlot slug={slug} slotId={h.id} label="Cancel slot" />}
                </li>
              ))}
            </ul>
          </div>
        )}
        {slots.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {slots.slice(0, 12).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                <span>
                  <span className="font-medium">{when(s.startsAt)}</span> · {s.minutes} min
                  <span className="block text-xs text-muted-foreground">
                    {s.name}
                    {yr(s.classYear)}
                    {s.topic ? ` · ${s.topic}` : s.industries.length ? ` · ${s.industries.join(', ')}` : ''}
                  </span>
                </span>
                {canAct && <BookSlot slug={slug} slotId={s.id} />}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Clock} title="No open times right now" description="Mentors add office hours every week. Or request a call on the Mentors tab." />
        )}
        {canAct && mentor?.isActive && (
          <details className="rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium text-primary">You’re a mentor: add office hours</summary>
            <div className="pt-3">
              <OfficeHoursForm slug={slug} />
            </div>
          </details>
        )}
      </section>

      <section id="events" aria-labelledby="ev-h" className="space-y-3">
        <h2 id="ev-h" className="text-base font-semibold">
          Events
        </h2>
        {events.length ? (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {kindLabel(e.kind)} · {when(e.startsAt)}
                    {e.location ? ` · ${e.location}` : ''} · {e.going} going
                  </p>
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      Details
                    </a>
                  )}
                </div>
                {canAct && <RsvpButton slug={slug} eventId={e.id} going={e.mine} full={e.full} />}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarDays} title="No events coming up" description="Career panels and employer nights show up here." />
        )}
      </section>

      {groups.length > 0 && (
        <section id="groups" aria-labelledby="gr-h" className="space-y-3">
          <h2 id="gr-h" className="text-base font-semibold">
            Your groups
          </h2>
          <nav aria-label="Groups" className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <Link
                key={g.key}
                href={`/i/${slug}/candidate/network?group=${encodeURIComponent(g.key)}#groups`}
                aria-current={g.key === groupKey ? 'page' : undefined}
                className={cn(buttonVariants({ size: 'sm', variant: g.key === groupKey ? 'default' : 'outline' }))}
              >
                {g.label} · {g.joined} joined
              </Link>
            ))}
          </nav>
          {group && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium">Where they work</p>
                {group.employers.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {group.employers.map((e) => (
                      <li key={e.employer} className="flex justify-between gap-2">
                        <Link href={`/i/${slug}/candidate/network?q=${encodeURIComponent(e.employer)}#intros`} className="hover:text-primary">
                          {e.employer}
                        </Link>
                        <span className="tabular-nums text-muted-foreground">{e.n}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Shown once two or more share an employer.</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{group.mentors} mentors in this group</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium">Recent news</p>
                {group.milestones.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {group.milestones.map((m) => (
                      <li key={m.id}>
                        {m.name}
                        {yr(m.classYear)}: {[m.title, m.employer].filter(Boolean).join(' at ') || 'a new role'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No shared milestones yet.</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {major && (
        <section aria-labelledby="major-h" className="space-y-2">
          <h2 id="major-h" className="text-base font-semibold">
            What {ctx.institution.name} {major.major} grads do
          </h2>
          <p className="text-sm text-muted-foreground">From {major.alumni} alumni on the roster. Shown only where at least two share it.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ul className="rounded-lg border border-border bg-card p-4 text-sm">
              <li className="mb-1 font-medium">Employers</li>
              {major.employers.map((e) => (
                <li key={e.employer} className="flex justify-between">
                  <span>{e.employer}</span>
                  <span className="text-muted-foreground">{e.n}</span>
                </li>
              ))}
            </ul>
            <ul className="rounded-lg border border-border bg-card p-4 text-sm">
              <li className="mb-1 font-medium">Titles</li>
              {major.titles.map((t) => (
                <li key={t.title} className="flex justify-between">
                  <span>{t.title}</span>
                  <span className="text-muted-foreground">{t.n}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {milestones.length > 0 && (
        <section aria-labelledby="ms-h" className="space-y-2">
          <h2 id="ms-h" className="text-base font-semibold">
            Alumni news
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {milestones.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  {m.name}
                  {yr(m.classYear)} {m.title || m.employer ? `· ${[m.title, m.employer].filter(Boolean).join(' at ')}` : 'landed a new role'}
                </span>
                <span className="text-xs text-muted-foreground">{day(m.reportedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── Alumni Relations › Events, and the milestones feed on home ──────────────

export async function AlumniEvents({ ctx }: Props) {
  const events = await eventsForStaff(ctx.institution.id)
  const canEdit = !ctx.readOnly && ['ALUMNI_RELATIONS', 'CAREER_SERVICES', 'INSTITUTION_ADMIN'].some((r) => ctx.tokens.has(r as 'ALUMNI_RELATIONS'))
  const now = new Date().getTime()
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">Career panels, employer nights and workshops. Alumni RSVP from their Network tab; checking someone in counts as event engagement (with their consent).</p>
      {canEdit && (
        <section aria-labelledby="new-ev" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="new-ev" className="text-base font-semibold">
            Add an event
          </h2>
          <EventForm slug={ctx.institution.slug} />
        </section>
      )}
      {events.length ? (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {e.title}
                  {e.cancelledAt && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">Cancelled</span>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {kindLabel(e.kind)} · {when(e.startsAt)} · {e.rsvps.length} going{e.capacity ? ` of ${e.capacity}` : ''} · {e.rsvps.filter((r) => r.checkedInAt).length} checked in
                </p>
              </div>
              {e.rsvps.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm text-primary">{e.startsAt.getTime() < now + 6 * 3600_000 ? 'Check people in' : 'Who’s going'}</summary>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {e.rsvps.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>
                          {[r.member.firstName, r.member.lastName].filter(Boolean).join(' ')}
                          {yr(r.member.classYear)}
                        </span>
                        {canEdit && <CheckInToggle slug={ctx.institution.slug} rsvpId={r.id} checkedIn={!!r.checkedInAt} />}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {canEdit && !e.cancelledAt && e.startsAt.getTime() > now && (
                <ConfirmActionButton label="Cancel event" variant="outline" confirm={`Cancel “${e.title}”? People who RSVP’d will see it as cancelled.`} confirmLabel="Cancel event" run={cancelEvent.bind(null, ctx.institution.slug, e.id)} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={CalendarDays} title="No events yet" description="Add a career panel or an employer night above." />
      )}
    </div>
  )
}

export async function MilestonesFeed({ ctx }: { ctx: WorkspaceContext }) {
  const items = await listMilestones(ctx.institution.id, { limit: 6 })
  if (!items.length) return null
  return (
    <section aria-labelledby="ms-staff" className="space-y-2">
      <h2 id="ms-staff" className="text-base font-semibold">
        Alumni news you can share
      </h2>
      <p className="text-sm text-muted-foreground">New jobs alumni chose to share as milestones. Ready for the magazine, social or a newsletter.</p>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
        {items.map((m) => (
          <li key={m.id} className="flex flex-wrap justify-between gap-2 p-3">
            <span>
              {m.name}
              {yr(m.classYear)} · {[m.title, m.employer].filter(Boolean).join(' at ') || 'a new role'}
            </span>
            <span className="text-xs text-muted-foreground">{day(m.reportedAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Alumni Relations › Outreach: segments ───────────────────────────────────

export async function SegmentsSection({ ctx }: { ctx: WorkspaceContext }) {
  const canEdit = !ctx.readOnly && (ctx.tokens.has('ALUMNI_RELATIONS') || ctx.tokens.has('INSTITUTION_ADMIN'))
  const [segments, opts] = await Promise.all([listSegments(ctx.institution.id), segmentOptions(ctx.institution.id)])
  return (
    <section aria-labelledby="segments" className="space-y-3">
      <h2 id="segments" className="text-base font-semibold">
        Saved audiences
      </h2>
      {segments.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
          {segments.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span>
                <span className="font-medium">{s.name}</span> · {s.count.toLocaleString()} · <span className="text-muted-foreground">{s.description}</span>
              </span>
              {canEdit && <ConfirmActionButton label="Delete" variant="outline" confirm={`Delete the “${s.name}” audience? Emails already sent aren’t affected.`} confirmLabel="Delete audience" run={deleteSegmentAction.bind(null, ctx.institution.slug, s.id)} />}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <details className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium text-primary">Build an audience</summary>
          <div className="pt-3">
            <SegmentForm slug={ctx.institution.slug} majors={opts.majors} metros={opts.metros} />
          </div>
        </details>
      )}
    </section>
  )
}

// ── Admin › Board report ────────────────────────────────────────────────────

export async function AdminBoard({ ctx }: Props) {
  const b = await boardDashboard(ctx.institution.id)
  const r = b.report
  const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="max-w-2xl text-sm text-muted-foreground">One page for the president and trustees. Counts only; the last 12 months unless it says otherwise.</p>
        <div className="flex gap-2">
          <Link href={`/i/${ctx.institution.slug}/outcomes`} target="_blank" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Public outcomes report
          </Link>
          <PrintButton />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Alumni participating" value={pct(b.participation)} note={`${b.joined.toLocaleString()} of ${r.members.toLocaleString()} on the roster`} />
        <StatTile label="Landed new roles" value={r.landed ?? '<5'} />
        <StatTile label="Median days to land" value={r.medianDaysToLand ?? '—'} />
        <StatTile label="Said the college helped" value={pct(r.helpedShare)} />
        <StatTile label={`Giving lift, ${b.fy.label}`} value={b.roi.lift === null ? 'Too early' : `${b.roi.lift > 0 ? '+' : ''}${b.roi.lift.toFixed(1)} pts`} note="Users vs matched alumni who never joined" />
        <StatTile label="In transition now" value={b.inTransition} />
        <StatTile label="Resilience Fund" value={usd(b.fund.fund?.raisedCents ?? 0)} note={`${b.fund.awards} funded · ${b.fund.placed} placed`} />
        <StatTile label="Program completions" value={r.programsCompleted ?? '<5'} />
        <StatTile label="Mentor calls" value={r.mentorCalls ?? '<5'} />
        <StatTile label="Event check-ins" value={b.eventAttendance} />
        <StatTile label="VP-and-up promotions" value={r.promotions ?? '<5'} />
      </div>
      {r.peers && (
        <section aria-labelledby="board-peers" className="space-y-2">
          <h2 id="board-peers" className="text-base font-semibold">
            Against {r.peers.peers.length} peers
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {r.peers.metrics.map((m) => (
              <li key={m.key} className="rounded-lg border border-border bg-card p-3 text-sm">
                {m.label}: {m.rank ? `#${m.rank} of ${m.of}` : '—'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── Workforce › Eligible-provider listing and Rapid response ────────────────

export async function WorkforceEtpl({ ctx }: Props) {
  const rows = await etplRows(ctx.institution.id)
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        What most states ask for to list a program on the Eligible Training Provider List (so WIOA can pay for it): program details and outcomes for all
        students. Fill the missing fields in Exec Ed › Programs, then download the CSV for the state’s form. Placement counts a new job within 180 days of finishing.
      </p>
      <a href={`/i/${ctx.institution.slug}/export/etpl`} download className={cn(buttonVariants({ variant: 'outline' }))}>
        Download ETPL data (CSV)
      </a>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((r) => {
            const missing = etplMissing(r)
            return (
              <li key={r.programId} className="space-y-2 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {r.name}
                    {r.wioaEligible && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">Listed</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[r.cipCode && `CIP ${r.cipCode}`, r.hours && `${r.hours} hours`, r.credentialType, (r.costCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }), r.modality].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <p className="text-sm">
                  {r.enrolled} enrolled · completion {pct(r.completionRate)} · credential {pct(r.credentialRate)} · placement {pct(r.placementRate)}
                </p>
                {missing.length > 0 && <p className="text-xs text-amber-700">Missing for the state: {missing.join(', ')}</p>}
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState icon={Landmark} title="No programs yet" description="Exec Ed adds programs; they show here with what the state needs." />
      )}
    </div>
  )
}

export async function WorkforceRapid({ ctx }: Props) {
  const id = ctx.institution.id
  const [notices, responses, programs] = await Promise.all([regionNotices(id), listRapidResponses(id), listPrograms(id)])
  const eligible = programs.filter((p) => p.isActive && p.cohorts.length).map((p) => ({ id: p.id, name: `${p.name}${p.wioaEligible ? ' (WIOA-eligible)' : ''}` }))
  const canEdit = !ctx.readOnly && ['WORKFORCE_PARTNER', 'EXEC_ED', 'INSTITUTION_ADMIN'].some((r) => ctx.tokens.has(r as 'EXEC_ED'))
  const base = process.env.NEXT_PUBLIC_APP_URL || ''
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        When a WARN notice hits an employer in your region, offer the affected workers, alumni or not, a seat in a program the board can fund. Each offer gets a public
        sign-up page to share with the employer, the union or the state’s rapid response team; sign-ups land in Exec Ed › Enrollments as WIOA applications.
      </p>
      {responses.length > 0 && (
        <section aria-labelledby="rr-live" className="space-y-2">
          <h2 id="rr-live" className="text-base font-semibold">
            Your offers
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {responses.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <span>
                  <span className="font-medium">{r.title}</span> · {r.enrollments.length} signed up{r.isActive ? '' : ' · closed'}
                  <span className="block text-xs text-muted-foreground">
                    Sign-up page:{' '}
                    <a href={`/i/${ctx.institution.slug}/rapid/${r.id}`} target="_blank" className="text-primary hover:underline">
                      {base}/i/{ctx.institution.slug}/rapid/{r.id}
                    </a>
                  </span>
                </span>
                {canEdit && (
                  <ConfirmActionButton
                    label={r.isActive ? 'Close sign-ups' : 'Reopen'}
                    variant="outline"
                    confirm={r.isActive ? 'Close this offer? The page will say sign-ups have closed.' : 'Reopen sign-ups?'}
                    confirmLabel={r.isActive ? 'Close sign-ups' : 'Reopen'}
                    run={toggleRapidResponse.bind(null, ctx.institution.slug, r.id, !r.isActive)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="rr-notices" className="space-y-3">
        <h2 id="rr-notices" className="text-base font-semibold">
          Recent layoffs {notices.length ? (notices[0].inRegion ? 'in your region' : 'in your state') : 'nearby'}
        </h2>
        {notices.length ? (
          <ul className="space-y-3">
            {notices.map((n) => (
              <li key={n.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{n.employer}</p>
                  <p className="text-sm text-muted-foreground">
                    {[n.county, n.noticeDate && `filed ${day(n.noticeDate)}`, n.employees && `${n.employees.toLocaleString()} workers`].filter(Boolean).join(' · ')}
                    {n.sourceUrl && (
                      <>
                        {' · '}
                        <a href={n.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                          Notice
                        </a>
                      </>
                    )}
                  </p>
                </div>
                {n.responseId ? (
                  <p className="text-sm text-muted-foreground">You have an offer for this layoff.</p>
                ) : canEdit && eligible.length ? (
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-primary">Offer a program to these workers</summary>
                    <div className="pt-3">
                      <RapidResponseForm slug={ctx.institution.slug} warnNoticeId={n.id} employerName={n.employer} programs={eligible} college={ctx.institution.name} />
                    </div>
                  </details>
                ) : !eligible.length ? (
                  <p className="text-xs text-muted-foreground">Add a program with an open cohort in Exec Ed to make an offer.</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Megaphone} title="No recent WARN notices nearby" description="Set the college’s region in its profile so local filings show here." />
        )}
      </section>
    </div>
  )
}

