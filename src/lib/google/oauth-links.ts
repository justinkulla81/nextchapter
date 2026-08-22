// Appends the page to return to once the OAuth round trip finishes — read
// by the matching /api/auth/*/start route and carried through to the
// callback via storeOAuthReturnState/consumeOAuthReturnState
// (src/lib/google/oauth-return-path.ts). Every caller of a
// /api/auth/{gmail,calendar,google-connect}/start link should build its
// href through this rather than a bare path, or the candidate lands back on
// whatever the callback's fallback is instead of where they clicked from.
export function withOAuthReturnTo(startPath: string, returnTo: string): string {
  return `${startPath}?returnTo=${encodeURIComponent(returnTo)}`
}
