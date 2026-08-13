import 'server-only'
import {
  matchRejection,
  matchOffer,
  matchInterviewInvite,
  matchApplicationConfirmation,
  matchRecruiterOutreach,
  matchThankYou,
  matchFollowUp,
  matchIntroRequest,
  matchNetworkingOutreach,
  guessCompanyFromConfirmationText,
  isLikelyBulkOrPromotional,
} from './ats-patterns'
import { extractDomain, extractEmailAddress } from './email-address'
import { NON_COMPANY_DOMAINS, NEXTCHAPTER_SENDING_DOMAINS } from '@/lib/text/email-domain'

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
    | 'NETWORKING_OUTREACH'
    | 'NEEDS_REVIEW'
  confidence: 'high' | 'low'
  companyName: string | null
}

// Subdomain labels that describe a mail *purpose*, not a company — real
// employers routinely route recruiting mail through one of these
// (talent.icims.com, jobalerts.omers.com, app.bamboohr.com, careers.<co>.com).
// Confirmed against real production mail: without this, "Talent
// Acquisition" mail from talent.icims.com stored the company as "Talent",
// and OMERS's own jobalerts.omers.com stored it as "Jobalerts" — the domain
// itself (omers.com) has the real employer name one level up.
const GENERIC_MAIL_SUBDOMAIN_LABELS = new Set([
  'app', 'talent', 'jobalerts', 'careers', 'jobs', 'hr', 'mail', 'notifications', 'no-reply', 'noreply', 'recruiting',
])

// Best-effort company-name guess from the sender's domain — deliberately
// rough (this is a nice-to-have annotation, not load-bearing for
// classification itself). Returns null rather than guessing on consumer/ATS
// mail-relay domains, where the domain tells you nothing about the company.
function guessCompanyFromDomain(fromAddress: string): string | null {
  const match = extractEmailAddress(fromAddress).match(/@([a-z0-9.-]+)$/i)
  if (!match) return null
  const domain = match[1].toLowerCase()
  const labels = domain.split('.')
  const root = labels.slice(-2).join('.')
  if (NON_COMPANY_DOMAINS.has(root)) return null
  const name = labels[0]
  // A generic purpose-label subdomain (talent.omers.com) tells us nothing —
  // fall back to the root domain's own name (omers.com -> "Omers") instead
  // of surfacing the generic label as if it were the company.
  const resolved = GENERIC_MAIL_SUBDOMAIN_LABELS.has(name) && labels.length > 2 ? root.split('.')[0] : name
  return resolved.charAt(0).toUpperCase() + resolved.slice(1)
}

export function classifyInboundEmail(
  subject: string,
  bodyPreview: string,
  fromAddress: string,
  hasListUnsubscribeHeader = false
): ClassificationResult {
  const companyName = guessCompanyFromDomain(fromAddress)

  // NextChapter's own transactional/admin mail — never a real job-search
  // signal, and its own copy ("your offer bonus," "a new A-grade candidate")
  // can otherwise trip REJECTION/OFFER/RECRUITER_OUTREACH matchers below.
  // Ruled out before any category matcher runs, same as bulk/promotional.
  const senderDomain = extractDomain(fromAddress)?.split('.').slice(-2).join('.') ?? null
  if (senderDomain && NEXTCHAPTER_SENDING_DOMAINS.has(senderDomain)) {
    return { activityType: 'NEEDS_REVIEW', confidence: 'low', companyName: null }
  }

  // Bulk/promotional mail (retail promos, newsletters, lead-gen follow-ups,
  // financial solicitations) can use phrasing that coincidentally matches a
  // LOW_CONFIDENCE category pattern ("keep your resume on file", "chat
  // about the role") — that's what let a CB2 rewards promo classify as a
  // REJECTION and a Force Management sales email classify as an
  // INTERVIEW_INVITE. But the bulk signal itself isn't as reliable as it
  // used to be: real ATS platforms (Greenhouse, Lever, Workday) attach a
  // List-Unsubscribe header to their transactional confirmation mail too,
  // for CAN-SPAM/bulk-sender-rules compliance, not because it's actually
  // bulk — confirmed against real production mail that this was
  // misclassifying genuine "thanks for applying" confirmations as
  // NEEDS_REVIEW. A HIGH_CONFIDENCE pattern (specific, standardized hiring
  // phrasing that's very unlikely to appear in unrelated marketing copy) is
  // allowed to win regardless of the bulk signal; only a LOW_CONFIDENCE
  // match is still filtered out when the message looks bulk.
  const isBulk = isLikelyBulkOrPromotional(subject, bodyPreview, fromAddress, hasListUnsubscribeHeader)
  const winsOverBulk = (confidence: 'high' | 'low') => confidence === 'high' || !isBulk

  // Rejections first and given priority — the easiest to detect (most
  // standardized ATS phrasing) and the one with the most downstream value,
  // since it's what triggers Victoria's supportive reframe.
  const rejection = matchRejection(subject, bodyPreview)
  if (rejection.matched && winsOverBulk(rejection.confidence)) {
    return { activityType: 'REJECTION', confidence: rejection.confidence, companyName }
  }

  const offer = matchOffer(subject, bodyPreview)
  if (offer.matched && winsOverBulk(offer.confidence)) {
    return { activityType: 'OFFER', confidence: offer.confidence, companyName }
  }

  const interview = matchInterviewInvite(subject, bodyPreview)
  if (interview.matched && winsOverBulk(interview.confidence)) {
    return { activityType: 'INTERVIEW_INVITE', confidence: interview.confidence, companyName }
  }

  const confirmation = matchApplicationConfirmation(subject, bodyPreview)
  if (confirmation.matched && winsOverBulk(confirmation.confidence)) {
    return {
      activityType: 'APPLICATION_CONFIRMATION',
      confidence: confirmation.confidence,
      companyName: companyName ?? guessCompanyFromConfirmationText(subject, bodyPreview),
    }
  }

  // Deliberately NOT given the winsOverBulk carve-out above: its
  // "high confidence" is sender-domain-based (a known recruiting-firm
  // domain), not phrasing-based — and that same domain can legitimately
  // send bulk job-alert digests alongside real personal outreach, so the
  // bulk signal is still the more trustworthy one here. Confirmed against
  // real production mail: a "171 Remote Jobs are Live" digest from a
  // recruiting-firm domain would otherwise have overridden its own
  // List-Unsubscribe header.
  const outreach = matchRecruiterOutreach(subject, bodyPreview, fromAddress)
  if (outreach.matched && !isBulk) {
    return { activityType: 'RECRUITER_OUTREACH', confidence: outreach.confidence, companyName }
  }

  return { activityType: 'NEEDS_REVIEW', confidence: 'low', companyName }
}

export function classifyOutboundEmail(subject: string, bodyPreview: string, toAddress: string): ClassificationResult {
  const companyName = guessCompanyFromDomain(toAddress)

  const thankYou = matchThankYou(subject, bodyPreview)
  if (thankYou.matched) return { activityType: 'THANK_YOU', confidence: thankYou.confidence, companyName }

  const introRequest = matchIntroRequest(subject, bodyPreview)
  if (introRequest.matched) return { activityType: 'INTRO_REQUEST', confidence: introRequest.confidence, companyName }

  // Covers both "following up" and "checking in" phrasing — see
  // matchFollowUp's comment in ats-patterns.ts for why these were merged.
  const followUp = matchFollowUp(subject, bodyPreview)
  if (followUp.matched) return { activityType: 'FOLLOW_UP', confidence: followUp.confidence, companyName }

  // Lowest priority — a bare networking keyword shouldn't steal a message
  // that already matched one of the more specific categories above.
  const networkingOutreach = matchNetworkingOutreach(subject, bodyPreview)
  if (networkingOutreach.matched) {
    return { activityType: 'NETWORKING_OUTREACH', confidence: networkingOutreach.confidence, companyName }
  }

  return { activityType: 'NEEDS_REVIEW', confidence: 'low', companyName }
}
