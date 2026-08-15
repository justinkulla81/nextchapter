'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { hasRoleGrant } from '@/lib/auth/role-grants'
import { isActiveMember } from '@/lib/membership/subscription'
import { proposeListing, type ProposeListingInput } from '@/lib/benefits-network/verification'

export type FormState = { error?: string; success?: string } | undefined

async function requireCandidate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { user, profile: await getOrCreateCandidateProfile(user.id) }
}

// §A4.2 step 4 -- "members redeem by code or link." Gated on active
// Membership (Benefits Network is a Membership perk per the plan catalog's
// own feature list, §A2.4) -- a non-member sees the listing and its full
// details for discovery, but redeeming requires membership, same as the
// locked-grade philosophy elsewhere in this product (hiding the whole thing
// removes the reason to upgrade).
export async function redeemListing(_prevState: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireCandidate()
  if (!ctx) return { error: 'You need to be logged in to do this.' }

  const listingId = formData.get('listingId') as string
  if (!listingId) return { error: 'Missing listing.' }

  const isMember = await isActiveMember(ctx.profile.id)
  if (!isMember) return { error: 'Redeeming Benefits Network offers is a Membership perk — become a Member first.' }

  const listing = await prisma.benefitsNetworkListing.findUnique({ where: { id: listingId } })
  if (!listing || listing.status !== 'LISTED' || listing.expiresAt < new Date()) {
    return { error: 'This offer is no longer available.' }
  }

  await prisma.benefitsNetworkRedemption.upsert({
    where: { listingId_candidateId: { listingId, candidateId: ctx.profile.id } },
    update: {},
    create: { listingId, candidateId: ctx.profile.id },
  })

  // §A4.2 step 5 -- "credited to the alum in points and standing." A plain
  // increment on the alum's own counter, only on a genuinely new redemption
  // (upsert above no-ops the update branch, so a repeat click doesn't
  // double-credit -- checked via a fresh read rather than trusting upsert's
  // return shape to distinguish create from update).
  const redemptionCount = await prisma.benefitsNetworkRedemption.count({ where: { listingId, candidateId: ctx.profile.id } })
  if (redemptionCount === 1) {
    await prisma.candidateProfile.update({
      where: { id: listing.alumId },
      data: { benefitsNetworkPoints: { increment: 1 } },
    })
  }

  captureServerEvent(ctx.profile.id, 'benefits_listing_redeemed', { listingId, alumId: listing.alumId })
  revalidatePath('/dashboard/benefits-network')
  return { success: 'Redeemed — see the instructions below.' }
}

export async function rateListing(_prevState: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireCandidate()
  if (!ctx) return { error: 'You need to be logged in to do this.' }

  const listingId = formData.get('listingId') as string
  const rating = Number(formData.get('rating'))
  const comment = (formData.get('comment') as string | null)?.trim() || null
  if (!listingId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: 'Choose a rating from 1 to 5.' }
  }

  // Ratings are only meaningful from someone who actually redeemed the
  // offer -- a real guardrail against drive-by ratings, consistent with
  // §A4.4's "light curation gate."
  const redeemed = await prisma.benefitsNetworkRedemption.findUnique({
    where: { listingId_candidateId: { listingId, candidateId: ctx.profile.id } },
  })
  if (!redeemed) return { error: 'Redeem this offer before rating it.' }

  await prisma.benefitsNetworkRating.upsert({
    where: { listingId_candidateId: { listingId, candidateId: ctx.profile.id } },
    update: { rating, comment },
    create: { listingId, candidateId: ctx.profile.id, rating, comment },
  })

  captureServerEvent(ctx.profile.id, 'benefits_listing_rated', { listingId, rating })
  revalidatePath('/dashboard/benefits-network')
  return { success: 'Thanks for the rating.' }
}

// §A4.4 "member reports it in one tap." Deliberately minimal — a listingId
// and an optional reason, reviewed in the admin queue.
export async function reportListing(_prevState: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireCandidate()
  if (!ctx) return { error: 'You need to be logged in to do this.' }

  const listingId = formData.get('listingId') as string
  const reason = (formData.get('reason') as string | null)?.trim() || null
  if (!listingId) return { error: 'Missing listing.' }

  await prisma.benefitsNetworkReport.create({
    data: { listingId, reportedByCandidateId: ctx.profile.id, reason },
  })

  captureServerEvent(ctx.profile.id, 'benefits_listing_reported', { listingId })
  revalidatePath('/dashboard/benefits-network')
  return { success: 'Reported — an admin will review this.' }
}

function parseTags(raw: string | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8)
}

// §A4.2 step 1 -- alum proposes: institution, program, terms, discount, seat
// count, expiry, redemption method. Gated on the `alum` role -- only
// candidates who've actually landed (and therefore have a real institutional
// relationship worth sourcing from) can propose. See proposeListing
// (src/lib/benefits-network/verification.ts) for what happens next (§A4.2
// step 2, institutional-email verification).
export async function submitListingProposal(_prevState: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireCandidate()
  if (!ctx) return { error: 'You need to be logged in to do this.' }

  const isAlum = await hasRoleGrant(ctx.user.id, 'alum')
  if (!isAlum) return { error: 'Benefits Network listings can be proposed once you\'re a NextChapter alum.' }

  const institutionName = (formData.get('institutionName') as string | null)?.trim()
  const institutionEmail = (formData.get('institutionEmail') as string | null)?.trim()
  const programName = (formData.get('programName') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim()
  const fullCostNote = (formData.get('fullCostNote') as string | null)?.trim()
  const discountDescription = (formData.get('discountDescription') as string | null)?.trim()
  const redemptionMethod = formData.get('redemptionMethod') as 'CODE' | 'LINK' | 'EMAIL_INTRO'
  const redemptionValue = (formData.get('redemptionValue') as string | null)?.trim()
  const redemptionInstructions = (formData.get('redemptionInstructions') as string | null)?.trim()
  const functionValue = formData.get('function') as string
  const level = formData.get('level') as string
  const format = formData.get('format') as string
  const costType = formData.get('costType') as string
  const timeCommitment = formData.get('timeCommitment') as string
  const credentialType = formData.get('credentialType') as string
  const seatCountRaw = (formData.get('seatCount') as string | null)?.trim()
  const expiresAtRaw = formData.get('expiresAt') as string | null
  const reviewDateRaw = formData.get('reviewDate') as string | null
  const skillGapTags = parseTags(formData.get('skillGapTags') as string | null)

  if (
    !institutionName ||
    !institutionEmail ||
    !programName ||
    !description ||
    !fullCostNote ||
    !discountDescription ||
    !redemptionValue ||
    !redemptionInstructions ||
    !functionValue ||
    !level ||
    !format ||
    !costType ||
    !timeCommitment ||
    !credentialType ||
    !expiresAtRaw ||
    !reviewDateRaw
  ) {
    return { error: 'Fill in every field — the full cost note especially matters, per our guardrails.' }
  }

  const expiresAt = new Date(expiresAtRaw)
  const reviewDate = new Date(reviewDateRaw)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
    return { error: 'Choose an expiry date in the future.' }
  }
  if (Number.isNaN(reviewDate.getTime())) {
    return { error: 'Choose a valid review date.' }
  }

  const input: ProposeListingInput = {
    alumId: ctx.profile.id,
    institutionName,
    institutionEmail,
    programName,
    description,
    fullCostNote,
    discountDescription,
    seatCount: seatCountRaw ? Number(seatCountRaw) : null,
    redemptionMethod,
    redemptionValue,
    redemptionInstructions,
    function: functionValue,
    level,
    format,
    costType,
    timeCommitment,
    credentialType,
    skillGapTags,
    expiresAt,
    reviewDate,
  }

  const result = await proposeListing(input)
  if ('error' in result) return { error: result.error }

  revalidatePath('/dashboard/benefits-network')
  revalidatePath('/dashboard/benefits-network/propose')
  return { success: 'Proposal submitted. We\'ve emailed a confirmation link to the institutional email you provided — the listing goes live once that\'s confirmed.' }
}
