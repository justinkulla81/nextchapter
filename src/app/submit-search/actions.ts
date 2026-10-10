'use server'

import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { emailDomain, readSearchRequest, validateSearchRequest, valuesOf, type SearchRequestValues } from '@/lib/search-firms/search-request'

export type SubmitSearchState = { error?: string; sent?: boolean; values?: SearchRequestValues } | undefined

/**
 * Saves a search for a person to shortlist. No email goes back to the
 * submitter: replies to recruiters stay manual until counsel clears NYC
 * Local Law 144 (see RecruiterSettings.intakeAutoRepliesEnabled), so the
 * confirmation is the on-screen message only.
 */
export async function submitSearch(_prev: SubmitSearchState, formData: FormData): Promise<SubmitSearchState> {
  // Bots fill every field, including the one people never see.
  if ((formData.get('website') as string | null)?.trim()) return { sent: true }

  const input = readSearchRequest((n) => formData.get(n))
  const error = validateSearchRequest(input)
  if (error) return { error, values: valuesOf(input) }

  const domain = emailDomain(input.contactEmail)
  const firm = domain ? await prisma.searchFirm.findFirst({ where: { domain }, select: { id: true } }) : null

  const request = await prisma.searchRequest.create({ data: { ...input, searchFirmId: firm?.id ?? null } })

  captureServerEvent(input.contactEmail, 'search_request_submitted', {
    searchRequestId: request.id,
    confidential: input.confidential,
    level: input.level,
    function: input.function,
    knownFirm: !!firm,
    searchFirmId: firm?.id ?? null,
    ref: input.ref,
  })
  return { sent: true }
}
