import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { myEnrollments } from '@/lib/higher-ed/programs'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Chip } from '@/components/candidate/ui'

// Network › Alumni and groups, as a workforce participant sees it: the same page as /dashboard/groups, with the
// program listed as one of their groups and what it adds to each place (Learn, coaching, local employers).
// Reads three counts and the member's own enrollments; nothing scans a large table.
export async function CandidateGroups({ ctx, base }: { ctx: WorkspaceContext; base: string }) {
  const inst = ctx.institution
  const brand = inst.programBrandName ?? inst.name
  const [members, companies, coaches, enrollments] = await Promise.all([
    prisma.institutionMember.count({ where: { institutionId: inst.id, status: { in: ['CLAIMED', 'ACTIVE'] } } }),
    prisma.memberCompany.count({ where: { institutionId: inst.id } }),
    prisma.coach.count({ where: { institutionId: inst.id } }),
    ctx.memberId ? myEnrollments(ctx.memberId) : Promise.resolve([]),
  ])
  const program = enrollments.find((e) => e.status === 'ENROLLED' || e.status === 'APPLIED')
  const adds = [
    companies > 0 ? { where: 'Jobs', what: `Openings at ${companies.toLocaleString()} local member ${companies === 1 ? 'company' : 'companies'} come first.` } : null,
    { where: 'Learn', what: program ? `${program.cohort.program.name}, ${program.status === 'APPLIED' ? 'application in review' : 'enrolled'}.` : `${inst.name}'s courses and workshops.` },
    { where: 'Network', what: coaches > 0 ? `Coaching from ${inst.name}'s ${coaches === 1 ? 'coach' : `${coaches} coaches`}.` : `Coaching through ${inst.name}.` },
  ].filter((a): a is { where: string; what: string } => !!a)

  return (
    <div className="space-y-8">
      <PageHeader title="Alumni and groups" intro="Schools, past employers and programs you belong to. They add their own jobs, learning and people to the places you already use." />
      <article className="space-y-5 rounded-2xl border border-border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Chip tone="good">You&apos;re a member</Chip>
            <h3 className="font-display text-2xl font-semibold text-ink">{brand}</h3>
            <p className="text-sm text-muted-foreground">
              Workforce program{brand !== inst.name ? ` from ${inst.name}` : ''}
              {members > 0 ? ` · ${members.toLocaleString()} ${members === 1 ? 'member' : 'members'}` : ''}
            </p>
          </div>
          <Link href={base} className="inline-flex h-10 items-center rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95">
            Open {brand}
          </Link>
        </div>
        <ul className="divide-y divide-border border-t border-border">
          {adds.map((a) => (
            <li key={a.where} className="flex flex-wrap gap-x-3 gap-y-0.5 py-3">
              <span className="w-24 shrink-0 text-sm font-semibold text-ink">In {a.where}</span>
              <span className="text-sm text-ink">{a.what}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Why this is private: {inst.name} never sees your search. It sees only what you choose to share in Account and privacy.
        </p>
      </article>
    </div>
  )
}
