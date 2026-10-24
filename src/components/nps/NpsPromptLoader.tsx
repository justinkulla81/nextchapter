import { prisma } from '@/lib/prisma'
import { resolveRequester } from '@/lib/help/requester'
import type { HelpAudience } from '@/lib/help/constants'
import { isNpsDue } from '@/lib/nps/score'
import { NpsPrompt } from '@/components/nps/NpsPrompt'

/**
 * Renders the NPS prompt when this person is due for it (see isNpsDue). Own
 * Suspense boundary in each portal layout, so the check never holds up a page.
 * Any failure reads as "not due": a survey must never break the portal.
 */
export async function NpsPromptLoader({ audience }: { audience: HelpAudience }) {
  let due = false
  try {
    const who = await resolveRequester(audience)
    if (who && !who.isSample) {
      const last = await prisma.npsResponse.findFirst({
        where: { audience, respondentId: who.id },
        orderBy: { createdAt: 'desc' },
        select: { score: true, createdAt: true },
      })
      due = isNpsDue({ now: new Date(), since: who.since, last })
    }
  } catch (e) {
    console.error('NPS check failed:', e)
  }
  return due ? <NpsPrompt audience={audience} /> : null
}
