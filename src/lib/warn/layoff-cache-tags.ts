// Shared data cache tags for the layoff record's cached reads, cleared together by publishLayoffsNow (src/lib/syndication/layoff-publish-now.ts)
// whenever a filing or announcement lands, so the reads can be held for hours and a new layoff still shows at once.
export const ANNOUNCEMENTS_TAG = 'shared-load:company-announcements-v1'
export const TOPIC_NOTICES_TAG = 'topic-notices'
export const LAYOFF_TRACKER_TAG = 'layoff-tracker'
