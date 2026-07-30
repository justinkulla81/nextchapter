import 'server-only'
import {
  matchRejection,
  matchOffer,
  matchInterviewInvite,
  matchApplicationConfirmation,
  matchRecruiterOutreach,
  matchThankYou,
  matchFollowUp,
  matchCheckIn,
  matchIntroRequest,
} from './ats-patterns'

export interface ClassificationResult {
  activityType:
    | 'APPLICATION_CONFIRMATION'
    | 'RECRUITER_OUTREACH'
    | 'INTERVIEW_INVITE'
    | 'REJECTION'
    | 'OFFER'
    | 'THANK_YOU'
    | 'FOLLOW_UP'
    | 'CHECK_IN'
    | 'INTRO_REQUEST'
    | 'NEEDS_REVIEW'
  confidence: 'high' | 'low'
  companyName: string | null
}

// Best-effort company-name guess from the sender's domain — deliberately
// rough (this is a nice-to-have annotation, not load-bearing for
// classification itself). Returns null rather than guessing on consumer/ATS
// mail-relay domains, where the domain tells you nothing about the company.
const NON_COMPANY_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'greenhouse.io', 'lever.co', 'myworkday.com', 'ashbyhq.com', 'smartrecruiters.com',
  'linkedin.com', 'indeed.com',
])

function guessCompanyFromDomain(fromAddress: string): string | null {
  const match = fromAddress.match(/@([a-z0-9.-]+)$/i)
  if (!match) return null
  const domain = match[1].toLowerCase()
  const root = domain.split('.').slice(-2).join('.')
  if (NON_COMPANY_DOMAINS.has(root)) return null
  const name = domain.split('.')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function classifyInboundEmail(subject: string, bodyPreview: string, fromAddress: string): ClassificationResult {
  const companyName = guessCompanyFromDomain(fromAddress)

  // Rejections first and given priority — the easiest to detect (most
  // standardized ATS phrasing) and the one with the most downstream value,
  // since it's what triggers Victoria's supportive reframe.
  const rejection = matchRejection(subject, bodyPreview)
  if (rejection.matched) return { activityType: 'REJECTION', confidence: rejection.confidence, companyName }

  const offer = matchOffer(subject, bodyPreview)
  if (offer.matched) return { activityType: 'OFFER', confidence: offer.confidence, companyName }

  const interview = matchInterviewInvite(subject, bodyPreview)
  if (interview.matched) return { activityType: 'INTERVIEW_INVITE', confidence: interview.confidence, companyName }

  const confirmation = matchApplicationConfirmation(subject, bodyPreview)
  if (confirmation.matched) {
    return { activityType: 'APPLICATION_CONFIRMATION', confidence: confirmation.confidence, companyName }
  }

  const outreach = matchRecruiterOutreach(subject, bodyPreview, fromAddress)
  if (outreach.matched) return { activityType: 'RECRUITER_OUTREACH', confidence: outreach.confidence, companyName }

  return { activityType: 'NEEDS_REVIEW', confidence: 'low', companyName }
}

export function classifyOutboundEmail(subject: string, bodyPreview: string, toAddress: string): ClassificationResult {
  const companyName = guessCompanyFromDomain(toAddress)

  const thankYou = matchThankYou(subject, bodyPreview)
  if (thankYou.matched) return { activityType: 'THANK_YOU', confidence: thankYou.confidence, companyName }

  const introRequest = matchIntroRequest(subject, bodyPreview)
  if (introRequest.matched) return { activityType: 'INTRO_REQUEST', confidence: introRequest.confidence, companyName }

  const followUp = matchFollowUp(subject, bodyPreview)
  if (followUp.matched) return { activityType: 'FOLLOW_UP', confidence: followUp.confidence, companyName }

  const checkIn = matchCheckIn(subject, bodyPreview)
  if (checkIn.matched) return { activityType: 'CHECK_IN', confidence: checkIn.confidence, companyName }

  return { activityType: 'NEEDS_REVIEW', confidence: 'low', companyName }
}
