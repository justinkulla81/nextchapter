'use server'

import { submitContactForm, type ContactFormValues } from '@/app/contact/actions'
import { LEAD_OFFERS, isLeadOfferKey } from '@/lib/marketing/lead-landing'

export type LeadFormState =
  | { error?: string; sent?: boolean; name?: string; email?: string; values?: Pick<ContactFormValues, 'fullName' | 'email' | 'organization'> }
  | undefined

/**
 * The short form on the /lp/<offer> pages: name, work email, organization and an optional choice. It files the lead
 * through the same action as the Contact form (CRM person, Help inbox thread, email to the team, the per-hour limit
 * and the bot field), with the offer, the choice and the ad's tracking tags written into the message so the team sees
 * which ad and which promise the lead came from.
 */
export async function submitLead(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const text = (k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)
  const key = text('offer', 20)
  if (!isLeadOfferKey(key)) return { error: 'Something went wrong. Reload the page and try again.' }
  const offer = LEAD_OFFERS[key]

  const choice = text('choice', 60)
  const tags = text('tags', 300)
  const message = [
    `Lead page: ${offer.path}`,
    `Offer: ${offer.form.title}`,
    choice ? `${offer.form.choicesLabel}: ${choice}` : null,
    tags ? `Ad tags: ${tags}` : null,
  ].filter(Boolean).join('\n')

  const fd = new FormData()
  fd.set('audience', 'ORGANIZATION')
  fd.set('fullName', text('fullName', 120))
  fd.set('email', text('email', 200))
  fd.set('organization', text('organization', 160))
  fd.set('message', message)
  fd.set('source', `lp-${key}`)
  fd.set('website', text('website', 200))

  const result = await submitContactForm(undefined, fd)
  if (result?.sent) return { sent: true, name: result.name, email: result.email }
  const v = result?.values
  return {
    error: result?.error ?? 'Something went wrong. Please try again.',
    values: { fullName: v?.fullName ?? '', email: v?.email ?? '', organization: v?.organization ?? '' },
  }
}
