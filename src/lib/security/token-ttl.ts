// How long a link token stays usable, counted from when it was issued. Only
// tokens that are the SOLE credential need a lifetime: invites that are also
// bound to the invited email at accept time (seats, org users, coach clients,
// institution staff) are already useless to anyone not logged in as that
// person.
export const TOKEN_TTL_DAYS = {
  /** College "join" link: signs the holder in as the roster email. */
  higherEdJoin: 90,
  /** Interview panelist scorecard link: submits scores with no login. */
  scorecard: 120,
  /** Employer-written reference waiting to be claimed by the candidate. */
  employerReferenceClaim: 180,
} as const

export function isTokenExpired(issuedAt: Date | null | undefined, ttlDays: number, now: number = Date.now()): boolean {
  if (!issuedAt) return false
  return now > issuedAt.getTime() + ttlDays * 86_400_000
}
