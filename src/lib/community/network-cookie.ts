/** Cookie a visitor's "Join the … network" click leaves behind; the member app turns it into a membership once they are signed in. Value: `<kind>:<slug>`. */
export const PENDING_NETWORK_COOKIE = 'nc_join_network'
/** Set by role pages before networks covered functions and industries; its value is a bare role slug. Still read so a join in flight is not lost. */
export const LEGACY_PENDING_ROLE_COOKIE = 'nc_join_role'
export const PENDING_NETWORK_MAX_AGE_SECONDS = 60 * 60 * 24 * 14

/**
 * The public pages (launchyournextchapter.com) and the member app (candidate.launchyournextchapter.com) are different hosts, and
 * a cookie without a Domain stays on the host that set it. The click happens on the public page and the join is finished in the
 * member app, so the cookie must be shared across both. Undefined (host-only) anywhere else, such as localhost.
 */
export function networkCookieDomain(host: string | null | undefined): string | undefined {
  const h = (host ?? '').split(':')[0].toLowerCase()
  return h === 'launchyournextchapter.com' || h.endsWith('.launchyournextchapter.com') ? '.launchyournextchapter.com' : undefined
}
