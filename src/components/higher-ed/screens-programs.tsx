// V2 screens (spec §13, lean): Exec Ed programs, enrollments and corporate
// clients; Teaching courses and employer capstones; the alum's Programs tab
// and "My program" card; the Workforce board's WIOA participants. Program
// enrollments are the college's own records; employer comes through the
// directory view, so only with the participant's consent.

import Link from 'next/link'
import { Award, Briefcase, Building2, GraduationCap, Landmark } from 'lucide-react'
import type { EnrollmentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { PROGRAM_IDEAS } from '@/lib/higher-ed/services'
import { employerProfileFor } from '@/lib/higher-ed/employers'
import {
  CAPSTONE_LABELS,
  listCapstones,
  listClients,
  listEnrollments,
  listPrograms,
  myEnrollments,
  openCohorts,
  PAYER_LABELS,
  PLACEMENT_WINDOW_DAYS,
  STATUS_LABELS,
  wioaOn,
  wioaReport,
} from '@/lib/higher-ed/programs'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { StatTile } from './StatTile'
import { ApplyToCohort, CapstoneControls, CapstoneForm, ClientForm, CohortForm, EnrollmentControls, ProgramForm } from './ProgramForms'

type Props = { ctx: WorkspaceContext; base: string; searchParams?: { status?: string } }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmt = (d: Date | null | undefined) => (d ? dateFmt.format(new Date(d)) : '—')
const usd = (cents: number) => (cents ? (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : 'Free')
const name = (m: { firstName: string | null; lastName: string | null }) => [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Unnamed'
const MODALITY: Record<string, string> = { online: 'Online', in_person: 'In person', hybrid: 'Hybrid' }
const canEditExec = (ctx: WorkspaceContext) => !ctx.readOnly && (ctx.tokens.has('EXEC_ED') || ctx.tokens.has('INSTITUTION_ADMIN'))
const canTeach = (ctx: WorkspaceContext) => !ctx.readOnly && ['FACULTY', 'EXEC_ED', 'INSTITUTION_ADMIN'].some((r) => ctx.tokens.has(r as 'FACULTY'))

async function facultyOptions(institutionId: string) {
  const f = await prisma.institutionUser.findMany({
    where: { institutionId, role: { in: ['FACULTY', 'EXEC_ED'] }, revokedAt: null },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, invitedEmail: true },
  })
  return [...new Map(f.map((x) => [x.id, { id: x.id, name: x.fullName ?? x.invitedEmail }])).values()]
}

// ── Exec Ed › Programs ──────────────────────────────────────────────────────

export async function ExecEdPrograms({ ctx, base }: Props) {
  const [programs, faculty, inst] = await Promise.all([
    listPrograms(ctx.institution.id),
    facultyOptions(ctx.institution.id),
    prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } }),
  ])
  const edit = canEditExec(ctx)
  const showWioa = wioaOn(inst.enabledFeatures)
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Programs run in cohorts. Alumni apply from their Programs tab; you enroll them and record who pays (self-pay, an employer, the Resilience Fund
        {showWioa ? ', a WIOA voucher' : ''} or Pell), and completers earn the program&apos;s credential. Taught by your{' '}
        <Link href={`/i/${ctx.institution.slug}/teaching/faculty`} className="text-primary hover:underline">
          faculty
        </Link>
        .
      </p>
      {programs.length ? (
        <ul className="space-y-4">
          {programs.map((p) => (
            <li key={p.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {p.name}
                    {!p.isActive && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">Closed</span>}
                    {p.wioaEligible && showWioa && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">WIOA-eligible</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{[usd(p.priceCents), p.audience, p.credential && `Earns: ${p.credential}`].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
              {p.summary && <p className="text-sm">{p.summary}</p>}
              {p.cohorts.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border text-sm">
                  {p.cohorts.map((c) => (
                    <li key={c.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                      <span>
                        {c.name} · {fmt(c.startsAt)}
                        {c.endsAt ? ` – ${fmt(c.endsAt)}` : ''}
                        {c.modality ? ` · ${MODALITY[c.modality] ?? c.modality}` : ''}
                      </span>
                      <span className="text-muted-foreground">
                        {c._count.enrollments}
                        {c.seats ? ` of ${c.seats}` : ''} enrolled · {c.faculty ? (c.faculty.fullName ?? c.faculty.invitedEmail) : 'No instructor yet'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {edit && (
                <>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-primary">Add a cohort</summary>
                    <div className="pt-3">
                      <CohortForm slug={ctx.institution.slug} programId={p.id} faculty={faculty} />
                    </div>
                  </details>
                  <details>
                    <summary className="cursor-pointer text-sm text-muted-foreground">Edit program</summary>
                    <div className="pt-3">
                      <ProgramForm slug={ctx.institution.slug} program={p} showWioa={showWioa} />
                    </div>
                  </details>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={GraduationCap} title="No programs yet" description="Add your first program below. Ideas that have worked elsewhere are listed under it." />
      )}
      {edit && (
        <section aria-labelledby="add-program" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="add-program" className="text-base font-semibold">
            Add a program
          </h2>
          <ProgramForm slug={ctx.institution.slug} showWioa={showWioa} />
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Ideas</summary>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {PROGRAM_IDEAS.map((i) => (
                <li key={i.key}>
                  <span className="font-medium text-foreground">{i.name}:</span> {i.summary}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        Applications waiting: see{' '}
        <Link href={`${base}/enrollments?status=APPLIED`} className="text-primary hover:underline">
          Enrollments
        </Link>
        .
      </p>
    </div>
  )
}

// ── Exec Ed › Enrollments ───────────────────────────────────────────────────

const FILTERS: { key: EnrollmentStatus | 'ALL'; label: string }[] = [
  { key: 'APPLIED', label: 'Applied' },
  { key: 'ENROLLED', label: 'Enrolled' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'ALL', label: 'All' },
]

export async function ExecEdEnrollments({ ctx, base, searchParams }: Props) {
  const status = (['APPLIED', 'ENROLLED', 'COMPLETED'] as const).find((s) => s === searchParams?.status)
  const [rows, clients, counts] = await Promise.all([
    listEnrollments(ctx.institution.id, status ? { status } : {}),
    listClients(ctx.institution.id),
    prisma.enrollment.groupBy({ by: ['status'], where: { cohort: { program: { institutionId: ctx.institution.id } } }, _count: { _all: true } }),
  ])
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0
  const edit = canEditExec(ctx)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Applied" value={count('APPLIED')} href={`${base}/enrollments?status=APPLIED`} />
        <StatTile label="Enrolled" value={count('ENROLLED')} href={`${base}/enrollments?status=ENROLLED`} />
        <StatTile label="Completed" value={count('COMPLETED')} href={`${base}/enrollments?status=COMPLETED`} />
        <StatTile label="Withdrew" value={count('WITHDREW')} />
      </div>
      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const on = (f.key === 'ALL' && !status) || f.key === status
          return (
            <Link key={f.key} href={f.key === 'ALL' ? `${base}/enrollments` : `${base}/enrollments?status=${f.key}`} aria-current={on ? 'page' : undefined} className={cn(buttonVariants({ size: 'sm', variant: on ? 'default' : 'outline' }))}>
              {f.label}
            </Link>
          )
        })}
      </nav>
      {rows.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="space-y-0.5">
                <p className="font-medium">
                  {name(e.member)}
                  {e.member.classYear && <span className="text-muted-foreground"> &rsquo;{String(e.member.classYear).slice(2)}</span>}
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">{STATUS_LABELS[e.status]}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {e.cohort.program.name} · {e.cohort.name} · applied {fmt(e.appliedAt)}
                  {e.completedAt ? ` · completed ${fmt(e.completedAt)}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {PAYER_LABELS[e.payer]}
                  {e.corporateClient ? ` (${e.corporateClient.name})` : ''} · {e.member.email}
                </p>
                {e.note && <p className="text-xs">&ldquo;{e.note}&rdquo;</p>}
              </div>
              {edit && (
                <EnrollmentControls
                  slug={ctx.institution.slug}
                  id={e.id}
                  status={e.status}
                  payer={e.payer}
                  clientId={e.corporateClientId}
                  clients={clients.map((c) => ({ id: c.id, name: c.name }))}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={GraduationCap} title="No one here yet" description="Alumni apply from their Programs tab once a program has a cohort." />
      )}
    </div>
  )
}

// ── Exec Ed › Corporate clients ─────────────────────────────────────────────

export async function ExecEdClients({ ctx }: Props) {
  const clients = await listClients(ctx.institution.id)
  const edit = canEditExec(ctx)
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Employers that buy seats for their teams. Mark an enrollment&apos;s payer as Employer and pick the client to count the seat against it.
      </p>
      {clients.length ? (
        <ul className="space-y-3">
          {clients.map((c) => (
            <li key={c.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {c.seatsUsed} of {c.seatsPurchased} seats used · {c.completed} completed
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{[c.contactName, c.contactEmail, c.notes].filter(Boolean).join(' · ') || 'No contact yet'}</p>
              {edit && (
                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground">Edit</summary>
                  <div className="pt-3">
                    <ClientForm slug={ctx.institution.slug} client={c} />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Building2} title="No corporate clients yet" description="Add an employer that buys seats in your programs." />
      )}
      {edit && (
        <section aria-labelledby="add-client" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="add-client" className="text-base font-semibold">
            Add a client
          </h2>
          <ClientForm slug={ctx.institution.slug} />
        </section>
      )}
    </div>
  )
}

// ── Teaching › Courses and Employer capstones ───────────────────────────────

export async function TeachingCourses({ ctx }: Props) {
  const programs = await listPrograms(ctx.institution.id)
  const cohorts = programs.flatMap((p) => p.cohorts.map((c) => ({ ...c, program: p.name })))
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">The cohorts your faculty teach across Exec Ed programs. Exec Ed adds cohorts and assigns instructors.</p>
      {cohorts.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
          {cohorts.map((c) => (
            <li key={c.id} className="flex flex-wrap justify-between gap-2 p-3">
              <span>
                <span className="font-medium">{c.program}</span> · {c.name} · {fmt(c.startsAt)}
              </span>
              <span className="text-muted-foreground">
                {c.faculty ? (c.faculty.fullName ?? c.faculty.invitedEmail) : 'No instructor yet'} · {c._count.enrollments} enrolled
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={GraduationCap} title="No cohorts yet" description="Exec Ed adds programs and cohorts; they show here with who teaches them." />
      )}
    </div>
  )
}

export async function TeachingCapstones({ ctx }: Props) {
  const capstones = await listCapstones(ctx.institution.id)
  const edit = canTeach(ctx)
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Real projects from employers, delivered by students or an Exec Ed cohort. Employers propose them from their workspace and can commit to
        interviewing the team; faculty approve and lead.
      </p>
      {capstones.length ? (
        <ul className="space-y-3">
          {capstones.map((c) => (
            <li key={c.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {c.title}
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">{CAPSTONE_LABELS[c.status]}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {[c.employerName, c.term, c.interviewCommitments ? `${c.interviewCommitments} ${c.interviewCommitments === 1 ? 'interview' : 'interviews'} committed` : null, c.faculty && `Led by ${c.faculty.fullName ?? c.faculty.invitedEmail}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <p className="text-sm">{c.brief}</p>
              {edit && <CapstoneControls slug={ctx.institution.slug} id={c.id} status={c.status} />}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Briefcase} title="No capstones yet" description="Approved employers can propose one from their workspace, or add one below." />
      )}
      {edit && (
        <section aria-labelledby="add-capstone" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="add-capstone" className="text-base font-semibold">
            Add a capstone
          </h2>
          <CapstoneForm slug={ctx.institution.slug} from="teaching" />
        </section>
      )}
    </div>
  )
}

// Under the Employer page: their capstones here and a form to propose one.
export async function EmployerCapstones({ ctx }: { ctx: WorkspaceContext }) {
  const profileId = await employerProfileFor(ctx)
  if (!profileId) return null
  const link = await prisma.institutionEmployer.findUnique({
    where: { institutionId_employerProfileId: { institutionId: ctx.institution.id, employerProfileId: profileId } },
    select: { id: true },
  })
  if (!link) return null
  const mine = await listCapstones(ctx.institution.id, link.id)
  return (
    <section aria-labelledby="capstones" className="space-y-3">
      <h2 id="capstones" className="text-base font-semibold">
        Capstone projects
      </h2>
      <p className="text-sm text-muted-foreground">
        Give students or an Exec Ed cohort a real problem from your team. Committing to interviews is the strongest signal you&apos;re hiring.
      </p>
      {mine.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
          {mine.map((c) => (
            <li key={c.id} className="flex justify-between gap-2 p-3">
              <span>{c.title}</span>
              <span className="text-muted-foreground">{CAPSTONE_LABELS[c.status]}</span>
            </li>
          ))}
        </ul>
      )}
      {!ctx.readOnly && (
        <div className="rounded-lg border border-border bg-card p-4">
          <CapstoneForm slug={ctx.institution.slug} from="employer" />
        </div>
      )}
    </section>
  )
}

// ── Candidate › Programs, and the "My program" card ─────────────────────────

export async function CandidatePrograms({ ctx }: Props) {
  const [cohorts, mine] = await Promise.all([openCohorts(ctx.institution.id), ctx.memberId ? myEnrollments(ctx.memberId) : Promise.resolve([])])
  const appliedTo = new Set(mine.map((m) => m.cohort.name + m.cohort.program.name))
  return (
    <div className="space-y-6">
      {mine.length > 0 && (
        <section aria-labelledby="my-programs" className="space-y-2">
          <h2 id="my-programs" className="text-base font-semibold">
            Your programs
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {mine.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  {e.cohort.program.name} · {e.cohort.name}
                </span>
                <span className="text-muted-foreground">
                  {e.status === 'COMPLETED' ? `Completed${e.credentialName ? `: ${e.credentialName}` : ''}` : `${STATUS_LABELS[e.status]} · starts ${fmt(e.cohort.startsAt)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="open-programs" className="space-y-3">
        <h2 id="open-programs" className="text-base font-semibold">
          Programs from {ctx.institution.name}
        </h2>
        {cohorts.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {cohorts.map((c) => (
              <li key={c.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
                <div>
                  <p className="font-semibold">{c.program.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[c.name, `starts ${fmt(c.startsAt)}`, c.modality && (MODALITY[c.modality] ?? c.modality), usd(c.program.priceCents), c.seatsLeft !== null && `${c.seatsLeft} seats left`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {c.program.summary && <p className="text-sm">{c.program.summary}</p>}
                {c.program.credential && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Award className="size-3" aria-hidden="true" />
                    Earn: {c.program.credential}
                  </p>
                )}
                {ctx.memberId && !ctx.readOnly && !appliedTo.has(c.name + c.program.name) && (
                  <ApplyToCohort slug={ctx.institution.slug} cohortId={c.id} free={c.program.priceCents === 0} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={GraduationCap} title="Nothing open right now" description="New cohorts show up here as your college adds them." />
        )}
      </section>
    </div>
  )
}

export async function MyProgramCard({ ctx }: { ctx: WorkspaceContext }) {
  if (!ctx.memberId) return null
  const current = (await myEnrollments(ctx.memberId)).find((e) => e.status === 'ENROLLED' || e.status === 'APPLIED')
  if (!current) return null
  return (
    <Link href={`/i/${ctx.institution.slug}/candidate/programs`} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary">
      <GraduationCap className="size-5 text-primary" aria-hidden="true" />
      <span className="text-sm">
        <span className="font-medium">My program:</span> {current.cohort.program.name} · {current.cohort.name} ·{' '}
        {current.status === 'APPLIED' ? 'application in review' : `starts ${fmt(current.cohort.startsAt)}`}
      </span>
    </Link>
  )
}

// ── Workforce board ─────────────────────────────────────────────────────────

export async function WorkforceHome({ ctx }: Props) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  if (!wioaOn(inst.enabledFeatures)) {
    return (
      <EmptyState
        icon={Landmark}
        title="Off for this college"
        description="An admin can turn it on in Admin › Overview (“We train dislocated workers with our local workforce board”), then invite the board’s staff as Workforce board partners."
      />
    )
  }
  const r = await wioaReport(ctx.institution.id)
  const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Everyone in training on a WIOA voucher or a board contract, and what happened: completion, credential, and a new job within {PLACEMENT_WINDOW_DAYS} days of
        finishing (from the alum&apos;s own report). Employer shows only when the participant shares it. No Social Security numbers are kept here.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Participants" value={r.enrolled} />
        <StatTile label="In training" value={r.inTraining} />
        <StatTile label="Completed" value={r.completed} note={r.enrolled ? `${Math.round((r.completed / r.enrolled) * 100)}% of participants` : undefined} />
        <StatTile label="Credentials earned" value={r.credentials} />
        <StatTile label="Placed" value={r.placed} note={`Placement rate ${pct(r.placementRate)}, counted ${PLACEMENT_WINDOW_DAYS} days after completion`} />
      </div>
      <a href={`/i/${ctx.institution.slug}/export/wioa`} download className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
        Download participant outcomes (CSV)
      </a>
      {r.rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">WIOA participants</caption>
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                {['Participant', 'Program', 'Funding', 'Status', 'Completed', 'Credential', 'Placed', 'Latest employer'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {r.rows.map((x) => (
                <tr key={x.enrollmentId}>
                  <td className="px-4 py-2">{name(x)}</td>
                  <td className="px-4 py-2">
                    {x.program} · {x.cohort}
                  </td>
                  <td className="px-4 py-2">{PAYER_LABELS[x.payer]}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[x.status]}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{fmt(x.completedAt)}</td>
                  <td className="px-4 py-2">{x.credential ?? '—'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{fmt(x.placedAt)}</td>
                  <td className="px-4 py-2">{x.employer ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Landmark} title="No WIOA participants yet" description="When Exec Ed marks an enrollment as paid by a WIOA voucher or board contract, it shows here." />
      )}
    </div>
  )
}
