import type { Metadata } from 'next'
import Link from 'next/link'
import { GraduationCap, Building2, Handshake, Users } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getAlumniNetworkOptions } from '@/lib/community/alumni-networks'
import { programForCandidate } from '@/lib/employer/program-server'
import { AlumniNetworkOptions } from '@/components/community/AlumniNetworkOptions'
import { EmptyState } from '@/components/ui/empty-state'

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
