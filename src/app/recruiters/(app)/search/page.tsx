import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { computeMatchScore } from '@/lib/matching/compute-match-score'
import { captureServerEvent } from '@/lib/posthog/server'
import { HIGHEST_LEVEL_OPTIONS, PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import type { CandidateProfile, Prisma } from '@prisma/client'

export const maxDuration = 30

const REMOTE_OPTIONS = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'Onsite' },
  { value: 'flexible', label: 'Flexible' },
]

function displayIdentity(
  candidate: Pick<CandidateProfile, 'privacyTier' | 'firstName' | 'lastName' | 'highestLevelReached' | 'primaryFunction'>
): string {
  if (candidate.privacyTier === 'PUBLIC' && candidate.firstName) {
    return `${candidate.firstName} ${candidate.lastName?.charAt(0) ?? ''}.`.trim()
  }
  const level = candidate.highestLevelReached ?? 'Experienced'
  const fn = candidate.primaryFunction ?? 'professional'
  return `${level} ${fn} professional`
}

export default async function RecruiterSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/recruiters/login')

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) redirect('/recruiters/signup')

  const params = await searchParams
  const fn = params.function || ''
  const level = params.level || ''
  const remote = params.remote || ''
  const location = params.location?.trim() || ''
  const compMax = params.compMax ? parseInt(params.compMax, 10) : null

  const where: Prisma.CandidateProfileWhereInput = {
    recruiterDatabaseOptIn: true,
    privacyTier: { in: ['PUBLIC', 'SEMI_PUBLIC', 'PRIVATE'] },
    assessmentComplete: true,
    ...(fn && { primaryFunction: fn }),
    ...(level && { highestLevelReached: level }),
    ...(remote && { remotePreference: remote }),
    ...(location && {
      OR: [
        { currentCity: { contains: location, mode: 'insensitive' } },
        { currentState: { contains: location, mode: 'insensitive' } },
      ],
    }),
  }

  const candidates = await prisma.candidateProfile.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      privacyTier: true,
      firstName: true,
      lastName: true,
      highestLevelReached: true,
      primaryFunction: true,
      currentCity: true,
      currentState: true,
      remotePreference: true,
      openToRelocation: true,
      targetCompMin: true,
      compFlexible: true,
      levelRankScore: true,
      priorityMaxComp: true,
      priorityWorkLife: true,
    },
  })

  const roleFilter = {
    primaryFunction: fn || null,
    roleLevel: level || null,
    remotePolicy: remote || null,
    locationRequirement: location || null,
    compMin: null,
    compMax,
  }

  const scored = candidates
    .map((candidate) => ({ candidate, match: computeMatchScore(candidate, roleFilter) }))
    .sort((a, b) => b.match.score - a.match.score)

  const hasFilters = Boolean(fn || level || remote || location || compMax)
  if (hasFilters) {
    captureServerEvent(recruiter.id, 'recruiter_search_executed', { function: fn, level, remote, location, compMax })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-16">
      <div>
        <Link href="/recruiters/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Back home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Candidate search</h1>
        <p className="mt-1 text-muted-foreground">
          Search the opted-in candidate pool. Names are only shown for candidates who&apos;ve set their
          privacy to fully public — otherwise you&apos;ll see a role-level description until they reveal
          themselves.
        </p>
      </div>

      <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2" method="get">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-foreground">Function</span>
          <select name="function" defaultValue={fn} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Any</option>
            {PRIMARY_FUNCTION_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-foreground">Level</span>
          <select name="level" defaultValue={level} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Any</option>
            {HIGHEST_LEVEL_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-foreground">Remote policy</span>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5">
              <input type="radio" name="remote" value="" defaultChecked={!remote} /> Any
            </label>
            {REMOTE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5">
                <input type="radio" name="remote" value={opt.value} defaultChecked={remote === opt.value} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-foreground">Location (city or state)</span>
          <input
            type="text"
            name="location"
            defaultValue={location}
            placeholder="e.g. Chicago"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-foreground">Comp budget (max)</span>
          <input
            type="number"
            name="compMax"
            defaultValue={compMax ?? ''}
            placeholder="e.g. 220000"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90"
          >
            Search
          </button>
        </div>
      </form>

      <div className="divide-y divide-border rounded-lg border border-border">
        {scored.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No candidates match yet — try widening your filters.
          </p>
        ) : (
          scored.map(({ candidate, match }) => (
            <Link
              key={candidate.id}
              href={`/recruiters/search/${candidate.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-muted"
            >
              <div>
                <p className="font-medium text-foreground">{displayIdentity(candidate)}</p>
                <p className="text-sm text-muted-foreground">
                  {[candidate.primaryFunction, candidate.highestLevelReached, candidate.currentCity]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                {match.label}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
