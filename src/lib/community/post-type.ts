import type { CommunityPostType } from '@prisma/client'

// System-generated or admin-authored posts — never reportable (there's no
// author to report against, or it's the platform itself), but still
// likeable. Shared by CommunityPostCard.tsx and CommunityStreamItem.tsx so
// the two render paths can't drift.
export function isAutomatedPostType(postType: CommunityPostType): boolean {
  return postType === 'MILESTONE' || postType === 'LIKED_CONTENT' || postType === 'ADMIN_STORY'
}
