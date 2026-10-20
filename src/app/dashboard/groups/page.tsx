import type { Metadata } from 'next'
import Link from 'next/link'
import { GraduationCap, Building2, Handshake, Users } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getAlumniNetworkOptions } from '@/lib/community/alumni-networks'
import { programForCandidate } from '@/lib/employer/program-server'
import { AlumniNetworkOptions } from '@/components/community/AlumniNetworkOptions'
import { EmptyState } from '@/components/ui/empty-state'
import { isRedesignOn } from '@/lib/redesign/flag'
import { groupsIntro } from '@/lib/redesign/network-pages'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Section } from '@/components/candidate/ui'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { NetworkParts } from '@/components/network/NetworkParts'

export const metadata: Metadata = { title: 'My groups' }

// Every organization and community a member belongs to, in one place:
// an outplacement program through a former employer, colleges and their career
// services, and alumni networks for schools and past employers. Belonging to
// several of each is normal. Groups can add their own jobs, learning and people
// to the places a member already uses; nothing here changes the layout.
export default async function GroupsPage() {
  const profile = await getDashboardProfile()
  const [program, institutions, networks] = await Promise.all([
    programForCandidate(profile.id),
    prisma.institutionMember.findMany({
      where: { candidateId: profile.id, status: { in: ['CLAIMED', 'ACTIVE'] } },
      orderBy: { claimedAt: 'desc' },
      select: { institution: { select: { slug: true, name: true, programBrandName: true } } },
    }),
    getAlumniNetworkOptions(profile.id),
  ])
  const joined = networks.filter((n) => n.joined)
  const empty = !program && institutions.length === 0 && joined.length === 0

  // The redesign (docs/candidate-redesign.md): every group in one list, then the ways to join more.
  if (isRedesignOn(profile.email)) {
    const count = (program ? 1 : 0) + institutions.length + joined.length
    captureServerEvent(profile.id, 'groups_viewed', { groups: count, program: Boolean(program), institutions: institutions.length, alumni: joined.length })
    return (
      <div className="space-y-8">
        <PageHeader
          title="Alumni and groups"
          intro={groupsIntro(count)}
          action={
            <TrackedAction variant="primary" href="#join" event="group_join_started" properties={{ source: 'groups_primary', groups: count }}>
              Join a group
            </TrackedAction>
          }
        />
        <NetworkParts current="alumni" />
        {count === 0 ? (
          <EmptyCard
            title="No groups yet"
            why="If your employer, college or a program invited you, use the link in their email. Alumni networks open once five members share a school or past employer."
          />
        ) : (
          <Section id="mine" title="Your groups">
            <RowList label="Your groups">
              {program && (
                <ListRow
                  title={program.name}
                  why="Through a former employer."
                  fact={`Provided by ${program.orgName}. They never see your search, only whether you land, if you choose to share it.`}
                />
              )}
              {institutions.map(({ institution: i }) => (
                <ListRow
                  key={i.slug}
                  name={i.programBrandName ?? i.name}
                  title={i.programBrandName ?? i.name}
                  why="College and career services."
                  actions={
                    <TrackedAction variant="secondary" href={`/i/${i.slug}/candidate`} event="group_portal_opened" properties={{ slug: i.slug, source: 'groups_list' }}>
                      Open portal
                    </TrackedAction>
                  }
                />
              ))}
              {joined.map((n) => (
                <ListRow key={`${n.kind}:${n.refId}`} name={n.name} title={n.name} why={n.kind === 'SCHOOL' ? 'Alumni network for your school.' : 'Alumni network for a past employer.'} fact={`${n.memberCount} members`} />
              ))}
            </RowList>
            {joined.length > 0 && (
              <TrackedAction variant="text" href="/dashboard/community" event="community_opened" properties={{ source: 'groups' }}>
                See posts from your groups
              </TrackedAction>
            )}
          </Section>
        )}
        <div id="join" className="scroll-mt-4">
          <Section id="join-title" title="Find more groups">
            <AlumniNetworkOptions candidateId={profile.id} redesign />
          </Section>
        </div>
        <TrackedAction variant="text" href="/dashboard/universities" event="universities_opened" properties={{ source: 'groups' }}>
          See your schools and alumni counts
        </TrackedAction>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">My groups</h1>
        <p className="max-w-2xl text-muted-foreground">
          Your outplacement program, colleges and alumni networks. Join as many as apply. Each one can share jobs, learning and people, and you decide what any
          group can see about you.
        </p>
      </div>

      {empty && (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="If your employer, college or a program invited you, use the link in their email. Alumni networks open once five members share a school or past employer."
        />
      )}

      {program && (
        <section className="space-y-2" aria-labelledby="g-program">
          <h2 id="g-program" className="text-sm font-semibold">
            Through a former employer
          </h2>
          <div className="flex items-start gap-3 rounded-lg border border-border p-4">
            <Handshake className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="text-sm">
              <p className="font-medium">{program.name}</p>
              <p className="text-muted-foreground">Provided by {program.orgName}. They never see your search; only whether you land, if you choose to share it.</p>
            </div>
          </div>
        </section>
      )}

      {institutions.length > 0 && (
        <section className="space-y-2" aria-labelledby="g-colleges">
          <h2 id="g-colleges" className="text-sm font-semibold">
            Colleges and career services
          </h2>
          <ul className="space-y-2">
            {institutions.map(({ institution: i }) => (
              <li key={i.slug} className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 text-sm">
                <span className="flex items-center gap-3">
                  <GraduationCap className="size-4 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{i.programBrandName ?? i.name}</span>
                </span>
                <Link href={`/i/${i.slug}/candidate`} className="font-medium text-brand underline underline-offset-4">
                  Open portal
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {joined.length > 0 && (
        <section className="space-y-2" aria-labelledby="g-alumni">
          <h2 id="g-alumni" className="text-sm font-semibold">
            Alumni networks you joined
          </h2>
          <ul className="space-y-2">
            {joined.map((n) => (
              <li key={`${n.kind}:${n.refId}`} className="flex items-center gap-3 rounded-lg border border-border p-4 text-sm">
                {n.kind === 'SCHOOL' ? <GraduationCap className="size-4 text-muted-foreground" aria-hidden /> : <Building2 className="size-4 text-muted-foreground" aria-hidden />}
                <span className="font-medium">{n.name}</span>
                <span className="text-muted-foreground">· {n.memberCount} members</span>
              </li>
            ))}
          </ul>
          <Link href="/dashboard/community" className="inline-block text-sm font-medium text-brand underline underline-offset-4">
            See posts from your groups
          </Link>
        </section>
      )}

      <div className="rounded-lg border border-border">
        <AlumniNetworkOptions candidateId={profile.id} />
      </div>

      <p className="text-sm text-muted-foreground">
        Looking at where you studied? <Link href="/dashboard/universities" className="font-medium text-brand underline underline-offset-4">See your schools and alumni counts</Link>.
      </p>
    </div>
  )
}
