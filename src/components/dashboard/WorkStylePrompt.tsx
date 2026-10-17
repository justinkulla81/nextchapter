import { loadWorkProfile } from '@/lib/profile/work-profile-load'
import { missingDims, WORK_DIMS, type WorkDim } from '@/lib/profile/work-profile'
import { WorkStyleCard } from './WorkStyleCard'

// Asks the work-profile dimensions we can't already infer. `limit` keeps the
// dashboard version to a few quick taps; `all` shows every dimension so the
// person can review and change answers.
export async function WorkStylePrompt({ candidateId, limit, all = false }: { candidateId: string; limit?: number; all?: boolean }) {
  const profile = await loadWorkProfile(candidateId).catch(() => null)
  if (!profile) return null
  const dims: WorkDim[] = all ? WORK_DIMS.map((d) => d.key) : missingDims(profile).slice(0, limit ?? 10)
  if (!dims.length) return null
  const current = Object.fromEntries(dims.filter((d) => profile[d]?.from.includes('Your answer')).map((d) => [d, profile[d]!.value]))
  return (
    <WorkStyleCard
      dims={dims}
      current={current}
      title={all ? 'How you like to work' : 'A few quick ones: how do you like to work?'}
      intro={
        all
          ? 'Ten this-or-that questions. Where you haven’t answered, we estimate from your assessments; your own answer always wins.'
          : 'Tap the one that’s more you. It sharpens your job matches and pivot paths.'
      }
    />
  )
}
