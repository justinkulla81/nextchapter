import 'server-only'
import { prisma } from '@/lib/prisma'
import { fetchArticle } from './fetch-article'
import { classifyResearchItem } from './classify'
import { sendPrHookAlertEmail } from '@/lib/email/send-pr-hook-alert'
import type { ResearchLibraryItem } from '@prisma/client'

// The single ingestion pipeline shared by every entry point (manual
// quick-submit now, the Gmail inbox sweep later) — fetch, classify,
// persist. Never throws: a fetch/classify failure still produces a
// permanent row (marked fetchFailed) rather than silently dropping the URL,
// per Prompt 64's "store what's available... rather than failing silently."
export async function ingestResearchUrl(
  url: string,
  ingestionSource: 'inbox' | 'manual'
): Promise<ResearchLibraryItem> {
  const fetched = await fetchArticle(url)

  if (fetched.status !== 'success' || !fetched.text) {
    return prisma.researchLibraryItem.create({
      data: {
        url,
        ingestionSource,
        title: fetched.title,
        fetchFailed: true,
        status: 'new',
        needsReview: true,
      },
    })
  }

  try {
    const classification = await classifyResearchItem(url, fetched.title, fetched.text)
    const item = await prisma.researchLibraryItem.create({
      data: {
        url,
        ingestionSource,
        title: fetched.title,
        fetchedContent: fetched.text,
        fetchFailed: false,
        summary: classification.summary,
        bucket: classification.bucket,
        confidenceScore: classification.confidenceScore,
        needsReview: classification.needsReview,
        credibilityTier: classification.credibilityTier,
        suggestedAction: classification.suggestedAction,
        contradictsLockedDecision: classification.contradictsLockedDecision,
        personaTag: classification.personaTag,
        status: 'new',
      },
    })

    // PR/media hooks are high priority — an immediate alert, not queued for
    // the weekly digest cycle. Fired here, at classification time, so it
    // fires identically regardless of ingestion source (manual now, inbox
    // sweep later).
    if (item.bucket === 'PR_MEDIA_HOOK') {
      await sendPrHookAlertEmail({
        title: item.title,
        url: item.url,
        summary: item.summary,
        suggestedAction: item.suggestedAction,
      })
    }

    return item
  } catch {
    // Classification failure — still persist what we fetched, just unclassified.
    return prisma.researchLibraryItem.create({
      data: {
        url,
        ingestionSource,
        title: fetched.title,
        fetchedContent: fetched.text,
        fetchFailed: false,
        status: 'new',
        needsReview: true,
      },
    })
  }
}
