'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { PACKAGE_NUMBER_FIELDS, parsePackageWishes, type PackageNumberKey } from '@/lib/review-prep/package-wishes'

export type PackageWishesState = { error?: string; saved?: boolean } | undefined

// What the member wants in a package besides pay (the Pay page's "what to ask
// for" list). Optional: nothing else waits on it. benefitsPrioritiesBonusAt is
// still set the first time, as the "answered, ever" mark the profile checklist
// reads.
export async function savePackageWishes(_prev: PackageWishesState, formData: FormData): Promise<PackageWishesState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Your session ended. Sign in again, and your answers will still be here.' }
  const profile = await getOrCreateCandidateProfile(user.id)

  const numbers = Object.fromEntries(
    PACKAGE_NUMBER_FIELDS.map((f) => [f.name, (formData.get(f.name) as string | null) ?? null])
  ) as Record<PackageNumberKey, string | null>
  const parsed = parsePackageWishes({ benefits: formData.getAll('benefits').map(String), numbers })
  if (!parsed.ok) return { error: parsed.error }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      ...parsed.wishes,
      ...(profile.benefitsPrioritiesBonusAt ? {} : { benefitsPrioritiesBonusAt: new Date() }),
    },
  })

  captureServerEvent(profile.id, 'package_wishes_saved', {
    candidateId: profile.id,
    benefits: Object.entries(parsed.wishes)
      .filter(([key, value]) => key.startsWith('wants') && value === true)
      .map(([key]) => key),
    ptoWeeksExpected: parsed.wishes.ptoWeeksExpected,
    remoteDaysPerWeekDesired: parsed.wishes.remoteDaysPerWeekDesired,
    paidParentalLeaveWeeksExpected: parsed.wishes.paidParentalLeaveWeeksExpected,
    firstTime: !profile.benefitsPrioritiesBonusAt,
    source: 'pay',
  })

  revalidatePath('/dashboard/pay')
  revalidatePath('/dashboard/complete-profile')
  revalidatePath('/dashboard')
  return { saved: true }
}
