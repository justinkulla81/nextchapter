'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { parseBreadth } from '@/lib/jobs/search-breadth'
import type { ExclusiveJobPosting } from '@prisma/client'
import { liveBoardWhere } from '@/lib/jobs/board-shortlist'
import { isBoardPostingLockedForViewer } from '@/lib/jobs/job-board-visibility'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { computeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'

/**
 * Saves the member's board breadth (Narrow / Wide) as a preference: the board opens on
 * it next time, and job emails follow it (they use Narrow unless the member chose Wide).
 */
export async function saveBoardBreadth(value: string): Promise<{ ok: boolean }> {
  const breadth = parseBreadth(value)
  if (!breadth) return { ok: false }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { boardBreadth: breadth } })
  return { ok: true }
}


/** Most rows one "Show more good matches" page can ask for. */
const MORE_PAGE_MAX = 25

/**
 * The next page of "Show more good matches": the board ranked these ids (best fit first)
 * when it rendered; this loads the rows in that order with each one's fit level. Only live
 * jobs the member can open come back — the ids arrive from the browser.
 */
export async function loadMoreGoodMatches(ids: string[]): Promise<{ postings: ExclusiveJobPosting[]; fitBuckets: Record<string, FitBucket> } | null> {
  if (!Array.isArray(ids) || ids.length === 0) return { postings: [], fitBuckets: {} }
  const wanted = ids.filter((id) => typeof id === 'string' && id.length <= 40).slice(0, MORE_PAGE_MAX)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const profile = await getOrCreateCandidateProfile(user.id)
  const [rows, unlock] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({ where: { AND: [liveBoardWhere(), { id: { in: wanted } }] } }),
    isDossierUnlocked(profile.id),
  ])
  const byId = new Map(rows.filter((p) => !isBoardPostingLockedForViewer(p, unlock.unlocked)).map((p) => [p.id, p]))
  const postings = wanted.map((id) => byId.get(id)).filter((p): p is ExclusiveJobPosting => !!p)
  return { postings, fitBuckets: Object.fromEntries(postings.map((p) => [p.id, computeBoardListingFitBucket(profile, p)])) }
}
