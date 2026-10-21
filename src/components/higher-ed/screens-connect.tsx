// Class notes, job-search circles and the virtual career fair (alumni and
// staff), the monthly alumni email settings and the consent-history report.

import { CalendarDays, Megaphone, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { boothVisitors, careerFairs, listClassNotes, NOTE_KINDS, openCircles } from '@/lib/higher-ed/connect'
import { readMonthly } from '@/lib/higher-ed/monthly'
import { collegeTimeZone, formatInZone } from '@/lib/higher-ed/time-zone'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmActionButton } from './ConfirmActionButton'
import { BoothForm, BoothVisit, CircleForm, CircleJoin, ClassNoteForm, FairForm, MonthlyEmailSettings } from './ConnectForms'
import { loadModules, OffNote } from './screens-community'
import * as A from '@/app/i/[slug]/(portal)/connect-actions'

const card = 'rounded-lg border border-border bg-card p-4'
const day = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d))
const kindLabel = (k: string) => NOTE_KINDS.find((x) => x.key === k)?.label ?? k

async function zone(institutionId: string) {
  const i = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true, profile: true } })
  return collegeTimeZone(i.enabledFeatures, i.profile)
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {intro && <p className="max-w-2xl text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

// ── Candidate › People ──────────────────────────────────────────────────────

export async function ConnectSections({ ctx }: { ctx: WorkspaceContext }) {
  const mods = await loadModules(ctx.institution.id)
  const id = ctx.institution.id
  const slug = ctx.institution.slug
  const canAct = !!ctx.memberId && !ctx.readOnly
  const me = ctx.memberId ? await prisma.institutionMember.findUnique({ where: { id: ctx.memberId }, select: { classYear: true } }) : null
  const [notes, circles, fairs, tz] = await Promise.all([
    mods.classNotes ? listClassNotes(id, { limit: 20 }) : Promise.resolve([]),
    mods.circles ? openCircles(id, ctx.memberId) : Promise.resolve([]),
    mods.careerFair ? careerFairs(id, ctx.memberId) : Promise.resolve([]),
    zone(id),
  ])
  const mine = notes.filter((n) => me?.classYear && n.classYear === me.classYear)
  const others = notes.filter((n) => !mine.includes(n))
  return (
    <div className="space-y-10">
      {mods.careerFair && fairs.length > 0 && (
        <Section id="fair-h" title="Virtual career fair" intro="Employers hiring alumni. Leave a note at any booth; share your Dossier only if you want to.">
          {fairs.map((f) => (
            <div key={f.id} className="space-y-3">
              <p className="text-sm font-medium">
                {f.title} · {formatInZone(f.startsAt, tz)}
              </p>
              {f.booths.length ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {f.booths.map((b) => (
                    <li key={b.id} className={`${card} space-y-2`}>
                      <p className="font-medium">{b.employerName}</p>
                      {b.roles && <p className="text-sm"><span className="text-muted-foreground">Hiring: </span>{b.roles}</p>}
                      {b.pitch && <p className="text-sm text-muted-foreground">{b.pitch}</p>}
                      {b.meetingUrl && (
                        <a href={b.meetingUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                          Join the booth video
                        </a>
                      )}
                      {canAct && <BoothVisit slug={slug} boothId={b.id} visited={b.visited} />}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Booths are being set up. Check back soon.</p>
              )}
            </div>
          ))}
        </Section>
      )}

      {mods.circles && (
        <Section id="circles-h" title="Job-search circles" intro="About six alumni and a facilitator meet weekly for six weeks: goals, accountability, and people in the same spot.">
          {circles.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {circles.map((c) => (
                <li key={c.id} className={`${card} space-y-2`}>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[`Starts ${day(c.startsAt)}`, `${c.weeks} weeks`, c.meetingTime, `with ${c.facilitator}`, `${c._count.members} of ${c.capacity} seats`].filter(Boolean).join(' · ')}
                  </p>
                  {c.focus && <p className="text-sm">{c.focus}</p>}
                  {c.joined && c.meetingUrl && (
                    <a href={c.meetingUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                      Meeting link
                    </a>
                  )}
                  {canAct && (c.full && !c.joined ? <p className="text-sm text-muted-foreground">This one is full.</p> : <CircleJoin slug={slug} circleId={c.id} joined={c.joined} />)}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Users} title="No circles open right now" description="Career Services opens new circles every few weeks. They’ll show here." />
          )}
        </Section>
      )}

      {mods.classNotes && (
        <Section id="notes-h" title="Class notes" intro="News from your class and other alumni. Share yours.">
          {canAct && <ClassNoteForm slug={slug} />}
          {mine.length + others.length ? (
            <ul className="space-y-2">
              {[...mine, ...others].map((n) => (
                <li key={n.id} className={card}>
                  <p className="text-xs text-muted-foreground">
                    {n.who} · {kindLabel(n.kind)} · {day(n.createdAt)}
                  </p>
                  <p className="whitespace-pre-line text-sm">{n.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Megaphone} title="No class notes yet" description="Be the first from your class." />
          )}
        </Section>
      )}
    </div>
  )
}

// ── Staff: Alumni Relations / Career Services ───────────────────────────────

export async function StaffConnect({ ctx }: { ctx: WorkspaceContext }) {
  const mods = await loadModules(ctx.institution.id)
  const id = ctx.institution.id
  const slug = ctx.institution.slug
  const write = !ctx.readOnly
  const [circles, fairs, notes, tz] = await Promise.all([
    prisma.jobSearchCircle.findMany({
      where: { institutionId: id },
      orderBy: { startsAt: 'desc' },
      take: 10,
      include: { members: { include: { member: { select: { firstName: true, lastName: true, classYear: true, email: true } } } } },
    }),
    careerFairs(id, null),
    listClassNotes(id, { limit: 30, includeHidden: false }),
    zone(id),
  ])
  const visitors = new Map(await Promise.all(fairs.flatMap((f) => f.booths).map(async (b) => [b.id, await boothVisitors(b.id)] as const)))
  return (
    <div className="space-y-10">
      <Section id="s-circles" title="Job-search circles" intro="Open a circle, alumni sign up, the facilitator runs six weekly sessions. Members see the meeting link once they join.">
        {!mods.circles && <OffNote ctx={ctx} what="Job-search circles" />}
        {circles.map((c) => (
          <div key={c.id} className={`${card} space-y-2`}>
            <p className="font-medium">
              {c.name} <span className="text-xs font-normal text-muted-foreground">· starts {day(c.startsAt)} · {c.weeks} weeks · {c.members.length} of {c.capacity} · {c.facilitator}</span>
            </p>
            {c.members.length ? (
              <ul className="space-y-0.5 text-sm">
                {c.members.map((m) => (
                  <li key={m.id}>
                    {[m.member.firstName, m.member.lastName].filter(Boolean).join(' ')}
                    {m.member.classYear ? ` ’${String(m.member.classYear).slice(2)}` : ''} · <a className="text-primary underline" href={`mailto:${m.member.email}`}>{m.member.email}</a>
                    {m.goal && <span className="text-muted-foreground"> · {m.goal}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No sign-ups yet.</p>
            )}
          </div>
        ))}
        {write && (
          <details className={card} open={!circles.length}>
            <summary className="cursor-pointer text-sm font-semibold">Open a circle</summary>
            <div className="mt-3">
              <CircleForm slug={slug} />
            </div>
          </details>
        )}
      </Section>

      <Section id="s-fairs" title="Virtual career fairs" intro="Set up a fair, add a booth per employer, and see who stopped by. Alumni choose whether employers see their Dossier.">
        {!mods.careerFair && <OffNote ctx={ctx} what="Virtual career fair" />}
        {fairs.map((f) => (
          <div key={f.id} className={`${card} space-y-3`}>
            <p className="font-medium">
              {f.title} <span className="text-xs font-normal text-muted-foreground">· {formatInZone(f.startsAt, tz)} · {f.booths.length} booths</span>
            </p>
            {f.booths.map((b) => (
              <div key={b.id} className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
                <p className="font-medium">{b.employerName}</p>
                {(visitors.get(b.id) ?? []).length ? (
                  <ul className="space-y-0.5">
                    {(visitors.get(b.id) ?? []).map((v) => (
                      <li key={v.id}>
                        {v.name} · <a className="text-primary underline" href={`mailto:${v.email}`}>{v.email}</a>
                        {v.note && <span className="text-muted-foreground"> · {v.note}</span>}
                        {v.shareDossier && <span className="text-xs"> · shared their Dossier</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No visitors yet.</p>
                )}
              </div>
            ))}
            {write && <BoothForm slug={slug} eventId={f.id} />}
          </div>
        ))}
        {!fairs.length && <EmptyState icon={CalendarDays} title="No fairs yet" description="Create one, then add employer booths." />}
        {write && <FairForm slug={slug} />}
      </Section>

      <Section id="s-notes" title="Class notes" intro="What alumni shared with their class. Hide anything that doesn’t belong; it stays on record.">
        {!mods.classNotes && <OffNote ctx={ctx} what="Class notes" />}
        {notes.length ? (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className={`${card} flex flex-wrap items-start justify-between gap-2`}>
                <span className="text-sm">
                  <span className="text-xs text-muted-foreground">
                    {n.who} · {kindLabel(n.kind)} · {day(n.createdAt)}:{' '}
                  </span>
                  {n.body}
                </span>
                {write && <ConfirmActionButton variant="outline" label="Hide" confirm="Hide this class note?" confirmLabel="Hide note" run={A.hideClassNote.bind(null, slug, n.id)} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No class notes yet.</p>
        )}
      </Section>
    </div>
  )
}

// ── Admin › Services: monthly alumni email ──────────────────────────────────

export async function MonthlyEmailPanel({ ctx }: { ctx: WorkspaceContext }) {
  const row = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const m = readMonthly(row.enabledFeatures)
  const sentThisMonth = m.campaignId && m.month === new Date().toISOString().slice(0, 7) ? await prisma.outreachSend.count({ where: { campaignId: m.campaignId, sentAt: { not: null } } }) : 0
  return (
    <section aria-labelledby="monthly-h" className={`${card} space-y-3`}>
      <div>
        <h2 id="monthly-h" className="text-base font-semibold">
          Monthly email to every alum {m.on ? <span className="text-sm font-normal text-success">· on</span> : <span className="text-sm font-normal text-muted-foreground">· off</span>}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          “This month from {ctx.institution.name}, for you”: a short personal note with where they are (in transition or not), new alumni-only jobs and projects,
          events coming up, a classmate’s news and your latest college news. Unsubscribed and do-not-contact alumni are skipped; every email has one-click
          unsubscribe. Large rosters go out over a few nights.
        </p>
      </div>
      {m.on && <p className="text-sm">Sent this month: {sentThisMonth.toLocaleString()}</p>}
      <MonthlyEmailSettings slug={ctx.institution.slug} on={m.on} day={m.day} disabled={!ctx.tokens.has('INSTITUTION_ADMIN') || ctx.readOnly} />
    </section>
  )
}

// ── Admin › Privacy: consent history ────────────────────────────────────────

const SCOPE_LABEL: Record<string, string> = {
  SHARE_OUTCOME: 'Share where they land',
  SHARE_SEARCH_DETAIL_WITH_CAREER: 'Share search progress with Career Services',
  SHARE_ENGAGEMENT: 'Count activity toward engagement',
  SHARE_DOSSIER_WITH_EMPLOYERS: 'Share Dossier with employers',
  LIST_IN_DIRECTORY: 'List in the alumni directory',
}

export async function ConsentHistory({ ctx }: { ctx: WorkspaceContext }) {
  const rows = await prisma.$queryRaw<{ scope: string; month: string; granted: number; withdrawn: number }[]>`
    select c.scope::text as scope, to_char(date_trunc('month', coalesce(c."changedAt", c."createdAt")), 'YYYY-MM') as month,
      count(*) filter (where c.granted)::int as granted, count(*) filter (where not c.granted)::int as withdrawn
    from public."InstitutionConsent" c join public."InstitutionMember" m on m.id = c."memberId"
    where m."institutionId" = ${ctx.institution.id} and coalesce(c."changedAt", c."createdAt") >= now() - interval '12 months'
    group by 1, 2 order by 2 desc, 1`
  const months = [...new Set(rows.map((r) => r.month))]
  const scopes = [...new Set(rows.map((r) => r.scope))]
  return (
    <section aria-labelledby="consent-h" className="space-y-3">
      <div>
        <h2 id="consent-h" className="text-base font-semibold">
          Consent history
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">Every sharing choice alumni made in the last 12 months, by month: how many turned each one on (granted) and off (withdrawn). For audits and FERPA questions; individual history is in each person’s data export.</p>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Choice</th>
                {months.map((m) => (
                  <th key={m} className="px-3 py-2 text-right font-medium">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scopes.map((sc) => (
                <tr key={sc} className="border-t border-border">
                  <td className="px-3 py-2">{SCOPE_LABEL[sc] ?? sc}</td>
                  {months.map((mo) => {
                    const r = rows.find((x) => x.scope === sc && x.month === mo)
                    return (
                      <td key={mo} className="px-3 py-2 text-right tabular-nums">
                        {r ? `+${r.granted} / −${r.withdrawn}` : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No sharing choices recorded in the last 12 months.</p>
      )}
    </section>
  )
}
