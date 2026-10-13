// Release 4 screens (HE-09, HE-11, HE-13): the alumni network and employers.
// Candidate: Mentors, Alumni jobs, intro requests. Alumni Relations: Mentors.
// Career Services: Employers. Employer: Shared Dossiers with intro
// requests, and their page and roles.

import Link from 'next/link'
import { Briefcase, Building2, Handshake, Star, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { listEmployerDossiers } from '@/lib/higher-ed/views'
import { alumniAtCompanies, countMentorInvitable } from '@/lib/higher-ed/mentor-network'
import { MentorStatsScreen } from './MentorStatsScreen'
import { collegeJobs, employerProfileFor, employerRoles, introStatusFor, listCollegeEmployers, pendingIntros } from '@/lib/higher-ed/employers'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { inviteStudents, sendMentorInvites } from '@/app/i/[slug]/(portal)/network-actions'
import { studentCounts } from '@/lib/higher-ed/students'
import { EmptyState } from '@/components/ui/empty-state'
import { StatTile } from './StatTile'
import { ConfirmActionButton } from './ConfirmActionButton'
import { EmployerDecision, EmployerRoleForm, IntroAnswerButtons, IntroAskButton } from './NetworkControls'

type Props = { ctx: WorkspaceContext; base: string; searchParams?: { q?: string } }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmt = (d: Date | null | undefined) => (d ? dateFmt.format(new Date(d)) : null)
const yr = (y: number | null) => (y ? ` '${String(y).slice(2)}` : '')

// ── Candidate › Alumni jobs ─────────────────────────────────────────────────

export async function CandidateJobs({ ctx }: Props) {
  const jobs = await collegeJobs(ctx.institution.id)
  const counts = await alumniAtCompanies(
    ctx.institution.id,
    jobs.map((j) => ({ companyId: j.companyId, normalized: j.normalized })),
  )
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Roles posted only for {ctx.institution.name} alumni. They aren&apos;t on any public job board.
      </p>
      {jobs.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {jobs.map((j) => {
            const n = counts.get(`${j.companyId ?? ''}|${j.normalized}`) ?? 0
            return (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    {j.featured && <Star className="size-4 fill-current text-primary" aria-label="Featured employer" />}
                    {j.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{[j.companyName, j.location].filter(Boolean).join(' · ')}</p>
                  {n > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                      <Users className="size-3" aria-hidden="true" />
                      {n} {ctx.institution.name} {n === 1 ? 'alum works' : 'alumni work'} here.{' '}
                      <Link href={`/i/${ctx.institution.slug}/candidate/mentors`} className="underline">
                        Ask a mentor
                      </Link>
                    </p>
                  )}
                </div>
                <a href={j.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                  View posting
                </a>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState icon={Briefcase} title="No alumni-only roles right now" description="Employers who hire your classmates post here first. Check back, or set up job alerts in NextChapter." />
      )}
    </div>
  )
}

// ── Candidate home: intro requests ──────────────────────────────────────────

export async function IntroRequestsCard({ ctx }: { ctx: WorkspaceContext }) {
  if (!ctx.memberId) return null
  const intros = await pendingIntros(ctx.memberId)
  if (!intros.length) return null
  return (
    <section aria-labelledby="intros" className="space-y-3 rounded-lg border border-primary/40 bg-card p-4">
      <h2 id="intros" className="text-base font-semibold">
        {intros.length === 1 ? 'An employer would like to meet you' : `${intros.length} employers would like to meet you`}
      </h2>
      <ul className="space-y-4">
        {intros.map((i) => (
          <li key={i.id} className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">{i.employerProfile.companyName}</span> saw the Dossier you share with employers.
              {i.note && <span className="block text-muted-foreground">&ldquo;{i.note}&rdquo;</span>}
            </p>
            {!ctx.readOnly && <IntroAnswerButtons slug={ctx.institution.slug} requestId={i.id} />}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Alumni Relations › Mentors ──────────────────────────────────────────────
// The activity counts are MentorStatsScreen's; this adds the invitation.

export async function AlumniMentors(props: Props) {
  const { ctx } = props
  const invitable = await countMentorInvitable(ctx.institution.id)
  const batch = Math.min(invitable, 100)
  return (
    <div className="space-y-6">
      <MentorStatsScreen {...(props as Parameters<typeof MentorStatsScreen>[0])} />
      {!ctx.readOnly && batch > 0 && (ctx.tokens.has('ALUMNI_RELATIONS') || ctx.tokens.has('INSTITUTION_ADMIN')) && (
        <section aria-labelledby="invite" className="space-y-2 rounded-lg border border-border bg-card p-4">
          <h2 id="invite" className="text-base font-semibold">
            Grow the network
          </h2>
          <p className="text-sm text-muted-foreground">
            {invitable.toLocaleString()} alumni five or more years out haven&apos;t been asked in the last six months. The email asks for one or two calls
            a month; they say yes in one click and pick their industries, no account needed.
          </p>
          <ConfirmActionButton
            label={`Invite ${batch} alumni to mentor`}
            confirm={ctx.institution.isDemo ? `Record ${batch} invitations? Nothing is emailed on a demo.` : `Email ${batch} alumni the mentor invitation from ${ctx.institution.name}?`}
            confirmLabel={ctx.institution.isDemo ? 'Record invitations' : 'Send invitations'}
            run={sendMentorInvites.bind(null, ctx.institution.slug)}
          />
        </section>
      )}
    </div>
  )
}

// ── Career Services › Employers ─────────────────────────────────────────────

const EMPLOYER_STATUS: Record<string, string> = { PENDING: 'Waiting for approval', APPROVED: 'Approved', REJECTED: 'Turned down' }

export async function CareerEmployers({ ctx }: Props) {
  const rows = await listCollegeEmployers(ctx.institution.id)
  const canEdit = !ctx.readOnly && ['CAREER_SERVICES', 'EMPLOYER_RELATIONS', 'INSTITUTION_ADMIN'].some((r) => ctx.tokens.has(r as 'CAREER_SERVICES'))
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Employers who asked to recruit {ctx.institution.name} alumni. Approved employers can post roles only your alumni see and ask to meet alumni who
        share their Dossier. Featured employers&apos; roles pin to the top. Send employers to{' '}
        <Link href={`/i/${ctx.institution.slug}/recruit`} className="text-primary hover:underline" target="_blank">
          /i/{ctx.institution.slug}/recruit
        </Link>{' '}
        to ask.
      </p>
      {rows.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{e.employerProfile.companyName}</p>
                <p className="text-xs text-muted-foreground">
                  {[e.employerProfile.companyIndustry, e.employerProfile.contactName, EMPLOYER_STATUS[e.status], `asked ${fmt(e.createdAt)}`].filter(Boolean).join(' · ')}
                  {e.packageTier === 'FEATURED' && e.featuredUntil && ` · featured until ${fmt(e.featuredUntil)}`}
                </p>
              </div>
              {canEdit && (
                <EmployerDecision
                  slug={ctx.institution.slug}
                  id={e.id}
                  status={e.status}
                  tier={e.packageTier}
                  featuredUntil={e.featuredUntil ? e.featuredUntil.toISOString().slice(0, 10) : null}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Building2} title="No employers yet" description="When an employer asks to recruit your alumni, they show up here for approval." />
      )}
    </div>
  )
}

// ── Employer › Shared Dossiers and page ─────────────────────────────────────

export async function EmployerDossiersWithIntros({ ctx }: Props) {
  const [rows, employerProfileId] = await Promise.all([listEmployerDossiers(ctx), employerProfileFor(ctx)])
  if (!rows.length) {
    return <EmptyState icon={Users} title="No shared Dossiers yet" description="Members appear here only after they choose to share their Dossier with employers." />
  }
  const status = employerProfileId ? await introStatusFor(employerProfileId, rows.map((r) => r.memberId)) : new Map()
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => {
        const s = status.get(r.memberId)
        return (
          <li key={r.memberId} className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div>
              <p className="font-semibold">{[r.firstName, r.lastName].filter(Boolean).join(' ')}</p>
              <p className="text-xs text-muted-foreground">{[r.classYear && `Class of ${r.classYear}`, r.degree, r.major].filter(Boolean).join(' · ')}</p>
              {r.dossierSummary && <p className="mt-2 text-sm">{r.dossierSummary}</p>}
            </div>
            {s?.status === 'ACCEPTED' && s.email ? (
              <p className="text-sm">
                Intro accepted:{' '}
                <a href={`mailto:${s.email}`} className="text-primary hover:underline">
                  {s.email}
                </a>
              </p>
            ) : employerProfileId && !ctx.readOnly ? (
              <IntroAskButton slug={ctx.institution.slug} memberId={r.memberId} done={s ? (s.status === 'DECLINED' ? 'They declined.' : 'Intro requested.') : null} />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

const ROLE_STATUS: Record<string, string> = { pending: 'In review', approved: 'Live', rejected: 'Not approved' }

export async function EmployerPage({ ctx }: Props) {
  const employerProfileId = await employerProfileFor(ctx)
  if (!employerProfileId) return <EmptyState icon={Building2} title="Not approved here yet" description="Career Services approves employers before they can post roles." />
  const [profile, link, roles] = await Promise.all([
    prisma.employerProfile.findUniqueOrThrow({ where: { id: employerProfileId }, select: { companyName: true, companyWebsite: true, companyIndustry: true, logoUrl: true } }),
    prisma.institutionEmployer.findUnique({
      where: { institutionId_employerProfileId: { institutionId: ctx.institution.id, employerProfileId } },
      select: { packageTier: true, featuredUntil: true },
    }),
    employerRoles(ctx.institution.id, employerProfileId),
  ])
  const counts = await alumniAtCompanies(ctx.institution.id, [{ companyId: null, normalized: normalizeOrgName(profile.companyName) }])
  const alumni = [...counts.values()][0] ?? 0
  const featured = link?.packageTier === 'FEATURED' && link.featuredUntil && link.featuredUntil > new Date()
  return (
    <div className="space-y-6">
      <section aria-label="Your page" className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
        {profile.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- employer-hosted logo
          <img src={profile.logoUrl} alt="" className="size-12 rounded object-contain" />
        )}
        <div>
          <p className="font-semibold">{profile.companyName}</p>
          <p className="text-sm text-muted-foreground">
            {[profile.companyIndustry, profile.companyWebsite, alumni > 0 && `${alumni} ${ctx.institution.name} ${alumni === 1 ? 'alum' : 'alumni'} on your team`, featured && `Featured until ${fmt(link!.featuredUntil)}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </section>
      {!ctx.readOnly && (
        <section aria-labelledby="post-role" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="post-role" className="text-base font-semibold">
            Post a role for {ctx.institution.name} alumni
          </h2>
          <EmployerRoleForm slug={ctx.institution.slug} />
        </section>
      )}
      <section aria-labelledby="roles" className="space-y-2">
        <h2 id="roles" className="text-base font-semibold">
          Your roles here
        </h2>
        {roles.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {roles.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 p-3">
                <span>
                  {r.title}
                  {r.location ? ` · ${r.location}` : ''}
                </span>
                <span className="text-muted-foreground">
                  {ROLE_STATUS[r.status] ?? r.status} · {fmt(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No roles yet.</p>
        )}
      </section>
    </div>
  )
}

// ── Career Services › Student tools ─────────────────────────────────────────

export async function CareerStudents({ ctx }: Props) {
  const c = await studentCounts(ctx.institution.id)
  const batch = Math.min(c.invitable, 100)
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Students and alumni who graduated in the last five years. Add students through the roster CSV with affiliation STUDENT (Admin › Roster, or your
        Handshake export). They get a first-job invitation, then the 6, 18 and 24-month check-ins.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Students on the roster" value={c.students.toLocaleString()} />
        <StatTile label="Recent grads" value={c.recentGrads.toLocaleString()} />
        <StatTile label="Joined" value={c.joined.toLocaleString()} />
        <StatTile label="Not invited yet" value={c.invitable.toLocaleString()} />
      </div>
      {!ctx.readOnly && batch > 0 ? (
        <ConfirmActionButton
          label={`Invite ${batch} students and recent grads`}
          confirm={ctx.institution.isDemo ? `Record ${batch} invitations? Nothing is emailed on a demo.` : `Email ${batch} students and recent grads a one-click invitation from ${ctx.institution.name} Career Services?`}
          confirmLabel={ctx.institution.isDemo ? 'Record invitations' : 'Send invitations'}
          run={inviteStudents.bind(null, ctx.institution.slug)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Everyone has been invited or has joined.</p>
      )}
    </div>
  )
}
