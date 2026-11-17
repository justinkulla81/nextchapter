// A line back to campus. Members: research by the college's authors in their
// field, patents to look at, and alumni in the news. Staff (Alumni Relations):
// the same news feed, for newsletters and congratulations.

import Link from 'next/link'
import { BookOpen, Newspaper, Users } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { readProfile } from '@/lib/higher-ed/profile'
import { alumniNews, collegeResearch } from '@/lib/higher-ed/research-feed'
import { listMilestones } from '@/lib/higher-ed/lifecycle'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { listGroups } from '@/lib/higher-ed/community'
import { facultyGroupAction } from '@/app/i/[slug]/(portal)/community-actions'
import { ActionButton, ResearchRequestForm } from './CommunityForms'

type Props = { ctx: WorkspaceContext; base: string; searchParams?: { field?: string } }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmt = (iso: string | null) => (iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : null)
const out = (slug: string, params: Record<string, string>) => `/i/${slug}/out?${new URLSearchParams(params).toString()}`

/** The fields to offer a member: their major, industry and function, de-duplicated. */
function memberFields(m: { major: string | null; candidate: { industryContext: string | null; primaryFunction: string | null } | null } | null): string[] {
  const xs = [m?.major, m?.candidate?.industryContext, m?.candidate?.primaryFunction].filter((x): x is string => !!x && x.trim().length > 1)
  return [...new Map(xs.map((x) => [x.toLowerCase(), x.trim()])).values()].slice(0, 3)
}

export async function ResearchAndPatents({ ctx, searchParams }: Props) {
  const slug = ctx.institution.slug
  const [member, inst] = await Promise.all([
    ctx.memberId ? prisma.institutionMember.findUnique({ where: { id: ctx.memberId }, select: { major: true, candidate: { select: { industryContext: true, primaryFunction: true } } } }) : null,
    prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { name: true, profile: true } }),
  ])
  const fields = memberFields(member)
  const asked = (searchParams?.field ?? '').trim().slice(0, 60)
  const field = asked || fields[0] || null
  const techTransfer = readProfile(inst.profile).college?.techTransfer
  const papers = field ? await collegeResearch(inst.name, field) : []
  const options = [...new Set([...(asked && !fields.includes(asked) ? [asked] : []), ...fields])]

  return (
    <section aria-labelledby="research-h" className="space-y-3">
      <div>
        <h2 id="research-h" className="text-base font-semibold">
          Research and patents from {inst.name}
        </h2>
        <p className="text-sm text-muted-foreground">New work by {inst.name} researchers in your field, and inventions you could license or partner on.</p>
      </div>
      <form className="flex flex-wrap items-center gap-2" action="" method="get">
        {options.map((f) => (
          <Link
            key={f}
            href={`?field=${encodeURIComponent(f)}#research-h`}
            aria-current={f === field ? 'true' : undefined}
            className={cn('rounded-md border px-3 py-1.5 text-sm', f === field ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}
          >
            {f}
          </Link>
        ))}
        <label htmlFor="rf-field" className="sr-only">
          Another field
        </label>
        <input id="rf-field" name="field" placeholder="Another field" className="h-9 w-44 rounded-md border border-input bg-background px-2 text-sm" />
        <button type="submit" className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted">
          Show research
        </button>
      </form>
      {!field ? (
        <EmptyState icon={BookOpen} title="Pick a field" description="Type a field above, or add your major and work to your profile and we’ll pick it for you." />
      ) : papers === null ? (
        <EmptyState icon={BookOpen} title="The research index isn’t answering right now" description="Try again in a few minutes." />
      ) : papers.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {papers.map((p) => (
            <li key={p.doi} className="space-y-0.5 p-3">
              <a href={out(slug, { k: 'paper', doi: p.doi })} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                {p.title}
              </a>
              <p className="text-xs text-muted-foreground">{[p.authors.join(', '), p.journal, fmt(p.date)].filter(Boolean).join(' · ')}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No articles by {inst.name} authors matched “{field}” in the last year. Try a broader field.</p>
      )}
      {field && (
        <p className="text-sm">
          <a href={out(slug, { k: 'patents', f: field })} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {inst.name} patents in {field}, on Google Patents
          </a>
          {techTransfer && (
            <>
              {' · '}
              <a href={out(slug, { k: 'techtransfer' })} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                License or partner: {techTransfer.name}
              </a>
            </>
          )}
        </p>
      )}
      <p className="text-xs text-muted-foreground">Articles from Crossref with at least one {inst.name}-affiliated author, last 12 months, refreshed daily.</p>
    </section>
  )
}

export async function AlumniInNews({ ctx }: Props) {
  const slug = ctx.institution.slug
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { name: true, profile: true } })
  const [news, milestones] = await Promise.all([alumniNews(inst.name), listMilestones(ctx.institution.id, { limit: 6 })])
  return (
    <section aria-labelledby="news-h" className="space-y-3">
      <h2 id="news-h" className="text-base font-semibold">
        Alumni in the news
      </h2>
      {milestones.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {milestones.map((m) => (
            <li key={m.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <span className="font-medium">
                {m.name}
                {m.classYear ? ` ’${String(m.classYear).slice(2)}` : ''}
              </span>{' '}
              started {m.title ? `as ${m.title}` : 'a new role'}
              {m.employer ? ` at ${m.employer}` : ''}.
            </li>
          ))}
        </ul>
      )}
      {news === null ? (
        <p className="text-sm text-muted-foreground">The news search isn’t answering right now.</p>
      ) : news.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {news.map((n) => (
            <li key={n.url} className="space-y-0.5 p-3">
              <a href={out(slug, { k: 'news', u: n.url })} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                {n.title}
              </a>
              <p className="text-xs text-muted-foreground">{[n.source, fmt(n.date)].filter(Boolean).join(' · ')}</p>
            </li>
          ))}
        </ul>
      ) : (
        !milestones.length && <EmptyState icon={Newspaper} title="No alumni news yet" description="Stories mentioning alumni, and new jobs alumni choose to share, show up here." />
      )}
      <p className="text-xs text-muted-foreground">
        New jobs are ones alumni chose to share. News stories are found by Google News for “{inst.name} alumni” and similar, last four months; {inst.name} hasn’t checked them.
      </p>
    </section>
  )
}

// Teaching › Industry groups: professors join alumni industry and function
// groups, and ask alumni in industry for research help.
export async function TeachingGroups({ ctx }: Props) {
  const slug = ctx.institution.slug
  const write = !ctx.readOnly
  const seat = ctx.staffUsers.find((s) => s.role === 'FACULTY') ?? ctx.staffUsers[0]
  const [groups, requests] = await Promise.all([
    listGroups(ctx.institution.id, null),
    prisma.alumniOpportunity.findMany({
      // A demo shows every professor's requests: the person previewing is not the fictional professor.
      where: { institutionId: ctx.institution.id, kind: 'research', ...(ctx.institution.isDemo ? {} : ctx.email ? { postedByStaff: ctx.email } : { id: '__none__' }) },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        interests: { orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, note: true, member: { select: { firstName: true, lastName: true, classYear: true, email: true } } } },
      },
    }),
  ])
  const affinity = groups.filter((g) => g.kind === 'affinity')
  return (
    <div className="space-y-10">
      <section aria-labelledby="tg-groups" className="space-y-3">
        <div>
          <h2 id="tg-groups" className="text-base font-semibold">
            Alumni industry and function groups
          </h2>
          <p className="text-sm text-muted-foreground">Join the groups in your field. Alumni see your name on the group, so practice and research can find each other.</p>
        </div>
        {affinity.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {affinity.map((g) => {
              const mine = !!seat && g.facultyIds.includes(seat.id)
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g._count.members} alumni{g.facultyNames.length ? ` · Faculty: ${g.facultyNames.join(', ')}` : ''}
                    </p>
                  </div>
                  {write && seat && <ActionButton label={mine ? 'Leave' : 'Join as faculty'} variant={mine ? 'ghost' : 'default'} done={mine ? 'Left.' : 'Joined.'} run={facultyGroupAction.bind(null, slug, g.id, !mine)} />}
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState icon={Users} title="No industry groups yet" description="Alumni Relations adds them; ask for the ones in your field." />
        )}
      </section>

      <section aria-labelledby="tg-research" className="space-y-3">
        <div>
          <h2 id="tg-research" className="text-base font-semibold">
            Ask alumni in industry for research help
          </h2>
          <p className="text-sm text-muted-foreground">Interviews, a survey, data, a site for a pilot or a sponsor. Alumni raise a hand; you see who, and contact the ones you choose.</p>
        </div>
        {write && (
          <details className="rounded-lg border border-border bg-card p-4" open={!requests.length}>
            <summary className="cursor-pointer text-sm font-medium text-primary">Post a research request</summary>
            <div className="mt-3">
              <ResearchRequestForm slug={slug} />
            </div>
          </details>
        )}
        {requests.map((r) => (
          <div key={r.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
            <p className="font-medium">
              {r.title} <span className="text-xs font-normal text-muted-foreground">· {r.status === 'OPEN' ? 'Open' : 'Closed'}</span>
            </p>
            {r.interests.length ? (
              <ul className="space-y-1 text-sm">
                {r.interests.map((i) => (
                  <li key={i.id}>
                    {[i.member.firstName, i.member.lastName].filter(Boolean).join(' ') || 'An alum'}
                    {i.member.classYear ? ` ’${String(i.member.classYear).slice(2)}` : ''} ·{' '}
                    <a href={`mailto:${i.member.email}`} className="text-primary hover:underline">
                      {i.member.email}
                    </a>
                    {i.note ? <span className="text-muted-foreground"> · “{i.note}”</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No one has raised a hand yet.</p>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
