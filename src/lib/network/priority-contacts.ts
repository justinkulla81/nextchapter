// Encourages a real top-5 shortlist rather than starring everyone — also
// the point cap for CONTACT_PRIORITIZED (5 pts × 5 contacts = 25 pts total,
// awarded once per contact via priorityPointsAwardedAt, see
// toggleContactPriority in network/actions.ts). Lives in its own module
// (not exported from actions.ts) because a "use server" file may only
// export async functions — a plain const export there fails the build.
export const PRIORITY_CONTACT_TARGET_COUNT = 5
