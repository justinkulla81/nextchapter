// The built HE-03 screens, keyed `${workspace}:${tab}`. Staff screens read
// candidate data ONLY through src/lib/higher-ed/views.ts (consent applied in
// SQL, role checked again there), never Prisma models directly. Tabs with no
// entry render a "coming in HE-xx" panel from COMING_DESCRIPTIONS.

import Link from 'next/link'
import type { ComponentType } from 'react'
import { ArrowRight, Lock, Users } from 'lucide-react'
import type { InstitutionMemberStatus, InstitutionUserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import {
  getAlumniHomeCounts,
  getRoiInputs,
  listCaseloadActivity,
  listEmployerDossiers,
  listMemberDirectory,
  listOpenTransitions,
} from '@/lib/higher-ed/views'
import { STAFF_ROLE_LABELS } from '@/lib/higher-ed/workspaces'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DoNotSolicitBadge } from './DoNotSolicitBadge'
import { StatTile } from './StatTile'
import { RegionScreen } from './RegionScreen'
import { ServicesPanel } from './ServicesPanel'
import { readProfile, type InstitutionProfile } from '@/lib/higher-ed/profile'
import { checkInMonthFrom, memberAudiences, memberCards, PROGRAM_IDEAS, serviceSettingsFrom } from '@/lib/higher-ed/services'
import { serviceUsage30d } from '@/lib/higher-ed/service-usage'
import { setAnnualCheckInMonth } from '@/app/i/[slug]/(portal)/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { AlumniJobForm } from '@/components/institution/AlumniJobForm'
import { TargetCompanyForm } from '@/components/institution/TargetCompanyForm'
import { StaffInviteForm } from './StaffInviteForm'
import { BrandingForm } from './BrandingForm'
import { CareerStatusCard } from './CareerStatusCard'
import { PrivacyPanel } from './PrivacyPanel'
import { CrmUploadForm } from './CrmUploadForm'
import { InviteAlumniButton } from './InviteAlumniButton'
import { CollegeSettingsForm } from './CollegeSettingsForm'
import { listProfileViews } from '@/lib/higher-ed/audit'
import { countInvitable } from '@/lib/higher-ed/invites'
import { graceDaysFrom } from '@/lib/higher-ed/transition'
import { CheckCircle2, Circle } from 'lucide-react'
import { listTargetCompanies } from '@/lib/companies/institution-targets'
import { canAny } from '@/lib/institution/permissions'
import { archiveAlumniJob, addTargetCompany, inviteStaff, postAlumniJob, removeTargetCompany, saveBranding, saveCollegeSettings, uploadCrmFile } from '@/app/i/[slug]/(portal)/staff-actions'

export type ScreenSearchParams = { q?: string; page?: string; status?: string; transition?: string }
type ScreenProps = { ctx: WorkspaceContext; searchParams: ScreenSearchParams; base: string }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmtDate = (d: Date | null) => (d ? dateFmt.format(new Date(d)) : null)
const fullName = (r: { firstName: string | null; lastName: string | null }) =>
  [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Unnamed'

const STATUS_LABELS: Record<InstitutionMemberStatus, string> = {
  IMPORTED: 'Imported',
  INVITED: 'Invited',
  CLAIMED: 'Claimed',
  ACTIVE: 'Active',
  OPTED_OUT: 'Opted out',
}

function NotShared() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Lock className="size-3" aria-hidden="true" />
      Not shared
    </span>
  )
}

function Table({ head, children, caption }: { head: string[]; children: React.ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  )
}

async function loadInstitutionData(institutionId: string) {
  const i = await prisma.institution.findUnique({ where: { id: institutionId }, select: { profile: true, enabledFeatures: true } })
  return { profile: readProfile(i?.profile), enabledFeatures: i?.enabledFeatures ?? {} }
}

function PhotoStrip({ profile, limit = 4 }: { profile: InstitutionProfile; limit?: number }) {
  const photos = (profile.photos ?? []).slice(0, limit)
  if (!photos.length) return null
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {photos.map((p) => (
        <figure key={p.url} className="overflow-hidden rounded-lg border border-border bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote college/Wikimedia photo */}
          <img src={p.url} alt={p.alt} className="aspect-[4/3] w-full object-cover" loading="lazy" />
          {p.credit && (
            <figcaption className="px-2 py-1 text-[10px] text-muted-foreground">
              {p.pageUrl ? (
                <a href={p.pageUrl} target="_blank" rel="noreferrer" className="hover:underline">
                  {p.credit}
                </a>
              ) : (
                p.credit
              )}
              {p.license ? ` · ${p.license}` : ''}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}

// ── Candidate ───────────────────────────────────────────────────────────────

const CANDIDATE_TOOLS = [
  { label: 'Market Reality Grade', href: '/dashboard/market-reality', what: 'Where your search stands against the market, graded weekly.' },
  { label: 'Search Action Plan', href: '/dashboard', what: 'The next moves that will change your grade.' },
  { label: 'Weekly Search Sprint', href: '/dashboard/sprint', what: "This week's committed actions." },
  { label: 'Dossier', href: '/dashboard/recruiter-report', what: 'Your verified, reference-backed profile for employers.' },
  { label: 'Support Network', href: '/dashboard/network', what: 'The people who can help, organized.' },
]

async function CandidateHome({ ctx }: ScreenProps) {
  const member = ctx.memberId
    ? await prisma.institutionMember.findUnique({ where: { id: ctx.memberId }, select: { firstName: true, affiliation: true, classYear: true } })
    : null
  const brand = ctx.institution.programBrandName ?? ctx.institution.name
  const { profile, enabledFeatures } = await loadInstitutionData(ctx.institution.id)
  // The college's switched-on services for this member's audiences (a
  // preview with no member record sees them all). Each card counts its opens.
  const services = memberCards(serviceSettingsFrom(enabledFeatures), member ? memberAudiences(member) : null)
  const openFlag = ctx.memberId
    ? await prisma.transitionFlag.findUnique({ where: { openFlagMemberId: ctx.memberId }, select: { state: true } })
    : null
  const hero = profile.heroImageUrl ? { url: profile.heroImageUrl, alt: `${ctx.institution.name} campus`, credit: null } : profile.photos?.[0]
  const career = profile.college?.careerCenter
  return (
    <div className="space-y-6">
      {hero && (
        <figure className="relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote college/Wikimedia photo */}
          <img src={hero.url} alt={hero.alt} className="h-44 w-full object-cover sm:h-56" />
          {hero.credit && <figcaption className="absolute right-2 bottom-1 rounded bg-black/50 px-1.5 text-[10px] text-white">{hero.credit}</figcaption>}
        </figure>
      )}
      <div>
        <h2 className="text-lg font-semibold">{member?.firstName ? `Welcome back, ${member.firstName}` : `Welcome to ${brand}`}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ctx.institution.name} has your back: a clear read on your job market, a plan for this week, coaching and alumni who&apos;ll take
          your call. Your search stays yours; the college sees only what you choose to share.
        </p>
        {!ctx.memberId && ctx.isNcAdmin && (
          <p className="mt-2 text-sm text-amber-900">You&apos;re previewing as an alum. There&apos;s no member record behind this preview.</p>
        )}
      </div>
      <CareerStatusCard slug={ctx.institution.slug} collegeName={ctx.institution.name} flag={openFlag?.state === 'CLEARED' ? null : (openFlag?.state ?? null)} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {CANDIDATE_TOOLS.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className="group flex h-full flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary">
              <span className="flex items-center justify-between text-sm font-semibold">
                {t.label}
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
              </span>
              <span className="mt-1 text-sm text-muted-foreground">{t.what}</span>
            </Link>
          </li>
        ))}
      </ul>
      {services.length > 0 && (
        <section aria-labelledby="college-services" className="space-y-2">
          <h2 id="college-services" className="text-base font-semibold">
            From {ctx.institution.name}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {services.map((sv) => (
              <li key={sv.key}>
                <Link
                  href={`/i/${ctx.institution.slug}/go/${sv.key}`}
                  className="group flex h-full flex-col rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary"
                >
                  <span className="flex items-center justify-between text-sm font-medium">
                    {sv.name}
                    <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                  </span>
                  <span className="text-xs text-muted-foreground">{sv.pitch}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {career && (
        <p className="text-sm text-muted-foreground">
          Questions? {career.name}
          {career.email ? ` · ${career.email}` : ''}
          {career.phone ? ` · ${career.phone}` : ''}
        </p>
      )}
    </div>
  )
}

// ── Alumni Relations ────────────────────────────────────────────────────────

async function AlumniHome({ ctx, base }: ScreenProps) {
  const c = await getAlumniHomeCounts(ctx)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Members" value={c.members.toLocaleString()} href={`${base}/members`} />
        <StatTile label="Claimed" value={c.claimed.toLocaleString()} href={`${base}/members?status=CLAIMED`} />
        <StatTile label="Active seats" value={c.activeSeats.toLocaleString()} />
        <StatTile label="In transition" value={c.inTransition.toLocaleString()} href={`${base}/members?transition=1`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="New layoff matches" value="—" note="Arrives in HE-08" />
        <StatTile label="Mentor requests this month" value="—" note="Arrives in HE-09" />
      </div>
    </div>
  )
}

async function AlumniMembers({ ctx, searchParams, base }: ScreenProps) {
  if (searchParams.transition === '1') {
    const rows = await listOpenTransitions(ctx)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} members in transition.{' '}
          <Link href={`${base}/members`} className="font-medium text-primary hover:underline">
            Show all members
          </Link>
        </p>
        <TransitionTable rows={rows} />
      </div>
    )
  }

  const status = searchParams.status && searchParams.status in STATUS_LABELS ? (searchParams.status as InstitutionMemberStatus) : undefined
  const page = Number(searchParams.page) || 1
  const { rows, total, pageSize } = await listMemberDirectory(ctx, { q: searchParams.q, status, page })
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const qs = (p: number) => {
    const s = new URLSearchParams()
    if (searchParams.q) s.set('q', searchParams.q)
    if (status) s.set('status', status)
    if (p > 1) s.set('page', String(p))
    const str = s.toString()
    return `${base}/members${str ? `?${str}` : ''}`
  }

  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="member-q">Search by name</Label>
          <Input id="member-q" name="q" defaultValue={searchParams.q ?? ''} placeholder="e.g. Jordan" className="w-56" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="member-status">Status</Label>
          <select id="member-status" name="status" defaultValue={status ?? ''} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Any status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filter members
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No members match" description="Try a different name or status, or import a roster (HE-05)." />
      ) : (
        <Table caption="Members" head={['Name', 'Class', 'Status', 'Employer', 'Title', 'Engagement (12 mo)']}>
          {rows.map((r) => (
            <tr key={r.memberId}>
              <td className="px-4 py-2 font-medium">{fullName(r)}</td>
              <td className="px-4 py-2 tabular-nums">{r.classYear ?? '—'}</td>
              <td className="px-4 py-2">{STATUS_LABELS[r.status]}</td>
              <td className="px-4 py-2">{r.shareOutcome ? (r.employer ?? '—') : <NotShared />}</td>
              <td className="px-4 py-2">{r.shareOutcome ? (r.title ?? '—') : <NotShared />}</td>
              <td className="px-4 py-2 tabular-nums">{r.shareEngagement ? `${r.engagementPoints12mo ?? 0} pts` : <NotShared />}</td>
            </tr>
          ))}
        </Table>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total.toLocaleString()} members · page {Math.min(page, pages)} of {pages}
        </span>
        <span className="flex gap-3">
          {page > 1 && (
            <Link href={qs(page - 1)} className="font-medium text-primary hover:underline">
              Previous page
            </Link>
          )}
          {page < pages && (
            <Link href={qs(page + 1)} className="font-medium text-primary hover:underline">
              Next page
            </Link>
          )}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Employer, title and engagement show only for members who share them. No job-search details are ever shown here.
      </p>
    </div>
  )
}

function TransitionTable({ rows }: { rows: Awaited<ReturnType<typeof listOpenTransitions>> }) {
  if (rows.length === 0) {
    return <EmptyState icon={Users} title="No one is in transition" description="Open flags appear here, without reasons or search details." />
  }
  return (
    <Table caption="Members in transition" head={['Name', 'Class', 'Since', 'Solicitation']}>
      {rows.map((r) => (
        <tr key={r.flagId}>
          <td className="px-4 py-2 font-medium">{fullName(r)}</td>
          <td className="px-4 py-2 tabular-nums">{r.classYear ?? '—'}</td>
          <td className="px-4 py-2">{fmtDate(r.since)}</td>
          <td className="px-4 py-2">{r.doNotSolicit ? <DoNotSolicitBadge /> : 'OK to solicit'}</td>
        </tr>
      ))}
    </Table>
  )
}

// ── Development ─────────────────────────────────────────────────────────────

async function DevelopmentHome({ ctx }: ScreenProps) {
  const roi = await getRoiInputs(ctx)
  if (!roi) return null
  const dollars = Number(roi.giftCents) / 100
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Members" value={roi.memberCount.toLocaleString()} />
        <StatTile label="Claimed" value={roi.claimedCount.toLocaleString()} />
        <StatTile label="Active seats" value={roi.activeSeatCount.toLocaleString()} />
        <StatTile label="In transition" value={roi.openFlagCount.toLocaleString()} />
        <StatTile label="Gifts imported" value={roi.giftCount.toLocaleString()} />
        <StatTile label="Gift dollars imported" value={dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} />
      </div>
      <p className="text-xs text-muted-foreground">
        As of last gift import: {fmtDate(roi.lastGiftImportAt) ?? 'none yet'}. Giving rate, lift and donor counts by fiscal year arrive in HE-10.
      </p>
    </div>
  )
}

async function DevelopmentTransition({ ctx }: ScreenProps) {
  const rows = await listOpenTransitions(ctx)
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Members with an open transition flag. Reasons, sources and search details are never shown here. One-click suppression-list export arrives in HE-10.
      </p>
      <TransitionTable rows={rows} />
    </div>
  )
}

// ── Career Services ─────────────────────────────────────────────────────────

async function CareerCaseload({ ctx }: ScreenProps) {
  const rows = await listCaseloadActivity(ctx)
  if (rows.length === 0) {
    return <EmptyState icon={Users} title="No one on this caseload" description="Assigning members arrives in HE-11." />
  }
  return (
    <div className="space-y-3">
      <Table caption="Caseload" head={['Name', 'Class', 'Last activity', 'Weekly Search Sprint', 'Next check-in']}>
        {rows.map((r) => (
          <tr key={r.assignmentId}>
            <td className="px-4 py-2 font-medium">{fullName(r)}</td>
            <td className="px-4 py-2 tabular-nums">{r.classYear ?? '—'}</td>
            <td className="px-4 py-2">{r.shareSearchDetail ? (fmtDate(r.lastActivityAt) ?? 'No activity yet') : <NotShared />}</td>
            <td className="px-4 py-2">
              {!r.shareSearchDetail ? (
                <NotShared />
              ) : r.sprintActionsTotal === null ? (
                'No sprint yet'
              ) : (
                `${r.sprintActionsDone} of ${r.sprintActionsTotal} done`
              )}
            </td>
            <td className="px-4 py-2">{r.nextCheckInAt ? `${r.nextCheckInKind} · ${fmtDate(r.nextCheckInAt)}` : '—'}</td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-muted-foreground">Search details show only for members who share them with Career Services.</p>
    </div>
  )
}

// ── Employer ────────────────────────────────────────────────────────────────

async function EmployerDossiers({ ctx }: ScreenProps) {
  const rows = await listEmployerDossiers(ctx)
  if (rows.length === 0) {
    return <EmptyState icon={Users} title="No shared Dossiers yet" description="Members appear here only after they choose to share their Dossier with employers." />
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <li key={r.memberId} className="rounded-lg border border-border bg-card p-4">
          <p className="font-semibold">{fullName(r)}</p>
          <p className="text-xs text-muted-foreground">
            {[r.classYear && `Class of ${r.classYear}`, r.degree, r.major].filter(Boolean).join(' · ')}
          </p>
          {r.dossierSummary && <p className="mt-2 text-sm">{r.dossierSummary}</p>}
        </li>
      ))}
    </ul>
  )
}

// ── Local market (Alumni Relations, Development, Career Services) ───────────

async function Region({ ctx }: ScreenProps) {
  const { profile } = await loadInstitutionData(ctx.institution.id)
  return <RegionScreen profile={profile} />
}


// ── Alumni jobs (Alumni Relations, Career Services) and target companies ────
// Moved from the first /institution portal (commit 2f6bda08); permissions
// are its capability map (src/lib/institution/permissions.ts).

const JOB_STATUS: Record<string, string> = { pending: 'Awaiting review', approved: 'Live for alumni', rejected: 'Not approved' }

async function AlumniJobs({ ctx }: ScreenProps) {
  const slug = ctx.institution.slug
  const canPost = canAny(ctx.tokens, 'post_jobs') && !ctx.readOnly
  const jobs = await prisma.exclusiveJobPosting.findMany({
    where: { institutionScopeId: ctx.institution.id, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, title: true, companyName: true, location: true, status: true },
  })
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Roles only {ctx.institution.name} alumni on NextChapter can see. They never appear on the open job board.
      </p>
      {canPost && <AlumniJobForm postAction={postAlumniJob.bind(null, slug, ctx.workspace)} />}
      {jobs.length === 0 ? (
        <EmptyState icon={Users} title="No alumni jobs yet" description="Post a role above; a NextChapter admin reviews it before alumni see it." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium">{j.title}</p>
                <p className="text-sm text-muted-foreground">{[j.companyName, j.location, JOB_STATUS[j.status] ?? j.status].filter(Boolean).join(' · ')}</p>
              </div>
              {canPost && (
                <form action={archiveAlumniJob.bind(null, slug, ctx.workspace, j.id)}>
                  <SubmitButton size="sm" variant="outline" pendingLabel="Removing…" savedLabel="Removed">
                    Remove posting
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

async function TargetCompanies({ ctx }: ScreenProps) {
  const slug = ctx.institution.slug
  const canManage = canAny(ctx.tokens, 'manage_target_companies') && !ctx.readOnly
  const targets = await listTargetCompanies(ctx.institution.id)
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Employers you want to place alumni with or build a relationship with. Only your team sees this list.
      </p>
      {canManage && <TargetCompanyForm addAction={addTargetCompany.bind(null, slug)} />}
      {targets.length === 0 ? (
        <EmptyState icon={Users} title="No target companies yet" description="Add the employers you want alumni at." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {targets.map((t) => (
            <li key={t.companyId} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-muted-foreground">{[t.industry, t.note].filter(Boolean).join(' · ')}</p>
              </div>
              {canManage && (
                <form action={removeTargetCompany.bind(null, slug, t.companyId)}>
                  <SubmitButton size="sm" variant="outline" pendingLabel="Removing…" savedLabel="Removed">
                    Remove company
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Coaching ────────────────────────────────────────────────────────────────

async function StaffRoster({ ctx, roles, empty }: { ctx: WorkspaceContext; roles: ('COACH' | 'CAREER_SERVICES' | 'FACULTY' | 'EXEC_ED')[]; empty: string }) {
  const staff = await prisma.institutionUser.findMany({
    where: { institutionId: ctx.institution.id, role: { in: roles }, revokedAt: null },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    select: { id: true, fullName: true, invitedEmail: true, role: true, acceptedAt: true },
  })
  if (staff.length === 0) return <EmptyState icon={Users} title="No one here yet" description={empty} />
  return (
    <Table caption="Staff" head={['Name', 'Role', 'Status']}>
      {staff.map((s) => (
        <tr key={s.id}>
          <td className="px-4 py-2 font-medium">{s.fullName ?? s.invitedEmail}</td>
          <td className="px-4 py-2">{STAFF_ROLE_LABELS[s.role]}</td>
          <td className="px-4 py-2">{s.acceptedAt ? 'Active' : 'Invited'}</td>
        </tr>
      ))}
    </Table>
  )
}

// Sessions attributed to this college (CoachSession.institutionId). Dates
// and durations only: coaching notes are never shown to college staff.
async function CoachingSessions({ ctx }: ScreenProps) {
  const sessions = await prisma.coachSession.findMany({
    where: { institutionId: ctx.institution.id },
    orderBy: { occurredAt: 'desc' },
    take: 50,
    select: {
      id: true,
      occurredAt: true,
      durationMinutes: true,
      sessionType: true,
      coach: { select: { fullName: true } },
      candidate: { select: { firstName: true, lastName: true } },
    },
  })
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        One-to-one coaching for {ctx.institution.name} alumni and students, by your counselors and NextChapter coaches. Dates only; session
        notes stay between the coach and the member.
      </p>
      {sessions.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No coaching sessions yet"
          description="Sessions appear here once members book them. Booking and paid packages arrive in HE-14; Resilience Fund awards show as prepaid."
        />
      ) : (
        <Table caption="Coaching sessions" head={['Date', 'Member', 'Coach', 'Length']}>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-2">{fmtDate(s.occurredAt)}</td>
              <td className="px-4 py-2 font-medium">{fullName(s.candidate)}</td>
              <td className="px-4 py-2">{s.coach.fullName}</td>
              <td className="px-4 py-2">{s.durationMinutes ? `${s.durationMinutes} min` : '—'}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}

// The college's own coaches: Coach rows linked to it. They work in the
// NextChapter coach portal; members see them first when choosing a coach.
async function CollegeCoaches({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const coaches = await prisma.coach.findMany({
    where: { institutionId },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, focus: true, industries: true, _count: { select: { clients: true } } },
  })
  return (
    <section aria-labelledby="college-coaches" className="space-y-2">
      <h2 id="college-coaches" className="text-base font-semibold">
        {institutionName} coaches
      </h2>
      {coaches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          None yet. Invite a coach from Admin › Staff with the Coach role: they get the NextChapter coach portal, tied to {institutionName}.
          Members can also choose NextChapter&apos;s coaches.
        </p>
      ) : (
        <Table caption="College coaches" head={['Coach', 'Focus', 'Clients']}>
          {coaches.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2 font-medium">{c.fullName}</td>
              <td className="px-4 py-2">{[c.focus.toLowerCase(), ...c.industries.slice(0, 2)].join(' · ')}</td>
              <td className="px-4 py-2 tabular-nums">{c._count.clients}</td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  )
}

async function CareerCoaching(props: ScreenProps) {
  return (
    <div className="space-y-8">
      <CoachingSessions {...props} />
      <CollegeCoaches institutionId={props.ctx.institution.id} institutionName={props.ctx.institution.name} />
    </div>
  )
}

// Candidate › Coaching: members choose and book coaches in the NextChapter
// candidate portal; this points them there and shows their college's coaches.
async function CandidateCoaching({ ctx }: ScreenProps) {
  const coaches = await prisma.coach.findMany({
    where: { institutionId: ctx.institution.id },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, focus: true, industries: true },
  })
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        One-to-one coaching from {ctx.institution.name}&apos;s own coaches and NextChapter&apos;s. Answer a few questions and we&apos;ll suggest
        the best fit, with your college&apos;s coaches first.
      </p>
      <Button nativeButton={false} render={<Link href="/dashboard/coaching-match" />}>
        Choose a coach
      </Button>
      {coaches.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {coaches.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-3">
              <p className="text-sm font-medium">{c.fullName}</p>
              <p className="text-xs text-muted-foreground">{[`${ctx.institution.name} coach`, ...c.industries.slice(0, 2)].join(' · ')}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Teaching and Exec Ed ────────────────────────────────────────────────────
// Connected: Exec Ed programs are taught by the faculty in Teaching, and
// Teaching shows the programs its faculty deliver. Both read the programs in
// the Services catalog; courses, cohorts and enrollment are V2 (spec §13).

async function ProgramList({ ctx, linkTeaching }: { ctx: WorkspaceContext; linkTeaching: boolean }) {
  const faculty = await prisma.institutionUser.count({ where: { institutionId: ctx.institution.id, role: 'FACULTY', revokedAt: null } })
  const base = `/i/${ctx.institution.slug}`
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        A starting catalog. Programs, cohorts, enrollment and payers (self-pay, employer, Resilience Fund, or WIOA if you opt in) arrive with V2.{' '}
        {linkTeaching ? (
          <>
            Taught by your faculty:{' '}
            <Link href={`${base}/teaching/faculty`} className="font-medium text-primary hover:underline">
              {faculty} in Teaching
            </Link>
            .
          </>
        ) : null}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PROGRAM_IDEAS.map((p) => (
          <li key={p.key} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-semibold">{p.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{p.summary}</p>
            <p className="mt-1 text-xs text-muted-foreground">For: {p.audience}</p>
            {p.examples?.length ? (
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <li className="font-medium">Done elsewhere:</li>
                {p.examples.map((e) => (
                  <li key={e.url}>
                    <a href={e.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                      {e.institution}
                    </a>
                    {` · ${e.name}`}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

async function ExecEdPrograms({ ctx }: ScreenProps) {
  return <ProgramList ctx={ctx} linkTeaching />
}

async function TeachingCourses({ ctx }: ScreenProps) {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Credit courses, sections and coursework arrive with V2 programs. For now, these are the programs your faculty would teach, the same list Exec Ed sells.
      </p>
      <ProgramList ctx={ctx} linkTeaching={false} />
    </div>
  )
}

async function TeachingFaculty({ ctx }: ScreenProps) {
  return <StaffRoster ctx={ctx} roles={['FACULTY', 'EXEC_ED']} empty="Invite faculty and Exec Ed staff from Admin › Staff." />
}

// ── Candidate › Privacy & sharing ───────────────────────────────────────────

const CONSENT_COPY: Record<string, { label: (c: string) => string; help: string }> = {
  SHARE_OUTCOME: { label: (c) => `Tell ${c} when I land a job`, help: 'Your new employer and title. Nothing about your search.' },
  SHARE_SEARCH_DETAIL_WITH_CAREER: { label: () => 'Let Career Services see my progress', help: 'Weekly progress and activity, so a counselor can help. Never assessments or messages.' },
  SHARE_ENGAGEMENT: { label: (c) => `Count my activity toward ${c}'s alumni engagement`, help: 'That you used the tools and took calls, as totals. Never what you did in them.' },
  SHARE_DOSSIER_WITH_EMPLOYERS: { label: (c) => `Show my Dossier to employers ${c} approves`, help: 'Employers that hire through your college can see your Dossier and ask for an introduction. You say yes or no each time.' },
}

async function CandidatePrivacy({ ctx }: ScreenProps) {
  if (!ctx.memberId) {
    return <p className="text-sm text-muted-foreground">This is a preview: there&apos;s no member record, so there are no settings to show.</p>
  }
  const [consent] = await prisma.$queryRaw<{ shareEngagement: boolean; shareOutcome: boolean; shareSearchDetail: boolean; shareDossier: boolean }[]>`
    select "shareEngagement", "shareOutcome", "shareSearchDetail", "shareDossier" from private.v_member_consent where "memberId" = ${ctx.memberId}`
  const granted: Record<string, boolean> = {
    SHARE_OUTCOME: consent?.shareOutcome ?? true,
    SHARE_SEARCH_DETAIL_WITH_CAREER: consent?.shareSearchDetail ?? false,
    SHARE_ENGAGEMENT: consent?.shareEngagement ?? true,
    SHARE_DOSSIER_WITH_EMPLOYERS: consent?.shareDossier ?? false,
  }
  const views = await listProfileViews(ctx.memberId)
  const rows = Object.entries(CONSENT_COPY).map(([scope, c]) => ({ scope, label: c.label(ctx.institution.name), help: c.help, granted: granted[scope] }))
  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Your job search belongs to you. {ctx.institution.name} sees only what you switch on here, and never your assessments, coaching notes or
        messages.
      </p>
      <PrivacyPanel slug={ctx.institution.slug} rows={rows} />
      <section aria-labelledby="who-viewed" className="space-y-2">
        <h2 id="who-viewed" className="text-base font-semibold">
          Who viewed my profile
        </h2>
        {views.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one at {ctx.institution.name} has opened your record.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {views.map((v, i) => (
              <li key={i} className="flex justify-between px-4 py-2">
                <span>{v.workspace.replace(/^\w/, (c) => c.toUpperCase())} office</span>
                <span className="text-muted-foreground">{fmtDate(v.viewedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Admin ───────────────────────────────────────────────────────────────────

const ROSTER_COLUMNS = 'external_id, email, first_name, last_name, affiliation, class_year, degree, major, employer, title, do_not_contact'
const GIFT_COLUMNS = 'external_id, gift_date, amount, fund, appeal'

async function AdminRoster({ ctx }: ScreenProps) {
  const slug = ctx.institution.slug
  const [members, joined, invitable, runs] = await Promise.all([
    prisma.institutionMember.count({ where: { institutionId: ctx.institution.id } }),
    prisma.institutionMember.count({ where: { institutionId: ctx.institution.id, status: { in: ['CLAIMED', 'ACTIVE'] } } }),
    countInvitable(ctx.institution.id),
    prisma.crmExchangeRun.findMany({
      where: { institutionId: ctx.institution.id },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: { id: true, direction: true, fileName: true, rowCount: true, errorCount: true, status: true, startedAt: true },
    }),
  ])
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="On the roster" value={members.toLocaleString()} />
        <StatTile label="Joined" value={joined.toLocaleString()} />
        <StatTile label="Not invited yet" value={invitable.toLocaleString()} />
      </div>
      <section aria-labelledby="invite" className="space-y-2">
        <h2 id="invite" className="text-base font-semibold">
          Invite alumni
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Each alum gets a short email from {ctx.institution.name} with a one-click link: no password, two privacy choices, then their job market.
          Do-not-contact alumni are never emailed.
        </p>
        <InviteAlumniButton slug={slug} count={invitable} isDemo={ctx.institution.isDemo} collegeName={ctx.institution.name} />
      </section>
      <section aria-labelledby="upload" className="space-y-3">
        <h2 id="upload" className="text-base font-semibold">
          Upload from your CRM
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Export from Raiser&apos;s Edge, Salesforce or a spreadsheet. Uploading the same file again changes nothing; an updated file updates the people in it.
          Or send the file to NextChapter and we&apos;ll load it.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          <CrmUploadForm id="roster" title="Alumni roster" columns={ROSTER_COLUMNS} action={uploadCrmFile.bind(null, slug, 'roster')} />
          <CrmUploadForm id="gifts" title="Gifts" columns={GIFT_COLUMNS} action={uploadCrmFile.bind(null, slug, 'gifts')} />
        </div>
      </section>
      {runs.length > 0 && (
        <Table caption="Upload history" head={['When', 'File', 'Rows', 'Problems', 'Result']}>
          {runs.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-2">{fmtDate(r.startedAt)}</td>
              <td className="px-4 py-2">{r.fileName ?? (r.direction === 'IMPORT_GIFTS' ? 'Gifts' : 'Roster')}</td>
              <td className="px-4 py-2 tabular-nums">{r.rowCount}</td>
              <td className="px-4 py-2 tabular-nums">{r.errorCount}</td>
              <td className="px-4 py-2">{r.status === 'SUCCEEDED' ? 'Imported' : r.status === 'PARTIAL' ? 'Imported, some rows skipped' : r.status === 'FAILED' ? 'Not imported' : 'Running'}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}

// What each license tier buys (product design, Packaging), in the buyer's terms.
const TIER_VALUE: Record<string, string> = {
  CAREER: 'Every alum and student gets the full NextChapter toolkit, with Career Services and Alumni Relations workspaces and a light employer portal.',
  ADVANCEMENT: 'Everything in Career, plus Development: the do-not-solicit flag, gratitude asks, CRM sync, the Resilience Fund and an ROI dashboard that shows the license paying for itself.',
  INSTITUTION: 'Everything in Advancement, plus Exec Ed and Teaching: programs, cohorts and credentials in the same portal, with WIOA funding as an option.',
}

// Admin home: the few steps from contract to a live portal, each with where
// to do it. Done steps are ticked from real data, not a stored checklist.
async function LaunchChecklist({ ctx }: { ctx: WorkspaceContext }) {
  const id = ctx.institution.id
  const base = `/i/${ctx.institution.slug}`
  const [inst, staff, members, coaches, jobs] = await Promise.all([
    prisma.institution.findUnique({ where: { id }, select: { logoUrl: true, accentColor: true, enabledFeatures: true, tier: true } }),
    prisma.institutionUser.findMany({ where: { institutionId: id, revokedAt: null }, select: { role: true } }),
    prisma.institutionMember.count({ where: { institutionId: id } }),
    prisma.coach.count({ where: { institutionId: id } }),
    prisma.exclusiveJobPosting.count({ where: { institutionScopeId: id, archivedAt: null } }),
  ])
  const roles = new Set(staff.map((s) => s.role))
  const wanted: InstitutionUserRole[] = ['CAREER_SERVICES', 'ALUMNI_RELATIONS', ...(inst?.tier === 'CAREER' ? [] : (['DEVELOPMENT'] as const))]
  const officesNeeded = wanted.filter((r) => !roles.has(r))
  const steps: { done: boolean; label: string; detail: string; href?: string }[] = [
    { done: !!(inst?.logoUrl && inst.accentColor), label: 'Add your brand', detail: 'Logo, color and a campus photo.', href: `${base}/admin/branding` },
    {
      done: officesNeeded.length === 0,
      label: 'Invite your team',
      detail: officesNeeded.length ? `Still needed: ${officesNeeded.map((r) => STAFF_ROLE_LABELS[r]).join(', ')}.` : 'Each office has someone.',
      href: `${base}/admin/users`,
    },
    {
      done: !!(inst?.enabledFeatures as { services?: unknown } | null)?.services,
      label: 'Choose your services',
      detail: 'Switch on what you offer; each becomes a card for alumni.',
      href: `${base}/admin/services`,
    },
    {
      done: members > 0,
      label: 'Load your alumni',
      detail: members ? `${members.toLocaleString()} on the roster.` : 'Upload your roster CSV, or send it to NextChapter and we’ll load it.',
      href: `${base}/admin/roster`,
    },
    { done: coaches > 0, label: 'Add your coaches (optional)', detail: 'Invite them with the Coach role; they get the NextChapter coach portal.', href: `${base}/admin/users` },
    { done: jobs > 0, label: 'Post an alumni job', detail: 'Roles only your alumni see.', href: `${base}/career/jobs` },
  ]
  const done = steps.filter((st) => st.done).length
  return (
    <section aria-labelledby="launch" className="space-y-3">
      <div>
        <h2 id="launch" className="text-base font-semibold">
          Launch checklist · {done} of {steps.length}
        </h2>
        {inst && <p className="max-w-2xl text-sm text-muted-foreground">{TIER_VALUE[inst.tier]}</p>}
      </div>
      <ol className="divide-y divide-border rounded-lg border border-border bg-card">
        {steps.map((st) => (
          <li key={st.label} className="flex items-start gap-3 px-4 py-3">
            {st.done ? (
              <CheckCircle2 className="mt-0.5 size-4 text-emerald-700" aria-label="Done" />
            ) : (
              <Circle className="mt-0.5 size-4 text-muted-foreground" aria-label="To do" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{st.label}</p>
              <p className="text-xs text-muted-foreground">{st.detail}</p>
            </div>
            {st.href && !st.done && (
              <Link href={st.href} className="text-sm font-medium text-primary hover:underline">
                Do this
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

async function AdminBranding({ ctx }: ScreenProps) {
  const i = await prisma.institution.findUnique({
    where: { id: ctx.institution.id },
    select: { programBrandName: true, accentColor: true, logoUrl: true, profile: true },
  })
  const profile = readProfile(i?.profile)
  return (
    <BrandingForm
      saveAction={saveBranding.bind(null, ctx.institution.slug)}
      defaults={{
        programBrandName: i?.programBrandName ?? null,
        accentColor: i?.accentColor ?? null,
        tagline: profile.tagline ?? null,
        logoUrl: i?.logoUrl ?? null,
        heroImageUrl: profile.heroImageUrl ?? null,
      }}
    />
  )
}

const MONTHS = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1))))

async function SettingsServices({ ctx }: ScreenProps) {
  const { enabledFeatures } = await loadInstitutionData(ctx.institution.id)
  const canEdit = ctx.tokens.has('INSTITUTION_ADMIN') && !ctx.readOnly
  const annualMonth = checkInMonthFrom(enabledFeatures)
  const usage = await serviceUsage30d(ctx.institution.id)
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Choose what {ctx.institution.name} offers. Switch a service on and its card appears on the Candidate home for the audiences you pick;
        each card shows how many members opened it.
      </p>
      <form action={setAnnualCheckInMonth.bind(null, ctx.institution.slug)} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="annual-month">Annual career check-in goes out in</Label>
          <select
            id="annual-month"
            name="annualMonth"
            defaultValue={annualMonth}
            disabled={!canEdit}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {canEdit ? (
          <SubmitButton variant="outline" pendingLabel="Saving…">
            Save month
          </SubmitButton>
        ) : (
          <p className="text-xs text-muted-foreground">Only an institution admin can change this.</p>
        )}
        <p className="w-full text-xs text-muted-foreground">
          New-grad check-ins go out 6, 18 and 24 months after graduation (May, unless a member&apos;s date is known). Sends start in HE-11.
        </p>
      </form>
      <ServicesPanel slug={ctx.institution.slug} initial={serviceSettingsFrom(enabledFeatures)} usage={usage} canEdit={canEdit} />
    </div>
  )
}

async function SettingsOverview({ ctx }: ScreenProps) {
  const i = await prisma.institution.findUnique({
    where: { id: ctx.institution.id },
    select: {
      name: true,
      programBrandName: true,
      slug: true,
      tier: true,
      alumniCount: true,
      includedSeats: true,
      licenseStartAt: true,
      licenseEndAt: true,
      enabledFeatures: true,
      givingUrl: true,
      profile: true,
    },
  })
  if (!i) return null
  const features = (i.enabledFeatures ?? {}) as { graceDays?: number; fiscalYearStartMonth?: number }
  const checklist = <LaunchChecklist ctx={ctx} />
  const facts: [string, string][] = [
    ['Name', i.name],
    ['Program name', i.programBrandName ?? '—'],
    ['Portal address', `/i/${i.slug}`],
    ['Tier', i.tier],
    ['Alumni', i.alumniCount?.toLocaleString() ?? '—'],
    ['Included seats', i.includedSeats.toLocaleString()],
    ['License', [fmtDate(i.licenseStartAt), fmtDate(i.licenseEndAt)].filter(Boolean).join(' – ') || '—'],
  ]
  return (
    <div className="space-y-6">
      {checklist}
      <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <CollegeSettingsForm
        action={saveCollegeSettings.bind(null, i.slug)}
        canEdit={ctx.tokens.has('INSTITUTION_ADMIN') && !ctx.readOnly}
        defaults={{ graceDays: graceDaysFrom(i.enabledFeatures), fiscalYearStartMonth: features.fiscalYearStartMonth ?? 7, givingUrl: i.givingUrl }}
      />
      <CollegeProfile profile={readProfile(i.profile)} />
    </div>
  )
}

function CollegeProfile({ profile }: { profile: InstitutionProfile }) {
  const c = profile.college
  if (!c && !profile.photos?.length) return null
  return (
    <section aria-labelledby="college-profile" className="space-y-3 pt-4">
      <h2 id="college-profile" className="text-base font-semibold">
        College profile
      </h2>
      <PhotoStrip profile={profile} />
      {c?.facts?.length ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {c.facts.map((f) => (
            <div key={f.label} className="rounded-lg border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="text-sm font-semibold">{f.value}</dd>
              <dd className="mt-1 text-[11px] text-muted-foreground">
                {f.sourceUrl ? (
                  <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {f.source}
                  </a>
                ) : (
                  f.source
                )}
                {f.asOf ? ` · ${f.asOf}` : ''}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {c?.careerCenter && (
        <p className="text-sm">
          <span className="font-medium">{c.careerCenter.name}</span>
          {c.careerCenter.url && (
            <a href={c.careerCenter.url} target="_blank" rel="noreferrer" className="ml-2 text-primary hover:underline">
              Website
            </a>
          )}
        </p>
      )}
    </section>
  )
}

async function SettingsStaff({ ctx }: ScreenProps) {
  const staff = await prisma.institutionUser.findMany({
    where: { institutionId: ctx.institution.id },
    orderBy: [{ revokedAt: { sort: 'asc', nulls: 'first' } }, { fullName: 'asc' }],
    select: { id: true, fullName: true, invitedEmail: true, role: true, workspace: true, acceptedAt: true, revokedAt: true },
  })
  return (
    <div className="space-y-3">
      <Table caption="Staff" head={['Name', 'Email', 'Role', 'Status']}>
        {staff.map((s) => (
          <tr key={s.id}>
            <td className="px-4 py-2 font-medium">{s.fullName ?? '—'}</td>
            <td className="px-4 py-2">{s.invitedEmail}</td>
            <td className="px-4 py-2">
              {STAFF_ROLE_LABELS[s.role]}
              {s.workspace ? ` (${s.workspace})` : ''}
            </td>
            <td className="px-4 py-2">{s.revokedAt ? 'Removed' : s.acceptedAt ? 'Active' : 'Invited'}</td>
          </tr>
        ))}
      </Table>
      {ctx.institution.isDemo ? (
        <p className="text-xs text-muted-foreground">Invites are off on demo colleges: their staff are fictional.</p>
      ) : (
        <StaffInviteForm inviteAction={inviteStaff.bind(null, ctx.institution.slug)} />
      )}
    </div>
  )
}

// What each not-yet-built tab will do, for its placeholder.
export const COMING_DESCRIPTIONS: Record<string, string> = {
  'candidate:privacy': 'Four plain-language sharing toggles and "Who viewed my profile."',
  'candidate:mentors': 'Browse alumni mentors by industry and function, and request a call.',
  'alumni:layoffs': 'WARN notices matched to alumni employers, with one-click outreach.',
  'alumni:outreach': 'Campaigns, a merge-field template editor, and a send log with opens, clicks and claims.',
  'alumni:mentors': 'The mentor roster, invitations and request activity.',
  'alumni:engagement': 'Engagement score distribution and CASE breakdown by class decade.',
  'development:signals': 'Promotion, new-employer and gratitude signals to approve, dismiss or export.',
  'development:fund': 'Resilience Fund settings, awards and the donor report.',
  'development:crm': 'Roster and gift CSV uploads, the updates export, and run history.',
  'career:checkins': 'Automatic M6, M18 and M24 check-ins with responses.',
  'career:students': 'Invite students and recent grads.',
  'career:employers': 'Approve employers and set package tier and featured dates.',
  'employer:page': "The employer's branded page and roles posted only to this college's members.",
  'admin:roster': 'Roster import and the CRM exchange.',
  'teaching:capstones': 'Employers sponsor capstone projects your students and Exec Ed cohorts deliver.',
  'execed:enrollments': 'Cohorts, enrollment, attendance and credentials.',
  'execed:clients': 'Employers who buy seats or custom programs for their teams.',
}

export const WORKSPACE_SCREENS: Record<string, ComponentType<ScreenProps>> = {
  'candidate:home': CandidateHome,
  'alumni:home': AlumniHome,
  'alumni:members': AlumniMembers,
  'development:home': DevelopmentHome,
  'development:transition': DevelopmentTransition,
  'career:home': CareerCaseload,
  'employer:home': EmployerDossiers,
  'alumni:region': Region,
    'career:region': Region,
  'alumni:jobs': AlumniJobs,
  'career:jobs': AlumniJobs,
  'career:companies': TargetCompanies,
  'candidate:coaching': CandidateCoaching,
  'career:coaching': CareerCoaching,
  'teaching:home': TeachingCourses,
  'teaching:faculty': TeachingFaculty,
  'execed:home': ExecEdPrograms,
  'admin:home': SettingsOverview,
  'admin:branding': AdminBranding,
  'admin:roster': AdminRoster,
  'candidate:privacy': CandidatePrivacy,
  'admin:services': SettingsServices,
  'admin:users': SettingsStaff,
}
