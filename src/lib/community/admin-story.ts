import 'server-only'
import { prisma } from '@/lib/prisma'
import { getSystemCandidateProfile } from '@/lib/community/system-account'
import { captureServerEvent } from '@/lib/posthog/server'
import { fetchArticle } from '@/lib/research/fetch-article'

export interface CreateAdminStoryInput {
  title?: string | null
  description: string
  externalUrl?: string | null
}

// Admin-authored content posted directly into the Community feed under the
// system CandidateProfile (see system-account.ts) — trusted at write time,
// so unlike createModeratedCommunityPost this skips the classifier and the
// per-candidate location/company/school snapshot (none of that applies to
// admin content) and publishes immediately.
export async function createAdminStoryPost(
  adminEmail: string | null | undefined,
  { title = null, description, externalUrl = null }: CreateAdminStoryInput
): Promise<{ postId: string }> {
  const system = await getSystemCandidateProfile()

  // Best-effort og:image, fetched once at creation time — same fetcher the
  // Research Library's URL ingestion already uses. A failed/imageless fetch
  // just means the card renders without a thumbnail, never blocks posting.
  const image = externalUrl
    ? await fetchArticle(externalUrl)
        .then((result) => result.image)
        .catch(() => null)
    : null

  const post = await prisma.communityPost.create({
    data: {
      candidateId: system.id,
      postType: 'ADMIN_STORY',
      title,
      description,
      externalUrl,
      imageUrl: image,
      isActive: true,
      moderationStatus: 'PUBLISHED',
      moderatedAt: new Date(),
    },
  })

  captureServerEvent(adminEmail ?? 'admin', 'admin_story_posted', { postId: post.id })
  return { postId: post.id }
}
