import { prisma } from '@/lib/prisma'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { resolveNpsRespondent, type NpsAudience } from '@/lib/nps/respondent'
import { isNpsDue } from '@/lib/nps/score'
import { NpsPrompt } from '@/components/nps/NpsPrompt'

/**
 * Renders the NPS prompt when this person is due for it (see isNpsDue). Own
 * Suspense boundary in each portal layout, so the check never holds up a page.
 * Any failure reads as "not due": a survey must never break the portal.
 */
export async function NpsPromptLoader({ audience }: { audience: NpsAudience }) {
  let due = false
  try {
    const who = await resolveNpsRespondent(audience)
    if (who && !who.isSample) {
      const last = await prisma.npsResponse.findFirst({
        where: { audience, respondentId: who.id },
        orderBy: { createdAt: 'desc' },
        select: { score: true, createdAt: true },
      })
      due = isNpsDue({ now: new Date(), since: who.since, last })
    }
  } catch (e) {
    // A sign-in redirect is the portal's own business, not a survey failure.
    if (isRedirectError(e)) throw e
    console.error('NPS check failed:', e)
  }
  return due ? <NpsPrompt audience={audience} /> : null
}
