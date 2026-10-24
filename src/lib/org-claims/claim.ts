import 'server-only'
import { prisma } from '@/lib/prisma'
import { addContactToCrm } from '@/lib/crm/add-contact'
import { goalsForRoles } from '@/lib/crm/goals'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendOrgClaimAdminEmail, sendOrgClaimLinkEmail } from '@/lib/email/send-org-claim-email'
import { orgSlug } from '@/lib/crm/org-slug'
import { provisionFreeWorkspace } from '@/lib/plans/provision'
import { resolveClaimableOrg } from './org'
import { checkClaimEmail } from './rules'
import { CLAIM_TOKEN_DAYS, hashClaimToken, hashIp, newClaimToken, tokenState } from './token'
import { SITE_URL } from './urls'

/** At most this many claim requests per IP and per email address in an hour. */
export const MAX_REQUESTS_PER_IP_PER_HOUR = 5
export const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 3

export interface RequestClaimInput {
  slug: string
  name: string
  title: string
  email: string
  ip: string | null
}
export type RequestClaimResult = { ok: true; email: string; needsReview: boolean } | { ok: false; error: string }

const siteUrl = () => (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/$/, '')

/**
 * Step 1: someone enters name, title and work email. Personal providers and addresses off the organization's known domain are
 * refused before anything is stored. Otherwise a one-time link (7 days, stored hashed) goes to that address.
 */
export async function requestOrgClaim(input: RequestClaimInput): Promise<RequestClaimResult> {
  const org = await resolveClaimableOrg(input.slug)
  if (!org) return { ok: false, error: 'This page is no longer available.' }
  const name = input.name.trim().replace(/\s+/g, ' ').slice(0, 120)
  const title = input.title.trim().slice(0, 120)
  if (name.split(' ').length < 2) return { ok: false, error: 'Enter your first and last name.' }
  if (title.length < 2) return { ok: false, error: 'Enter your title.' }

  const check = checkClaimEmail(input.email, org.emailDomain)
  if (!check.ok) {
    captureServerEvent(`org-claim:${org.id}`, 'org_claim_rejected', { orgId: org.id, slug: org.slug, reason: check.reason })
    return { ok: false, error: check.message }
  }

  const ipHash = input.ip ? hashIp(input.ip) : null
  const since = new Date(Date.now() - 3_600_000)
  const [byIp, byEmail] = await Promise.all([
    ipHash ? prisma.orgClaim.count({ where: { ipHash, createdAt: { gte: since } } }) : Promise.resolve(0),
    prisma.orgClaim.count({ where: { email: check.email, createdAt: { gte: since } } }),
  ])
  if (byIp >= MAX_REQUESTS_PER_IP_PER_HOUR || byEmail >= MAX_REQUESTS_PER_EMAIL_PER_HOUR) {
    captureServerEvent(`org-claim:${org.id}`, 'org_claim_rejected', { orgId: org.id, slug: org.slug, reason: 'rate_limited' })
    return { ok: false, error: 'Too many requests. Wait an hour and try again, or use the link in the email we already sent.' }
  }

  const { token, tokenHash, expiresAt } = newClaimToken()
  // An older unconfirmed link for the same person and organization stops working; the newest one is the only live link.
  await prisma.orgClaim.updateMany({ where: { crmOrganizationId: org.id, email: check.email, verifiedAt: null, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date() } })
  const claim = await prisma.orgClaim.create({
    data: { crmOrganizationId: org.id, name, title, email: check.email, emailDomain: check.domain, tokenHash, expiresAt, needsReview: check.needsReview, ipHash },
    select: { id: true },
  })
  const sent = await sendOrgClaimLinkEmail({ to: check.email, name, orgName: org.name, verifyUrl: `${siteUrl()}/prepared/${org.slug}/verify/${token}`, days: CLAIM_TOKEN_DAYS })
  captureServerEvent(`org-claim:${org.id}`, 'org_claim_requested', { orgId: org.id, slug: org.slug, claimId: claim.id, emailDomain: check.domain, needsReview: check.needsReview, emailSent: sent })
  if (!sent) return { ok: false, error: 'We could not send the confirmation email. Try again in a few minutes.' }
  return { ok: true, email: check.email, needsReview: check.needsReview }
}

/** The facts of a verified claim, as handed to onClaimVerified. */
export interface VerifiedClaim {
  id: string
  crmOrganizationId: string
  orgName: string
  orgTypes: string[]
  slug: string | null
  name: string
  title: string
  email: string
  emailDomain: string
  needsReview: boolean
  verifiedAt: Date
}

/**
 * ── HOOK: runs once, right after a claim is verified. ──
 * Today it only records the claimant in the CRM (a P0 lead due today) and emails the team.
 * Then, when the claimant's email matched the organization's known domain, it sets up the organization's free workspace
 * with the claimant as its administrator (owner decision 2026-10-24). It must stay safe to fail: the claim is already
 * verified when this runs.
 */
export async function onClaimVerified(claim: VerifiedClaim): Promise<{ provisioned: boolean }> {
  const roles = claim.orgTypes.includes('EMPLOYER') ? (['HIRING_MANAGER', 'OUTPLACEMENT_BUYER'] as const) : (['BD_PARTNER'] as const)
  const pageUrl = claim.slug ? `${SITE_URL}/prepared/${claim.slug}` : SITE_URL
  const r = await addContactToCrm({
    fullName: claim.name, title: claim.title, email: claim.email, orgId: claim.crmOrganizationId, orgName: claim.orgName,
    roles: [...roles], goals: goalsForRoles([...roles]), priority: 'P0',
    note: `Claimed the ${claim.orgName} page (${pageUrl}) with a verified work email at ${claim.emailDomain}.${claim.needsReview ? ' No email domain was on file for the organization, so this needs a person to confirm they work there.' : ''}`,
  })
  if (r.outcome !== 'removed') {
    await prisma.crmPerson.update({ where: { id: r.personId }, data: { nextFollowUpAt: new Date(), nextFollowUpNote: `Claimed the ${claim.orgName} page. Reply today.` } })
  }
  await sendOrgClaimAdminEmail({ orgName: claim.orgName, name: claim.name, title: claim.title, email: claim.email, needsReview: claim.needsReview, pageUrl })
  return { provisioned: await provisionIfEligible(claim) }
}

// Organization types that get a free higher education or workforce workspace (src/lib/plans/provision.ts maps them to an
// Institution). Employers, coaches and recruiter firms have no free workspace yet, so their claims stay a CRM lead.
export const FREE_WORKSPACE_TYPES = ['UNIVERSITY', 'GOVERNMENT', 'WORKFORCE_PROVIDER', 'NONPROFIT', 'FOUNDATION']

/**
 * A claim whose email domain matched the organization's known domain gets a free workspace straight away. A claim with no
 * known domain (needsReview) waits for a person to confirm it. Never throws.
 */
export async function provisionIfEligible(claim: VerifiedClaim): Promise<boolean> {
  if (claim.needsReview) return false
  const type = FREE_WORKSPACE_TYPES.find((t) => claim.orgTypes.includes(t))
  if (!type) return false
  try {
    const r = await provisionFreeWorkspace({ crmOrganizationId: claim.crmOrganizationId, name: claim.orgName, orgType: type, claimantEmail: claim.email })
    if (!r.ok) console.error('Free workspace not created for claim', claim.id, r.error)
    return r.ok
  } catch (e) {
    console.error('provisionFreeWorkspace failed for claim', claim.id, e)
    return false
  }
}

export type ConfirmResult =
  | { status: 'verified'; orgName: string; slug: string | null; provisioned: boolean }
  | { status: 'already'; orgName: string; slug: string | null }
  | { status: 'expired' | 'invalid' }

/**
 * Step 2: the claimant uses the link. Single use: the claim flips to verified in one conditional update, so two clicks
 * cannot both succeed. An expired, unknown or already-used link never runs the hook again.
 */
export async function confirmOrgClaim(token: string): Promise<ConfirmResult> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { status: 'invalid' }
  const tokenHash = hashClaimToken(token)
  const found = await prisma.orgClaim.findUnique({
    where: { tokenHash },
    include: { crmOrganization: { select: { name: true, canonicalNameNormalized: true, orgTypes: true } } },
  })
  if (!found) return { status: 'invalid' }
  const slug = orgSlug(found.crmOrganization.canonicalNameNormalized)
  const state = tokenState(found)
  if (state === 'used') return { status: 'already', orgName: found.crmOrganization.name, slug }
  if (state === 'expired') {
    captureServerEvent(`org-claim:${found.crmOrganizationId}`, 'org_claim_verify_failed', { orgId: found.crmOrganizationId, claimId: found.id, reason: 'expired' })
    return { status: 'expired' }
  }

  const now = new Date()
  const won = await prisma.orgClaim.updateMany({ where: { id: found.id, verifiedAt: null, expiresAt: { gt: now } }, data: { verifiedAt: now } })
  if (won.count !== 1) return { status: 'already', orgName: found.crmOrganization.name, slug }

  captureServerEvent(`org-claim:${found.crmOrganizationId}`, 'org_claim_verified', { orgId: found.crmOrganizationId, slug, claimId: found.id, emailDomain: found.emailDomain, needsReview: found.needsReview })
  let provisioned = false
  try {
    const hook = await onClaimVerified({
      id: found.id, crmOrganizationId: found.crmOrganizationId, orgName: found.crmOrganization.name, orgTypes: found.crmOrganization.orgTypes.map(String), slug,
      name: found.name, title: found.title, email: found.email, emailDomain: found.emailDomain, needsReview: found.needsReview, verifiedAt: now,
    })
    provisioned = hook.provisioned
  } catch (e) {
    console.error('onClaimVerified failed', found.id, e)
  }
  return { status: 'verified', orgName: found.crmOrganization.name, slug, provisioned }
}
