export const LINKEDIN_PRESENCE_POINTS = 8

// Rolling-window decay — same pattern as COMMUNITY_POINTS_* in community.ts.
// Candidates must keep posting to maintain the bonus, not just post once.
export const LINKEDIN_POINTS_PER_LOG = 0.7
export const LINKEDIN_POINTS_WINDOW_DAYS = 30
export const LINKEDIN_POINTS_CAP = 10
