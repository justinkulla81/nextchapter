// The daily digest's helper only reaches /api/admin/crm/, so this is the same feed as /api/admin/competitors/watch
// (new competitor events since the last digest) under a path the helper allows. Bearer key, read-only unless ?mark=1.
export const maxDuration = 60
export { GET } from '../../competitors/watch/route'
