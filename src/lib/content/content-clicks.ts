import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ContentLikeType } from '@prisma/client'

// Fire-and-forget click log, one row per click (no toggle/upsert — unlike
// Like/Dislike, every open is its own event, feeding the admin Stats tab's
// per-item click counts). Called from logContentClickAction in
// src/app/dashboard/webinars/actions.ts without awaiting, so a slow/failed
// write never delays the video player opening.
export async function logContentClick(
  candidateId: string,
  contentType: ContentLikeType,
  contentId: string
): Promise<void> {
  await prisma.contentClick.create({ data: { candidateId, contentType, contentId } })
}
