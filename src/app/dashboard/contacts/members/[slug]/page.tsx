import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MapPin, Target, HandHeart } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { isMemberProfilePublic, getMemberDisplayIdentity, extractCandidateIdFromMemberSlug } from '@/lib/contacts/member-profile'
import { selectDisplayedWorkHistory, sanitizeRoleTitle } from '@/lib/work-history/sanitize'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { Button } from '@/components/ui/button'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const id = extractCandidateIdFromMemberSlug(decodeURIComponent(slug))
  const candidate = await prisma.candidateProfile.findUnique({ where: { id }, select: { firstName: true } })
  return { title: candidate?.firstName ? `${candidate.firstName} — Contacts` : 'Contacts' }
}

export default async function MemberProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const id = extractCandidateIdFromMemberSlug(decodeURIComponent(slug))
  const viewer = await getDashboardData()

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profilePictureUrl: true,
      privacyTier: true,
      confidentialSearchMode: true,
      currentCity: true,
      currentState: true,
      currentCountry: true,
      targetRoleType: true,
      targetIndustries: true,
      linkedInUrl: true,
      confirmedSkillsHave: true,
      resumeKeywords: true,
      canTeach: true,
      knownFor: true,
      workHistory: { orderBy: { startDate: 'desc' } },
    },
  })

  const isSelf = candidate?.id === viewer.id
  if (!candidate || (!isSelf && !isMemberProfilePublic(candidate))) notFound()

  const { displayName, showPhoto } = getMemberDisplayIdentity(candidate)
  const skills = candidate.confirmedSkillsHave.length > 0 ? candidate.confirmedSkillsHave : candidate.resumeKeywords
  const displayedHistory = selectDisplayedWorkHistory(candidate.workHistory)
  const location = [candidate.currentCity, candidate.currentState].filter(Boolean).join(', ') || candidate.currentCountry

  const normalizedCompanyNames = [...new Set(displayedHistory.map((e) => e.companyNameNormalized).filter(Boolean))]
  const matchedCompanies =
    normalizedCompanyNames.length > 0
      ? await prisma.company.findMany({
          where: { canonicalNameNormalized: { in: normalizedCompanyNames } },
          select: { id: true, canonicalNameNormalized: true, name: true },
        })
      : []
  const companyByNormalizedName = new Map(matchedCompanies.map((c) => [c.canonicalNameNormalized, c]))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/dashboard/network/contacts?scope=nextchapter"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to Contacts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {showPhoto && <AvatarDisplay name={displayName} url={candidate.profilePictureUrl} size={56} />}
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{displayName}</h1>
            {location && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden />
                {location}
              </p>
            )}
          </div>
        </div>
        {!isSelf && (
          <Button nativeButton={false} render={<Link href={`/dashboard/community?tab=messages&with=${candidate.id}`} />}>
            <HandHeart className="size-4" aria-hidden data-icon="inline-start" />
            Offer to help
          </Button>
        )}
      </div>

      {candidate.knownFor && <p className="text-sm text-foreground">{candidate.knownFor}</p>}

      {(candidate.targetRoleType || candidate.targetIndustries.length > 0) && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <Target className="size-3.5" aria-hidden />
            Targeting
          </p>
          <p className="text-sm text-foreground">
            {[candidate.targetRoleType, candidate.targetIndustries.join(', ')].filter(Boolean).join(' — ')}
          </p>
        </div>
      )}

      {skills.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <span key={skill} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {candidate.canTeach.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Can help others with</p>
          <div className="flex flex-wrap gap-1.5">
            {candidate.canTeach.map((topic) => (
              <span key={topic} className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {displayedHistory.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Past companies</p>
          <div className="space-y-2">
            {displayedHistory.map((entry) => {
              const company = companyByNormalizedName.get(entry.companyNameNormalized)
              return (
                <div key={entry.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium text-foreground">{sanitizeRoleTitle(entry.roleTitle)}</p>
                  {company ? (
                    <Link href={`/dashboard/companies/${encodeURIComponent(company.canonicalNameNormalized)}`} className="text-primary underline underline-offset-4">
                      {company.name}
                    </Link>
                  ) : (
                    <p className="text-muted-foreground">{entry.companyName}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {candidate.linkedInUrl && (
        <a
          href={candidate.linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4"
        >
          LinkedIn profile
        </a>
      )}
    </div>
  )
}
