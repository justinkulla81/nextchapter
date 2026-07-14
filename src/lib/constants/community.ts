import type { CommunityPostType } from '@prisma/client'

export const COMMUNITY_POST_TYPE_LABELS: Record<CommunityPostType, string> = {
  JOB: 'Job opening',
  PROJECT: 'Project / consulting opportunity',
  INTRO_OFFER: 'Offer an intro',
  SELF_INTRO: 'Introduction',
  UPDATE: 'Update',
}

// Points decay — see the rolling-window calc in employability-score.ts.
// Candidates must keep posting to maintain the bonus, not just post once.
export const COMMUNITY_POINTS_PER_POST = 0.5
export const COMMUNITY_POINTS_WINDOW_DAYS = 30
export const COMMUNITY_POINTS_CAP = 5
