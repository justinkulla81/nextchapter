import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendBenefitsNetworkVerifyEmail } from '@/lib/email/send-benefits-network-verify'
import { captureServerEvent } from '@/lib/posthog/server'

const VERIFICATION_EXPIRY_DAYS = 14

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// Same "obviously not a real institution" domain blocklist used nowhere else
// in this codebase yet — a cheap first check before even sending the
// confirmation email. The REAL verification is the confirmation-link click
// from that inbox (see confirmBenefitsNetworkVerification below); this list
// only stops the most obvious "I typed my own gmail as the institutional
// email" mistake/abuse up front.
const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'live.com',
  'msn.com',
])

export interface ProposeListingInput {
  alumId: string
  institutionName: string
  institutionEmail: string
  programName: string
  description: string
  fullCostNote: string
  discountDescription: string
  seatCount: number | null
  redemptionMethod: 'CODE' | 'LINK' | 'EMAIL_INTRO'
  redemptionValue: string
  redemptionInstructions: string
  function: string
  level: string
  format: string
  costType: string
  timeCommitment: string
  credentialType: string
  skillGapTags: string[]
  expiresAt: Date
  reviewDate: Date
}

export type ProposeListingResult = { error: string } | { listingId: string }

// §A4.2 steps 1-2: an alum proposes a listing, which requires institutional-
// email verification BEFORE it can ever appear in the catalog. Creates the
// listing PENDING_VERIFICATION (never returned by getCatalogListings) plus
// the one BenefitsNetworkVerification row, and emails the confirmation link
// to the institutional address — not the alum's own account email.
export async function proposeListing(input: ProposeListingInput): Promise<ProposeListingResult> {
  const emailDomain = input.institutionEmail.split('@')[1]?.toLowerCase()
  if (!emailDomain) return { error: 'Enter a valid institutional email address.' }
  if (CONSUMER_EMAIL_DOMAINS.has(emailDomain)) {
    return { error: 'Use an email address at the institution\'s own domain, not a personal email provider.' }
  }

  const alum = await prisma.candidateProfile.findUnique({
    where: { id: input.alumId },
    select: { firstName: true, lastName: true, email: true },
  })
  if (!alum) return { error: 'Could not find your profile.' }
  if (alum.email && alum.email.toLowerCase() === input.institutionEmail.toLowerCase()) {
    return { error: 'The confirmation email must go to someone at the institution, not your own address.' }
  }

  const listing = await prisma.benefitsNetworkListing.create({
    data: {
      alumId: input.alumId,
      institutionName: input.institutionName,
      programName: input.programName,
      description: input.description,
      fullCostNote: input.fullCostNote,
      discountDescription: input.discountDescription,
      seatCount: input.seatCount,
      redemptionMethod: input.redemptionMethod,
      redemptionValue: input.redemptionValue,
      redemptionInstructions: input.redemptionInstructions,
      function: input.function,
      level: input.level,
      format: input.format,
      costType: input.costType,
      timeCommitment: input.timeCommitment,
      credentialType: input.credentialType,
      skillGapTags: input.skillGapTags,
      status: 'PENDING_VERIFICATION',
      expiresAt: input.expiresAt,
      reviewDate: input.reviewDate,
    },
  })

  const verificationExpiresAt = new Date()
  verificationExpiresAt.setDate(verificationExpiresAt.getDate() + VERIFICATION_EXPIRY_DAYS)

  const verification = await prisma.benefitsNetworkVerification.create({
    data: {
      listingId: listing.id,
      institutionEmail: input.institutionEmail,
      expiresAt: verificationExpiresAt,
    },
  })

  const alumName = [alum.firstName, alum.lastName].filter(Boolean).join(' ') || 'A NextChapter alum'
  const confirmUrl = `${appUrl()}/api/benefits-network/verify/${verification.token}`
  const emailResult = await sendBenefitsNetworkVerifyEmail({
    institutionEmail: input.institutionEmail,
    alumName,
    institutionName: input.institutionName,
    programName: input.programName,
    confirmUrl,
  })

  captureServerEvent(input.alumId, 'benefits_listing_proposed', {
    listingId: listing.id,
    institutionName: input.institutionName,
    verificationEmailSent: emailResult.sent,
  })

  return { listingId: listing.id }
}

export type ConfirmVerificationResult = { error: string } | { listingId: string; institutionName: string }

// The actual verification event — a click from the institutional inbox.
// Sets institutionDomain from the confirmed email (the real proof of
// authority a candidate sees disclosed on the listing) and flips the
// listing LISTED, making it appear in the catalog for the first time.
export async function confirmBenefitsNetworkVerification(token: string): Promise<ConfirmVerificationResult> {
  const verification = await prisma.benefitsNetworkVerification.findUnique({
    where: { token },
    include: { listing: true },
  })
  if (!verification) return { error: 'This confirmation link is invalid.' }
  if (verification.confirmedAt) return { listingId: verification.listingId, institutionName: verification.listing.institutionName }
  if (verification.expiresAt < new Date()) return { error: 'This confirmation link has expired. Ask the alum to re-propose the listing.' }

  const domain = verification.institutionEmail.split('@')[1]?.toLowerCase() ?? null

  await prisma.$transaction([
    prisma.benefitsNetworkVerification.update({
      where: { id: verification.id },
      data: { confirmedAt: new Date() },
    }),
    prisma.benefitsNetworkListing.update({
      where: { id: verification.listingId },
      data: { status: 'LISTED', institutionDomain: domain },
    }),
  ])

  captureServerEvent(verification.listing.alumId, 'benefits_listing_verified', {
    listingId: verification.listingId,
    institutionDomain: domain,
  })

  return { listingId: verification.listingId, institutionName: verification.listing.institutionName }
}
