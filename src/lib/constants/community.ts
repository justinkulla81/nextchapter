import type { CommunityPostType } from '@prisma/client'

export const COMMUNITY_POST_TYPE_LABELS: Record<CommunityPostType, string> = {
  JOB: 'Job opening',
  PROJECT: 'Project / consulting opportunity',
  INTRO_OFFER: 'Offer an intro',
  SELF_INTRO: 'Introduction',
  UPDATE: 'Update',
  MILESTONE: 'Milestone',
}
