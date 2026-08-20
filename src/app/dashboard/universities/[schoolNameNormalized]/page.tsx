import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getMemberDisplayIdentity, buildMemberProfileSlug } from '@/lib/contacts/member-profile'
import { AvatarDisplay } from '@/components/ui/avatar-display'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ schoolNameNormalized: string }>
}): Promise<Metadata> {
  const { schoolNameNormalized } = await params
  const entry = await prisma.educationEntry.findFirst({
    where: { schoolNameNormalized: decodeURIComponent(schoolNameNormalized) },
    select: { schoolName: true },
  })
  return { title: entry ? `${entry.schoolName} — Universities` : 'Universities' }
}

export default async function UniversityAlumniPage({
  params,
}: {
  params: Promise<{ schoolNameNormalized: string }>
}) {
  const { schoolNameNormalized: rawParam } = await params
  const schoolNameNormalized = decodeURIComponent(rawParam)
  const profile = await getDashboardData()

  // Only ever reachable for a school this candidate has themselves — same
  // "your own contacts/education" gating spirit as the rest of Contacts.
  const ownEntry = await prisma.educationEntry.findFirst({
    where: { candidateId: profile.id, schoolNameNormalized },
    select: { schoolName: true },
  })
  if (!ownEntry) notFound()

  const alumni = await prisma.candidateProfile.findMany({
    where: {
      id: { not: profile.id },
      isSystemAccount: false,
      confidentialSearchMode: false,
      privacyTier: { in: ['PUBLIC', 'SEMI_PUBLIC'] },
      educationHistory: { some: { schoolNameNormalized } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profilePictureUrl: true,
      privacyTier: true,
      primaryFunction: true,
      industryContext: true,
      confirmedSkillsHave: true,
      resumeKeywords: true,
      educationHistory: {
        where: { schoolNameNormalized },
        select: { degree: true, fieldOfStudy: true, graduationDate: true },
        orderBy: { graduationDate: 'desc' },
        take: 1,
      },
      workHistory: {
        orderBy: { startDate: 'desc' },
        select: { roleTitle: true, companyName: true },
        take: 1,
      },
    },
    orderBy: { firstName: 'asc' },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/dashboard/universities"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to Universities
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{ownEntry.schoolName}</h1>
        <p className="text-muted-foreground">
          {alumni.length} fellow NextChapter member{alumni.length === 1 ? '' : 's'} from {ownEntry.schoolName}.
        </p>
      </div>

      {alumni.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          No other members from {ownEntry.schoolName} with a public profile yet.
        </p>
      ) : (
        <div className="space-y-3">
          {alumni.map((alum) => {
            const { displayName, showPhoto } = getMemberDisplayIdentity(alum)
            const education = alum.educationHistory[0]
            const role = alum.workHistory[0]
            const skills = alum.confirmedSkillsHave.length > 0 ? alum.confirmedSkillsHave : alum.resumeKeywords
            return (
              <Link
                key={alum.id}
                href={`/dashboard/contacts/members/${encodeURIComponent(buildMemberProfileSlug(displayName, alum.id))}`}
                className="flex items-start gap-3 rounded-lg border border-border p-4 hover:bg-muted/50"
              >
                {showPhoto && <AvatarDisplay name={displayName} url={alum.profilePictureUrl} size={40} />}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-foreground">{displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {[education?.degree, education?.fieldOfStudy, education?.graduationDate?.getFullYear()]
                      .filter(Boolean)
                      .join(' · ') || 'No degree details on file'}
                  </p>
                  {role && (
                    <p className="text-sm text-muted-foreground">
                      {[role.roleTitle, role.companyName].filter(Boolean).join(' at ')}
                    </p>
                  )}
                  {(alum.primaryFunction || alum.industryContext) && (
                    <p className="text-sm text-muted-foreground">
                      {[alum.primaryFunction, alum.industryContext].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {skills.slice(0, 6).map((skill) => (
                        <span key={skill} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
