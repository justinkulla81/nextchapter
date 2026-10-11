import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { HIGHEST_LEVEL_OPTIONS, PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { listPoolCandidates, MAX_PENDING_REQUESTS } from '@/lib/recruiter/introduction-requests'
import { SubmitButton } from '@/components/ui/submit-button'
import { requestIntroductionFromPool } from './actions'

export const maxDuration = 30

const input = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'

export default async function RecruiterPoolPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const supabase = await createClient('recruiter')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/recruiters/login')
  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) redirect('/recruiters/signup')

  const p = await searchParams
  const filters = {
    function: p.function || undefined,
    level: p.level || undefined,
    location: p.location?.trim().slice(0, 80) || undefined,
    school: p.school?.trim().slice(0, 80) || undefined,
    industry: p.industry?.trim().slice(0, 80) || undefined,
  }
  const [candidates, pending] = await Promise.all([
    listPoolCandidates(recruiter.id, user.id, filters),
    prisma.recruiterCandidateIntroduction.count({ where: { recruiterId: recruiter.id, status: 'REQUESTED' } }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-16">
      <div>
        <Link href="/recruiters/search" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Candidate search
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Find candidates</h1>
        <p className="mt-1 text-muted-foreground">
          People who have chosen to be found by recruiters. You see a role-level description only. Ask for an
          introduction and the candidate decides; their profile opens to you only if they say yes. You have{' '}
          {pending} of {MAX_PENDING_REQUESTS} requests waiting on an answer.
        </p>
      </div>

      <form method="get" className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Function</span>
          <select name="function" defaultValue={filters.function ?? ''} className={input}>
            <option value="">Any</option>
            {PRIMARY_FUNCTION_OPTIONS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Level</span>
          <select name="level" defaultValue={filters.level ?? ''} className={input}>
            <option value="">Any</option>
            {HIGHEST_LEVEL_OPTIONS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {[
          ['location', 'Location (city or state)', filters.location],
          ['industry', 'Industry', filters.industry],
          ['school', 'School', filters.school],
        ].map(([name, label, value]) => (
          <label key={name} className="text-sm">
            <span className="mb-1 block font-medium">{label}</span>
            <input name={name} defaultValue={value ?? ''} className={input} />
          </label>
        ))}
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">
            Search
          </button>
        </div>
      </form>

      <div className="divide-y divide-border rounded-lg border border-border">
        {candidates.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No one in the pool matches yet. Try widening the filters.</p>
        ) : (
          candidates.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium text-foreground">
                  {c.privacyTier === 'PUBLIC' && c.firstName
                    ? `${c.firstName} ${c.lastName?.charAt(0) ?? ''}.`.trim()
                    : `${c.highestLevelReached ?? 'Experienced'} ${c.primaryFunction ?? 'professional'}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[c.primaryFunction, c.highestLevelReached, c.currentCity, c.currentState].filter(Boolean).join(' · ')}
                </p>
              </div>
              <form action={requestIntroductionFromPool.bind(null, c.id)}>
                <SubmitButton size="sm" pendingLabel="Asking…">
                  Ask for an introduction
                </SubmitButton>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
