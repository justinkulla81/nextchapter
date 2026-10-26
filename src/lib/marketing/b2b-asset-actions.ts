'use server'

import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { emailContactSubmission, fileContactInCrm } from '@/lib/contact/process-submission'
import { B2B_ASSETS, isB2bAssetKey } from '@/lib/marketing/b2b-assets'

// "Get the template" on a partner page. A work email and the organization, nothing else. The person is filed the same
// way a /contact message is (a ContactSubmission, a CRM person and organization, the note to the team), and gets the
// link on the spot: no email to wait for.

export type B2bAssetState = { error?: string; href?: string; email?: string; organization?: string } | undefined

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (f: FormData, k: string, max: number) => ((f.get(k) as string | null) ?? '').trim().slice(0, max)

export async function requestB2bAsset(_prev: B2bAssetState, formData: FormData): Promise<B2bAssetState> {
  // A field real people never see: filled in means a bot. Answer as if it worked, store nothing.
  if (text(formData, 'website', 200)) return { href: '/' }

  const keyRaw = text(formData, 'asset', 40)
  if (!isB2bAssetKey(keyRaw)) return { error: 'Something went wrong. Try again in a minute.' }
  const asset = B2B_ASSETS[keyRaw]
  const email = text(formData, 'email', 200).toLowerCase()
  const organization = text(formData, 'organization', 160)
  const page = /^[a-z0-9_-]{1,40}$/.test(text(formData, 'page', 40)) ? text(formData, 'page', 40) : 'unknown'

  if (!EMAIL.test(email)) return { error: 'Enter a valid work email address.', email, organization }
  if (!organization) return { error: 'Enter your organization’s name.', email, organization }
  if (!(await allowByIp('b2b-asset', 10, HOUR_MS))) return { error: 'Too many requests from this network. Try again later.', email, organization }

  try {
    const ip = await getClientIp()
    const sub = await prisma.contactSubmission.create({
      data: {
        audience: 'ORGANIZATION',
        fullName: email.split('@')[0],
        email,
        organization,
        message: `Asked for: ${asset.label}\nFrom the ${page} page.`,
        source: `asset:${asset.key}`,
        ip,
      },
    })
    const crmPersonId = await fileContactInCrm(sub)
    const emailed = await emailContactSubmission(sub, crmPersonId)
    await prisma.contactSubmission.update({ where: { id: sub.id }, data: { crmPersonId, emailedAt: emailed ? new Date() : null } })
    captureServerEvent(email, 'b2b_asset_requested', { asset: asset.key, page, emailDomain: email.split('@')[1], emailed })
    return { href: asset.href, email, organization }
  } catch (error) {
    console.error('b2b asset request failed:', error instanceof Error ? error.message : error)
    return { error: 'Something went wrong. Try again in a minute.', email, organization }
  }
}
