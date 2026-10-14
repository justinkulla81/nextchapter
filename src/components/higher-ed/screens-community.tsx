// The alumni community screens: projects and boards, the directory, groups
// and chapters, people like you, Ask an alum, mentoring programs, course
// auditing, learning paths, ways to give time, college news, portal
// features and privacy requests. Each section checks its portal feature
// (modules.ts): off means hidden for alumni and a one-line note for staff.

import Link from 'next/link'
import { BookOpen, Briefcase, HandHeart, MessagesSquare, ShieldCheck, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { MODULES, modulesFrom, type ModuleKey, type Modules } from '@/lib/higher-ed/modules'
import {
  COMPENSATION,
  LEARNING_PATHS,
  OPPORTUNITY_KINDS,
  VOLUNTEER_KINDS,
  collegeNews,
  isListed,
  listGroups,
  listOpportunities,
  listQuestions,
  listVolunteerRoles,
  myInterests,
  myPosts,
  openAuditCourses,
  openMentoringCohorts,
  peopleLikeYou,
  searchDirectory,
  suggestMatches,
} from '@/lib/higher-ed/community'
import { findMembers, listRequests } from '@/lib/higher-ed/data-requests'
import { collegeTimeZone, formatInZone, zoneLabel } from '@/lib/higher-ed/time-zone'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ConfirmActionButton } from './ConfirmActionButton'
import {
  ActionButton,
  AskForm,
  AuditCourseForm,
  CohortForm,
  CohortSignup,
  GroupForm,
  LeaderEventForm,
  LeaderForm,
  ListedToggle,
  MatchControl,
  ModuleToggle,
  NewsForm,
  NoteAction,
  OpportunityForm,
  RateMentoring,
  VolunteerRoleForm,
} from './CommunityForms'
import * as A from '@/app/i/[slug]/(portal)/community-actions'

export type CommunityParams = { kind?: string; dq?: string; year?: string; major?: string; metro?: string; gid?: string; topic?: string; lookup?: string }
type Props = { ctx: WorkspaceContext; base: string; searchParams?: CommunityParams & Record<string, string | undefined> }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmt = (d: Date | null | undefined) => (d ? dateFmt.format(new Date(d)) : '')
const label = <T extends readonly { key: string; label: string }[]>(xs: T, k: string | null) => xs.find((x) => x.key === k)?.label ?? k ?? ''
const card = 'rounded-lg border border-border bg-card p-4'

export async function loadModules(institutionId: string): Promise<Modules> {
  const i = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true } })
  return modulesFrom(i.enabledFeatures)
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
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

// Staff see a switched-off feature as one line, with where to switch it on.
export function OffNote({ ctx, what }: { ctx: WorkspaceContext; what: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
      {what} is switched off, so alumni don’t see it.{' '}
      {ctx.tokens.has('INSTITUTION_ADMIN') ? (
        <Link className="font-medium text-primary underline" href={`/i/${ctx.institution.slug}/admin/services#features`}>
          Switch it on in Admin › Services
        </Link>
      ) : (
        'A college admin can switch it on in Admin › Services.'
      )}
    </p>
  )
}

const canAct = (ctx: WorkspaceContext) => !!ctx.memberId && !ctx.readOnly
const previewNote = (ctx: WorkspaceContext) =>
  !ctx.memberId ? <p className="text-xs text-muted-foreground">You’re previewing: buttons that act as an alum are hidden.</p> : null

// ── Candidate › Home: college news ──────────────────────────────────────────

export async function NewsCard({ ctx }: { ctx: WorkspaceContext }) {
  const mods = await loadModules(ctx.institution.id)
  if (!mods.news) return null
  const news = await collegeNews(ctx.institution.id, 3)
  if (!news.length) return null
  return (
    <Section id="news-h" title={`News from ${ctx.institution.name}`}>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {news.map((n) => (
          <li key={n.id} className="p-4">
            <p className="font-medium">{n.url ? <a className="hover:underline" href={n.url} target="_blank" rel="noreferrer">{n.title}</a> : n.title}</p>
            {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
            <p className="text-xs text-muted-foreground">{fmt(n.publishedAt)}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ── Candidate › Jobs & projects: projects and boards ────────────────────────

export async function ProjectsSection({ ctx, searchParams, base }: Props) {
  const mods = await loadModules(ctx.institution.id)
  if (!mods.projects) return null
  const kind = OPPORTUNITY_KINDS.some((k) => k.key === searchParams?.kind) ? searchParams!.kind! : undefined
  const [ops, posts, interests] = await Promise.all([
    listOpportunities(ctx.institution.id, { kind, viewerMemberId: ctx.memberId }),
    ctx.memberId ? myPosts(ctx.memberId) : Promise.resolve([]),
    ctx.memberId ? myInterests(ctx.memberId) : Promise.resolve([]),
  ])
  const slug = ctx.institution.slug
  const tabHref = (k?: string) => `${base}/jobs${k ? `?kind=${k}` : ''}#projects-h`
  return (
    <Section id="projects-h" title="Projects, fractional roles and board seats" intro={`Posted by ${ctx.institution.name} alumni, for alumni. Say you’re interested; the poster decides whether to connect and then you both see each other’s email.`}>
      <nav aria-label="Filter by kind" className="flex flex-wrap gap-1">
        {[{ key: '', label: 'All' }, ...OPPORTUNITY_KINDS].map((k) => (
          <Link key={k.key} href={tabHref(k.key || undefined)} aria-current={(kind ?? '') === k.key ? 'page' : undefined} className={`rounded-md border px-3 py-1 text-sm ${(kind ?? '') === k.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
            {k.label}
          </Link>
        ))}
      </nav>
      {ops.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {ops.map((o) => (
            <li key={o.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {o.title} <span className="font-normal text-muted-foreground">· {o.organization}</span>
                </p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{label(OPPORTUNITY_KINDS, o.kind)} · {label(COMPENSATION, o.compensation)}</span>
              </div>
              <p className="whitespace-pre-line text-sm">{o.description}</p>
              <p className="text-xs text-muted-foreground">
                {[o.hoursPerWeek ? `${o.hoursPerWeek} hrs/week` : null, o.durationWeeks ? `${o.durationWeeks} weeks` : null, o.location, o.skills.length ? o.skills.join(', ') : null, `Posted by ${o.poster}`].filter(Boolean).join(' · ')}
              </p>
              {canAct(ctx) && !o.mine && (o.myInterest ? <p className="text-xs text-muted-foreground">You said you’re interested{o.myInterest === 'CONNECTED' ? ' and they connected. See “Your interest” below.' : '.'}</p> : <NoteAction label="I’m interested" sendLabel="Send interest" placeholder="A line on why you’re a fit" run={A.interestedAction.bind(null, slug, o.id)} />)}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Briefcase} title="Nothing posted yet" description="Run a business or sit on a board? Post a short project or seat below. Alumni hire alumni." />
      )}
      {previewNote(ctx)}
      {canAct(ctx) && (
        <>
          {interests.length > 0 && (
            <div className={card}>
              <h3 className="mb-2 text-sm font-semibold">Your interest</h3>
              <ul className="space-y-1 text-sm">
                {interests.map((i) => (
                  <li key={i.id}>
                    {i.title} ({i.organization}):{' '}
                    {i.status === 'CONNECTED' ? <>connected. Email {i.poster} at <a className="text-primary underline" href={`mailto:${i.email}`}>{i.email}</a></> : i.status === 'DECLINED' ? 'they went another way.' : `waiting on ${i.poster}.`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {posts.length > 0 && (
            <div className={card}>
              <h3 className="mb-2 text-sm font-semibold">Your posts</h3>
              <ul className="space-y-4">
                {posts.map((p) => (
                  <li key={p.id} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {p.title} <span className="text-xs font-normal text-muted-foreground">({p.status.toLowerCase()})</span>
                      </p>
                      {p.status === 'OPEN' && (
                        <span className="flex gap-2">
                          <ActionButton label="Mark filled" done="Marked filled." run={A.closeOpportunity.bind(null, slug, p.id, 'FILLED', 'member')} />
                          <ActionButton label="Close" variant="ghost" done="Closed." run={A.closeOpportunity.bind(null, slug, p.id, 'CLOSED', 'member')} />
                        </span>
                      )}
                    </div>
                    {p.interests.length ? (
                      <ul className="space-y-2 text-sm">
                        {p.interests.map((i) => (
                          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 p-2">
                            <span>
                              <span className="font-medium">{i.name}</span>
                              {i.note && <span className="text-muted-foreground">: {i.note}</span>}
                              {i.email && <> · <a className="text-primary underline" href={`mailto:${i.email}`}>{i.email}</a></>}
                            </span>
                            {i.status === 'INTERESTED' && (
                              <span className="flex gap-2">
                                <ActionButton label="Connect" variant="default" done="Connected. You both see each other’s email." run={A.answerInterestAction.bind(null, slug, i.id, true)} />
                                <ActionButton label="Not this time" variant="ghost" done="Declined." run={A.answerInterestAction.bind(null, slug, i.id, false)} />
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">No one yet. Posts stay up 60 days.</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details className={card}>
            <summary className="cursor-pointer text-sm font-semibold">Post a project or board seat</summary>
            <div className="mt-3">
              <OpportunityForm slug={slug} as="member" />
            </div>
          </details>
        </>
      )}
    </Section>
  )
}

// ── Candidate › People ──────────────────────────────────────────────────────

export async function PeopleSections({ ctx, searchParams, base }: Props) {
  const mods = await loadModules(ctx.institution.id)
  const id = ctx.institution.id
  const slug = ctx.institution.slug
  const sp = searchParams ?? {}
  const year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : null
  const [listed, results, groups, like, questions, majors] = await Promise.all([
    ctx.memberId && mods.directory ? isListed(ctx.memberId) : Promise.resolve(false),
    mods.directory ? searchDirectory(id, { q: sp.dq, classYear: year, major: sp.major || null, metro: sp.metro || null, groupId: sp.gid || null }) : Promise.resolve([]),
    mods.groups ? listGroups(id, ctx.memberId) : Promise.resolve([]),
    ctx.memberId ? peopleLikeYou(id, ctx.memberId) : Promise.resolve(null),
    mods.askAlumni ? listQuestions(id, sp.topic || null) : Promise.resolve([]),
    prisma.institutionMember.findMany({ where: { institutionId: id, major: { not: null } }, distinct: ['major'], select: { major: true }, orderBy: { major: 'asc' }, take: 60 }),
  ])
  const zi = await prisma.institution.findUniqueOrThrow({ where: { id }, select: { enabledFeatures: true, profile: true } })
  const tz = collegeTimeZone(zi.enabledFeatures, zi.profile)
  const zone = zoneLabel(tz)
  const affinity = groups.filter((g) => g.kind === 'affinity')
  const chapters = groups.filter((g) => g.kind === 'chapter')
  const majorList = majors.map((m) => m.major!).filter(Boolean)
  return (
    <div className="space-y-8">
      {like && (like.majorCount || like.fnCount) ? (
        <Section id="like-h" title="People like you" intro={`What ${ctx.institution.name} alumni with your ${[like.majorCount ? 'major' : null, like.fnCount ? 'line of work' : null].filter(Boolean).join(' or ')} do now. Counts only; nobody is named.`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {like.majorCount && (
              <div className={card}>
                <p className="text-sm font-semibold">{like.major} majors ({like.majorCount})</p>
                {like.majorTitles.length > 0 && <p className="mt-1 text-sm"><span className="text-muted-foreground">Titles: </span>{like.majorTitles.map((t) => `${t.label} (${t.n})`).join(', ')}</p>}
                {like.majorEmployers.length > 0 && <p className="mt-1 text-sm"><span className="text-muted-foreground">Employers: </span>{like.majorEmployers.map((t) => `${t.label} (${t.n})`).join(', ')}</p>}
              </div>
            )}
            {like.fnCount && (
              <div className={card}>
                <p className="text-sm font-semibold">Alumni in {like.fn} ({like.fnCount})</p>
                {like.fnTitles.length > 0 && <p className="mt-1 text-sm"><span className="text-muted-foreground">Titles: </span>{like.fnTitles.map((t) => `${t.label} (${t.n})`).join(', ')}</p>}
                {like.changers && <p className="mt-1 text-sm">{like.changers} of them changed careers to get there.</p>}
              </div>
            )}
          </div>
        </Section>
      ) : null}

      {mods.directory && (
        <Section id="dir-h" title="Alumni directory" intro="Only alumni who chose to be listed appear here.">
          {canAct(ctx) && <ListedToggle slug={slug} listed={listed} />}
          <form method="get" action={`${base}/network`} className="grid gap-2 sm:grid-cols-5">
            <Input name="dq" defaultValue={sp.dq ?? ''} placeholder="Name, employer or title" aria-label="Search the directory" className="sm:col-span-2" />
            <Input name="year" defaultValue={sp.year ?? ''} placeholder="Class year" aria-label="Class year" inputMode="numeric" />
            <select name="major" defaultValue={sp.major ?? ''} aria-label="Major" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Any major</option>
              {majorList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Search
            </Button>
            {sp.gid && <input type="hidden" name="gid" value={sp.gid} />}
          </form>
          {results.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {results.map((r) => (
                <li key={r.memberId} className={card}>
                  <p className="font-medium">
                    {r.name}
                    {r.classYear ? ` ’${String(r.classYear).slice(2)}` : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">{[r.title, r.employer].filter(Boolean).join(' at ') || r.major || '—'}</p>
                  <p className="text-xs text-muted-foreground">{[r.major, r.metro, ...r.groups].filter(Boolean).join(' · ')}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Users} title={sp.dq || sp.year || sp.major ? 'No listed alumni match' : 'No one is listed yet'} description="The directory fills as alumni opt in. Be one of the first: tick “List me” above." />
          )}
        </Section>
      )}

      {mods.groups && groups.length > 0 && (
        <Section id="aff-h" title="Groups and chapters" intro="Affinity groups and regional chapters, run by alumni leaders.">
          <ul className="grid gap-3 sm:grid-cols-2">
            {[...chapters, ...affinity].map((g) => (
              <li key={g.id} className={`${card} space-y-2`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.kind === 'chapter' ? `Chapter${g.metro ? ` · ${g.metro}` : ''}` : 'Affinity group'} · {g._count.members} members
                      {g.leaders.length ? ` · Led by ${g.leaders.join(', ')}` : ''}
                    </p>
                  </div>
                  {canAct(ctx) && <ActionButton label={g.joined ? 'Leave' : 'Join'} variant={g.joined ? 'ghost' : 'default'} done={g.joined ? 'Left.' : 'Joined.'} run={A.joinGroupAction.bind(null, slug, g.id, !g.joined)} />}
                </div>
                {g.description && <p className="text-sm">{g.description}</p>}
                {g.events.length > 0 && (
                  <p className="text-xs">
                    Next:{' '}
                    {g.events.map((e) => `${e.title}, ${formatInZone(e.startsAt, tz)}`).join('; ')}
                  </p>
                )}
                {mods.directory && (
                  <Link className="text-xs text-primary underline" href={`${base}/network?gid=${g.id}#dir-h`}>
                    See listed members
                  </Link>
                )}
                {canAct(ctx) && g.leaders.length > 0 && <LeaderTools ctx={ctx} groupId={g.id} zone={zone} />}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {mods.askAlumni && (
        <Section id="ask-h" title="Ask an alum" intro="Post a question; alumni in that field answer. Be specific: “How did you move from teaching into instructional design?” gets better answers than “Any advice?”">
          {canAct(ctx) && <AskForm slug={slug} topics={majorList} />}
          {questions.length ? (
            <ul className="space-y-3">
              {questions.map((q) => (
                <li key={q.id} className={`${card} space-y-2`}>
                  <p className="text-xs text-muted-foreground">
                    {q.asker} · {q.topic} · {fmt(q.createdAt)}
                  </p>
                  <p className="whitespace-pre-line text-sm font-medium">{q.body}</p>
                  {q.answers.map((a) => (
                    <div key={a.id} className="border-l-2 border-border pl-3 text-sm">
                      <p className="whitespace-pre-line">{a.body}</p>
                      <p className="text-xs text-muted-foreground">{a.by}</p>
                    </div>
                  ))}
                  {canAct(ctx) && <NoteAction label="Answer" sendLabel="Post answer" placeholder="What you’d tell them" run={A.answerQuestion.bind(null, slug, q.id)} />}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={MessagesSquare} title="No questions yet" description="Ask the first one. Alumni get a weekly note of new questions in their field." />
          )}
        </Section>
      )}
      {previewNote(ctx)}
    </div>
  )
}

async function LeaderTools({ ctx, groupId, zone }: { ctx: WorkspaceContext; groupId: string; zone: string }) {
  const lead = ctx.memberId ? await prisma.alumniGroupMember.findFirst({ where: { groupId, memberId: ctx.memberId, role: 'LEADER' }, select: { id: true } }) : null
  if (!lead) return null
  return (
    <details className="rounded-md bg-muted/50 p-2">
      <summary className="cursor-pointer text-xs font-medium">You lead this group: add an event</summary>
      <div className="mt-2">
        <LeaderEventForm slug={ctx.institution.slug} groupId={groupId} zone={zone} />
      </div>
    </details>
  )
}

// ── Candidate › Mentoring: programs ─────────────────────────────────────────

export async function MentoringCohortsSection({ ctx }: Props) {
  const mods = await loadModules(ctx.institution.id)
  if (!mods.mentoringCohorts) return null
  const { cohorts, pairs } = await openMentoringCohorts(ctx.institution.id, ctx.memberId)
  const slug = ctx.institution.slug
  const open = cohorts.filter((c) => c.signupsOpen)
  if (!open.length && !pairs.length) return null
  return (
    <Section id="cohorts-h" title="Mentoring programs" intro="A set number of weeks with one matched mentor. Sign up as a mentee or a mentor; the college makes the match and emails you both.">
      {pairs.length > 0 && (
        <ul className="space-y-2">
          {pairs.map((p) => (
            <li key={p.id} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
              <span className="text-sm">
                {p.cohort}: you’re {p.role === 'mentor' ? 'mentoring' : 'mentored by'} <span className="font-medium">{p.with}</span> ·{' '}
                <a className="text-primary underline" href={`mailto:${p.email}`}>
                  {p.email}
                </a>
              </span>
              {canAct(ctx) && p.role === 'mentee' && !p.rated && <RateMentoring slug={slug} pairId={p.id} />}
            </li>
          ))}
        </ul>
      )}
      {open.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {open.map((c) => (
            <li key={c.id} className={`${card} space-y-2`}>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                Starts {fmt(c.startsAt)} · {c.weeks} weeks{c.theme ? ` · ${c.theme}` : ''} · {c._count.signups} signed up
              </p>
              {pairs.some((p) => p.cohortId === c.id) ? <p className="text-sm">You’re matched; see above.</p> : c.myRole ? <p className="text-sm">You’re signed up as a {c.myRole}. You’ll get an email when you’re matched.</p> : canAct(ctx) ? <CohortSignup slug={slug} cohortId={c.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

// ── Candidate › Learn ───────────────────────────────────────────────────────

export async function LearnSections({ ctx }: Props) {
  const mods = await loadModules(ctx.institution.id)
  const slug = ctx.institution.slug
  const [journey, courses] = await Promise.all([
    ctx.memberId ? prisma.institutionMember.findUnique({ where: { id: ctx.memberId }, select: { candidate: { select: { journey: true } } } }) : null,
    mods.courseAuditing ? openAuditCourses(ctx.institution.id, ctx.memberId) : Promise.resolve([]),
  ])
  const path = journey?.candidate?.journey ? LEARNING_PATHS[journey.candidate.journey] : null
  return (
    <div className="space-y-8">
      {path && (
        <Section id="path-h" title={`Your learning path: ${path.title}`} intro="Steps that fit where you are. Programs below can count toward them.">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {path.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Section>
      )}
      {mods.courseAuditing && (
        <Section id="audit-h" title="Audit a course" intro={`Sit in on a regular ${ctx.institution.name} course. No grade and no credit; the professor approves each auditor.`}>
          {courses.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {courses.map((c) => (
                <li key={c.id} className={`${card} space-y-2`}>
                  <p className="font-medium">
                    {c.courseCode ? `${c.courseCode}: ` : ''}
                    {c.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[c.term, c.schedule, c.modality?.replace('_', ' '), c.faculty?.fullName ?? null].filter(Boolean).join(' · ')}
                  </p>
                  {c.description && <p className="text-sm">{c.description}</p>}
                  {c.myStatus ? (
                    <p className="text-sm">{c.myStatus === 'APPROVED' ? 'Approved. The professor will email you the details.' : c.myStatus === 'DECLINED' ? 'Not this term.' : 'Requested. You’ll hear from the professor.'}</p>
                  ) : c.full ? (
                    <p className="text-sm text-muted-foreground">Auditor seats are full.</p>
                  ) : canAct(ctx) ? (
                    <NoteAction label="Ask to audit" sendLabel="Send request" placeholder="Why this course, in a line" run={A.requestAuditAction.bind(null, slug, c.id)} />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={BookOpen} title="No courses open to auditors this term" description="Faculty add courses each term. Check back." />
          )}
        </Section>
      )}
    </div>
  )
}

// ── Candidate › Give back ───────────────────────────────────────────────────

export async function CandidateGiveBack(props: Props) {
  const { ctx } = props
  const mods = await loadModules(ctx.institution.id)
  const slug = ctx.institution.slug
  const [roles, inst] = await Promise.all([
    mods.volunteer ? listVolunteerRoles(ctx.institution.id, ctx.memberId) : Promise.resolve([]),
    prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { givingUrl: true } }),
  ])
  const giving = inst.givingUrl
  return (
    <div className="space-y-8">
      {mods.volunteer && (
        <Section id="vol-h" title="Ways to give time" intro={`Interview applicants, speak to a class, or help your class stay in touch. Each one counts toward your ${ctx.institution.name} engagement.`}>
          {roles.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {roles.map((r) => (
                <li key={r.id} className={`${card} space-y-2`}>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{[label(VOLUNTEER_KINDS, r.kind), r.office, r.timeCommitment, r.slots ? `${Math.max(0, r.slots - r.taken)} of ${r.slots} spots left` : null].filter(Boolean).join(' · ')}</p>
                  {r.description && <p className="text-sm">{r.description}</p>}
                  {r.myStatus && r.myStatus !== 'WITHDREW' ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {r.myStatus === 'DONE' ? 'Done. Thank you.' : r.myStatus === 'CONFIRMED' ? 'Confirmed. The office will be in touch.' : 'Signed up. The office will confirm.'}
                      {r.myStatus !== 'DONE' && canAct(ctx) && <ActionButton label="Withdraw" variant="ghost" done="Withdrawn." run={A.volunteerSignupAction.bind(null, slug, r.id, '', true)} />}
                    </div>
                  ) : r.full ? (
                    <p className="text-sm text-muted-foreground">All spots are taken.</p>
                  ) : canAct(ctx) ? (
                    <NoteAction label="Sign up" sendLabel="Sign me up" placeholder="Anything the office should know (city, dates)" run={A.volunteerSignupAction.bind(null, slug, r.id)} />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={HandHeart} title="No volunteer roles posted right now" description="Admissions and Alumni Relations post roles here. Check back." />
          )}
        </Section>
      )}
      {mods.askAlumni && (
        <p className="text-sm">
          Another way to help:{' '}
          <Link className="font-medium text-primary underline" href={`/i/${slug}/candidate/network#ask-h`}>
            answer a question from a student or alum
          </Link>
          .
        </p>
      )}
      {mods.giveBack && giving && (
        <Section id="give-h" title="Make a gift">
          <a className="font-medium text-primary underline" href={giving} target="_blank" rel="noreferrer">
            Give to {ctx.institution.name}
          </a>
        </Section>
      )}
      {!mods.volunteer && !(mods.giveBack && giving) && <EmptyState icon={HandHeart} title="Nothing here yet" description="Your college hasn’t added ways to give back in the portal." />}
      {previewNote(ctx)}
    </div>
  )
}

// ── Candidate › Privacy: directory and data requests ────────────────────────

export async function PrivacyExtras({ ctx }: { ctx: WorkspaceContext }) {
  const mods = await loadModules(ctx.institution.id)
  const slug = ctx.institution.slug
  const listed = ctx.memberId && mods.directory ? await isListed(ctx.memberId) : false
  const open = ctx.memberId ? await prisma.dataRequest.findMany({ where: { memberId: ctx.memberId, status: 'OPEN' }, select: { kind: true, createdAt: true } }) : []
  return (
    <div className="space-y-6">
      {mods.directory && canAct(ctx) && (
        <Section id="pv-dir" title="Alumni directory">
          <ListedToggle slug={slug} listed={listed} />
        </Section>
      )}
      <Section id="pv-data" title="Your data at the college" intro={`See everything ${ctx.institution.name} holds about you in this portal, ask for a correction, or ask the college to delete its record. Your own NextChapter account stays yours either way.`}>
        {canAct(ctx) ? (
          <div className="flex flex-wrap items-start gap-3">
            <a href={`/i/${slug}/export/my-data`} className="inline-flex h-8 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-muted">
              Download my data (JSON)
            </a>
            <NoteAction label="Ask for a correction" sendLabel="Send to the college" placeholder="What’s wrong, and what it should say" run={A.memberDataRequest.bind(null, slug, 'CORRECT')} />
            <NoteAction label="Ask the college to delete my record" sendLabel="Send deletion request" placeholder="Optional: anything the college should know" run={A.memberDataRequest.bind(null, slug, 'DELETE')} />
          </div>
        ) : (
          previewNote(ctx)
        )}
        {open.length > 0 && <p className="text-xs text-muted-foreground">Open: {open.map((o) => `${o.kind.toLowerCase()} (sent ${fmt(o.createdAt)})`).join(', ')}.</p>}
      </Section>
    </div>
  )
}

// ── Alumni Relations › Community ────────────────────────────────────────────

export async function AlumniCommunity({ ctx }: Props) {
  const mods = await loadModules(ctx.institution.id)
  const id = ctx.institution.id
  const slug = ctx.institution.slug
  const write = !ctx.readOnly
  const [groups, ops, questions, news] = await Promise.all([
    listGroups(id, null),
    prisma.alumniOpportunity.findMany({ where: { institutionId: id, status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 40, include: { postedBy: { select: { firstName: true, lastName: true } }, _count: { select: { interests: true } } } }),
    listQuestions(id),
    prisma.collegeNewsPost.findMany({ where: { institutionId: id }, orderBy: { publishedAt: 'desc' }, take: 20 }),
  ])
  return (
    <div className="space-y-10">
      <Section id="ac-groups" title="Groups and chapters" intro="Affinity groups and regional chapters. Leaders are alumni; they can add events for their group from their own portal.">
        {!mods.groups && <OffNote ctx={ctx} what="Groups and chapters" />}
        {groups.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {groups.map((g) => (
              <li key={g.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {g.name} <span className="text-xs font-normal text-muted-foreground">{g.kind === 'chapter' ? `chapter${g.metro ? `, ${g.metro}` : ''}` : 'affinity'} · {g._count.members} members · leaders: {g.leaders.join(', ') || 'none yet'}</span>
                  </p>
                  {write && <ConfirmActionButton variant="outline" label="Archive" confirm={`Archive ${g.name}? Alumni stop seeing it; members and events stay on record.`} confirmLabel="Archive group" run={A.archiveGroup.bind(null, slug, g.id)} />}
                </div>
                {write && <LeaderForm slug={slug} groupId={g.id} />}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Users} title="No groups yet" description="Start with your biggest alumni city as a chapter, and one or two affinity groups alumni already ask about." />
        )}
        {write && (
          <details className={card} open={!groups.length}>
            <summary className="cursor-pointer text-sm font-semibold">Add a group or chapter</summary>
            <div className="mt-3">
              <GroupForm slug={slug} />
            </div>
          </details>
        )}
      </Section>

      <Section id="ac-news" title="College news" intro="Shown on every alum’s home page, newest first.">
        {!mods.news && <OffNote ctx={ctx} what="College news" />}
        {write && <NewsForm slug={slug} />}
        {news.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {news.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <span className="font-medium">{n.title}</span> <span className="text-muted-foreground">· {fmt(n.publishedAt)}</span>
                </span>
                {write && <ConfirmActionButton variant="outline" label="Remove" confirm="Remove this post from alumni home pages?" confirmLabel="Remove post" run={A.deleteNewsPost.bind(null, slug, n.id)} />}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="ac-proj" title="Projects and board seats" intro="Everything alumni have posted that’s open now. Post one for the college too (its own advisory boards, for example).">
        {!mods.projects && <OffNote ctx={ctx} what="Projects and boards" />}
        {ops.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {ops.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <span className="font-medium">{o.title}</span> · {o.organization} · {label(OPPORTUNITY_KINDS, o.kind)} ·{' '}
                  {o.postedBy ? [o.postedBy.firstName, o.postedBy.lastName].filter(Boolean).join(' ') : 'the college'} · {o._count.interests} interested
                </span>
                {write && <ConfirmActionButton variant="outline" label="Take down" confirm="Take this post down? The poster can’t reopen it." confirmLabel="Take down" run={A.closeOpportunity.bind(null, slug, o.id, 'CLOSED', 'staff')} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing open right now.</p>
        )}
        {write && (
          <details className={card}>
            <summary className="cursor-pointer text-sm font-semibold">Post one for the college</summary>
            <div className="mt-3">
              <OpportunityForm slug={slug} as="staff" />
            </div>
          </details>
        )}
      </Section>

      <Section id="ac-ask" title="Ask an alum: moderation" intro="Hide anything off-topic or unkind. Hidden posts stay on record.">
        {!mods.askAlumni && <OffNote ctx={ctx} what="Ask an alum" />}
        {questions.length ? (
          <ul className="space-y-2">
            {questions.map((q) => (
              <li key={q.id} className={`${card} space-y-2 text-sm`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p>
                    <span className="text-xs text-muted-foreground">{q.asker} · {q.topic}: </span>
                    {q.body}
                  </p>
                  {write && <ConfirmActionButton variant="outline" label="Hide" confirm="Hide this question and its answers?" confirmLabel="Hide question" run={A.hideQuestion.bind(null, slug, 'question', q.id)} />}
                </div>
                {q.answers.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-start justify-between gap-2 border-l-2 border-border pl-3">
                    <p>
                      {a.body} <span className="text-xs text-muted-foreground">({a.by})</span>
                    </p>
                    {write && <ConfirmActionButton variant="outline" label="Hide" confirm="Hide this answer?" confirmLabel="Hide answer" run={A.hideQuestion.bind(null, slug, 'answer', a.id)} />}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No questions yet.</p>
        )}
      </Section>
    </div>
  )
}

// ── Alumni Relations › Volunteers ───────────────────────────────────────────

export async function AlumniVolunteers({ ctx }: Props) {
  const mods = await loadModules(ctx.institution.id)
  const slug = ctx.institution.slug
  const write = !ctx.readOnly
  const roles = await prisma.volunteerRole.findMany({
    where: { institutionId: ctx.institution.id, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: { signups: { where: { status: { not: 'WITHDREW' } }, orderBy: { createdAt: 'asc' }, include: { member: { select: { firstName: true, lastName: true, classYear: true, email: true } } } } },
  })
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">Roles alumni can sign up for. Confirm each volunteer, then mark them done; done counts as volunteer engagement (for alumni who allow engagement tracking).</p>
      {!mods.volunteer && <OffNote ctx={ctx} what="Ways to give time" />}
      {roles.length ? (
        <ul className="space-y-3">
          {roles.map((r) => (
            <li key={r.id} className={`${card} space-y-2`}>
              <p className="font-medium">
                {r.title} <span className="text-xs font-normal text-muted-foreground">· {label(VOLUNTEER_KINDS, r.kind)} · {r.office} · {r.signups.length}{r.slots ? ` of ${r.slots}` : ''} signed up</span>
              </p>
              {r.signups.length ? (
                <ul className="space-y-1 text-sm">
                  {r.signups.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {[s.member.firstName, s.member.lastName].filter(Boolean).join(' ')}
                        {s.member.classYear ? ` ’${String(s.member.classYear).slice(2)}` : ''} · <a className="text-primary underline" href={`mailto:${s.member.email}`}>{s.member.email}</a>
                        {s.note && <span className="text-muted-foreground"> · {s.note}</span>}
                        <span className="text-xs text-muted-foreground"> · {s.status.toLowerCase().replace('_', ' ')}</span>
                      </span>
                      {write && s.status === 'SIGNED_UP' && <ActionButton label="Confirm" done="Confirmed." run={A.setVolunteerStatus.bind(null, slug, s.id, 'CONFIRMED')} />}
                      {write && s.status === 'CONFIRMED' && <ActionButton label="Mark done" done="Marked done." run={A.setVolunteerStatus.bind(null, slug, s.id, 'DONE')} />}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No sign-ups yet.</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={HandHeart} title="No volunteer roles yet" description="Add the asks you already make by email: admissions interviews, guest lectures, class agents." />
      )}
      {write && (
        <details className={card} open={!roles.length}>
          <summary className="cursor-pointer text-sm font-semibold">Add a volunteer role</summary>
          <div className="mt-3">
            <VolunteerRoleForm slug={slug} />
          </div>
        </details>
      )}
    </div>
  )
}

// ── Alumni Relations › Mentors: mentoring programs ──────────────────────────

export async function StaffCohorts({ ctx }: { ctx: WorkspaceContext }) {
  const mods = await loadModules(ctx.institution.id)
  const slug = ctx.institution.slug
  const write = !ctx.readOnly
  const cohorts = await prisma.mentoringCohort.findMany({ where: { institutionId: ctx.institution.id }, orderBy: { startsAt: 'desc' }, take: 6, include: { _count: { select: { signups: true, pairs: true } } } })
  const withMatches = await Promise.all(cohorts.map(async (c) => ({ ...c, unmatched: await suggestMatches(c.id) })))
  return (
    <Section id="staff-cohorts" title="Mentoring programs" intro="Open a program, alumni sign up as mentors or mentees, you match them. Each match emails both people with the other’s address.">
      {!mods.mentoringCohorts && <OffNote ctx={ctx} what="Mentoring programs" />}
      {withMatches.map((c) => (
        <div key={c.id} className={`${card} space-y-2`}>
          <p className="font-medium">
            {c.name} <span className="text-xs font-normal text-muted-foreground">· starts {fmt(c.startsAt)} · {c.weeks} weeks · {c._count.signups} signed up · {c._count.pairs} matched</span>
          </p>
          {c.unmatched.length ? (
            <ul className="space-y-2 text-sm">
              {c.unmatched.map((m) => (
                <li key={m.menteeId} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{m.mentee}</span>
                    {m.goals && <span className="text-muted-foreground"> · {m.goals}</span>}
                  </span>
                  {write && <MatchControl slug={slug} cohortId={c.id} menteeId={m.menteeId} suggested={m.mentorId} options={m.options} />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{c._count.signups ? 'Every mentee is matched.' : 'No sign-ups yet. Alumni see it on their Mentoring tab.'}</p>
          )}
        </div>
      ))}
      {write && (
        <details className={card} open={!cohorts.length}>
          <summary className="cursor-pointer text-sm font-semibold">Open a mentoring program</summary>
          <div className="mt-3">
            <CohortForm slug={slug} />
          </div>
        </details>
      )}
    </Section>
  )
}

// ── Teaching › Alumni auditors ──────────────────────────────────────────────

export async function TeachingAuditors({ ctx }: Props) {
  const mods = await loadModules(ctx.institution.id)
  const slug = ctx.institution.slug
  const admin = ctx.tokens.has('INSTITUTION_ADMIN')
  const mine = ctx.staffUsers.map((s) => s.id)
  const courses = await prisma.auditCourse.findMany({
    where: { institutionId: ctx.institution.id, isActive: true, ...(admin ? {} : { facultyUserId: { in: mine } }) },
    orderBy: { title: 'asc' },
    include: { faculty: { select: { fullName: true } }, requests: { orderBy: { createdAt: 'asc' }, include: { member: { select: { firstName: true, lastName: true, classYear: true, email: true } } } } },
  })
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">Open a course you already teach to a few alumni auditors. They sit in, with no grade and no credit; you approve each one.</p>
      {!mods.courseAuditing && <OffNote ctx={ctx} what="Course auditing" />}
      {courses.length ? (
        <ul className="space-y-3">
          {courses.map((c) => (
            <li key={c.id} className={`${card} space-y-2`}>
              <p className="font-medium">
                {c.courseCode ? `${c.courseCode}: ` : ''}
                {c.title} <span className="text-xs font-normal text-muted-foreground">· {c.term}{c.faculty?.fullName ? ` · ${c.faculty.fullName}` : ''} · {c.requests.filter((r) => r.status === 'APPROVED').length}{c.seats ? ` of ${c.seats}` : ''} approved</span>
              </p>
              {c.requests.length ? (
                <ul className="space-y-1 text-sm">
                  {c.requests.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {[r.member.firstName, r.member.lastName].filter(Boolean).join(' ')}
                        {r.member.classYear ? ` ’${String(r.member.classYear).slice(2)}` : ''}
                        {r.status === 'APPROVED' && <> · <a className="text-primary underline" href={`mailto:${r.member.email}`}>{r.member.email}</a></>}
                        {r.note && <span className="text-muted-foreground"> · {r.note}</span>}
                        <span className="text-xs text-muted-foreground"> · {r.status.toLowerCase()}</span>
                      </span>
                      {!ctx.readOnly && r.status === 'REQUESTED' && (
                        <span className="flex gap-2">
                          <ActionButton label="Approve" variant="default" done="Approved." run={A.decideAudit.bind(null, slug, r.id, true)} />
                          <ActionButton label="Decline" variant="ghost" done="Declined." run={A.decideAudit.bind(null, slug, r.id, false)} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No requests yet.</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={BookOpen} title="No courses open to auditors" description="Add one below. Two to five auditor seats is typical." />
      )}
      {!ctx.readOnly && (
        <details className={card} open={!courses.length}>
          <summary className="cursor-pointer text-sm font-semibold">Open a course to alumni auditors</summary>
          <div className="mt-3">
            <AuditCourseForm slug={slug} />
          </div>
        </details>
      )}
    </div>
  )
}

// ── Admin › Services: portal features ───────────────────────────────────────

export async function FeaturesPanel({ ctx }: { ctx: WorkspaceContext }) {
  const mods = await loadModules(ctx.institution.id)
  const canEdit = ctx.tokens.has('INSTITUTION_ADMIN') && !ctx.readOnly
  const areas = [...new Set(MODULES.map((m) => m.area))]
  return (
    <Section id="features" title="Portal features" intro="Switch any feature off and alumni stop seeing it (its tab or section disappears). Staff keep their screens, with a note that it’s off. Nothing is deleted.">
      <div className="grid gap-4 lg:grid-cols-2">
        {areas.map((area) => (
          <div key={area} className={card}>
            <h3 className="mb-2 text-sm font-semibold">{area}</h3>
            <ul className="space-y-3">
              {MODULES.filter((m) => m.area === area).map((m) => (
                <li key={m.key} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">{m.what}</span>
                  </span>
                  <ModuleToggle slug={ctx.institution.slug} moduleKey={m.key} on={mods[m.key as ModuleKey]} label={m.label} disabled={!canEdit} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {!canEdit && <p className="text-xs text-muted-foreground">Only a college admin can switch features.</p>}
    </Section>
  )
}

// ── Admin › Privacy requests ────────────────────────────────────────────────

export async function AdminPrivacy({ ctx, searchParams, base }: Props) {
  const slug = ctx.institution.slug
  const q = searchParams?.lookup?.trim() ?? ''
  const [requests, found] = await Promise.all([listRequests(ctx.institution.id), q ? findMembers(ctx.institution.id, q) : Promise.resolve([])])
  const write = !ctx.readOnly
  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-muted-foreground">
        FERPA and privacy requests. Alumni send these from their Privacy tab, or you log one for a request that came by phone or mail. Export gives everything the college holds about the person; delete removes the college’s record and keeps only a log line with the email.
      </p>
      <Section id="pr-open" title="Requests">
        {requests.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {requests.map((r) => (
              <li key={r.id} className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{r.kind === 'EXPORT' ? 'Export' : r.kind === 'CORRECT' ? 'Correction' : 'Deletion'}</span> · {r.email} · {fmt(r.createdAt)}
                    <span className="text-xs text-muted-foreground"> · {r.status === 'OPEN' ? 'open' : `done ${fmt(r.completedAt)} by ${r.completedBy}`}</span>
                  </span>
                  {write && r.status === 'OPEN' && (
                    <span className="flex flex-wrap gap-2">
                      {r.memberId && (
                        <a className="inline-flex h-8 items-center rounded-md border border-input px-3 text-sm hover:bg-muted" href={`/i/${slug}/export/member-data?memberId=${r.memberId}`}>
                          Download their data
                        </a>
                      )}
                      {r.kind === 'DELETE' && r.memberId ? (
                        <ConfirmActionButton variant="outline" label="Delete record" confirm={`Delete the college’s record of ${r.email}? This can’t be undone.`} confirmLabel="Delete permanently" run={A.deleteMemberAction.bind(null, slug, r.memberId, r.id)} />
                      ) : (
                        <ActionButton label="Mark done" done="Marked done." run={A.completeDataRequest.bind(null, slug, r.id)} />
                      )}
                    </span>
                  )}
                </div>
                {r.note && <p className="text-muted-foreground">{r.note}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={ShieldCheck} title="No requests" description="When an alum asks for their data, a correction or deletion, it shows here." />
        )}
      </Section>
      <Section id="pr-lookup" title="Look someone up" intro="By email, last name or student ID. For a request that didn’t come through the portal.">
        <form method="get" action={`${base}/privacy`} className="flex flex-wrap gap-2">
          <Input name="lookup" defaultValue={q} placeholder="Email, last name or ID (3+ characters)" aria-label="Look up a person" className="w-72" />
          <Button type="submit" variant="outline">
            Look up
          </Button>
        </form>
        {q && !found.length && <p className="text-sm text-muted-foreground">No one matches “{q}”.</p>}
        {found.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {found.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <span className="font-medium">{[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}</span> · {m.email}
                  {m.classYear ? ` · ’${String(m.classYear).slice(2)}` : ''} <span className="text-xs text-muted-foreground">· {m.status.toLowerCase()}</span>
                </span>
                {write && (
                  <span className="flex flex-wrap gap-2">
                    <a className="inline-flex h-8 items-center rounded-md border border-input px-3 text-sm hover:bg-muted" href={`/i/${slug}/export/member-data?memberId=${m.id}`}>
                      Download their data
                    </a>
                    <ConfirmActionButton variant="outline" label="Delete record" confirm={`Delete the college’s record of ${m.email}? This can’t be undone.`} confirmLabel="Delete permanently" run={A.deleteMemberAction.bind(null, slug, m.id, null)} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

