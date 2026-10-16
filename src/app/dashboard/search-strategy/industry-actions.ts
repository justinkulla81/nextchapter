'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'

/** Saves the industries the member confirmed (industry-reading.ts): the board, emails and market size use them. */
export async function confirmIndustryBuckets(buckets: string[]): Promise<{ ok: boolean }> {
  const valid = [...new Set((Array.isArray(buckets) ? buckets : []).filter((b) => INDUSTRY_BUCKET_NAMES.includes(b) && b !== 'Other'))].slice(0, 4)
  if (valid.length === 0) return { ok: false }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { industryBuckets: valid, industryBucketsConfirmedAt: new Date() } })
  revalidatePath('/dashboard/search-strategy')
  return { ok: true }
}
