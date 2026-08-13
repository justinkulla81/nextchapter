import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ContentLikeType } from '@prisma/client'

interface DislikeableContent {
  contentType: ContentLikeType
  contentId: string
}

// One-directional "not interested" — no undo UI (see ContentDislike's
// schema comment). Upsert-safe: a duplicate click on an already-disliked
// item is a no-op, not an error. Disliking something also deletes any
// existing ContentLike for the same item — mutual exclusivity, symmetric
// with toggleContentLike deleting the ContentDislike on a Like.
//
// For CURATED_VIDEO (includes Shorts), the video's channelTitle is looked
// up and denormalized onto the ContentDislike row so the author-block rule
// (2+ dislikes from the same channel excludes the whole channel, see
// getCarouselVideos in curated-content.ts) can query it directly.
export async function dislikeContent(candidateId: string, content: DislikeableContent): Promise<void> {
  let channelTitle: string | null = null
  if (content.contentType === 'CURATED_VIDEO') {
    const video = await prisma.curatedVideo.findUnique({
      where: { id: content.contentId },
      select: { channelTitle: true },
    })
    channelTitle = video?.channelTitle ?? null
  }

  await prisma.contentDislike.upsert({
    where: {
      candidateId_contentType_contentId: {
        candidateId,
        contentType: content.contentType,
        contentId: content.contentId,
      },
    },
    update: {},
    create: {
      candidateId,
      contentType: content.contentType,
      contentId: content.contentId,
      channelTitle,
    },
  })

  await prisma.contentLike.deleteMany({
    where: { candidateId, contentType: content.contentType, contentId: content.contentId },
  })
}
