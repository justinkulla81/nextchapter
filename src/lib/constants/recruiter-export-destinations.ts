// ATS export destinations a firm can be enabled for — Master Build Script
// §A6.4 "export destinations enabled per firm." Kept as a plain constants
// file (not exported from actions.ts) since a "use server" file can only
// export async functions, not values.
export const EXPORT_DESTINATIONS = ['greenhouse', 'lever', 'bullhorn'] as const
