/** Cookie a signed-out visitor's "Join the … network" click leaves behind; the dashboard turns it into a membership after signup. Value: `<kind>:<slug>`. */
export const PENDING_NETWORK_COOKIE = 'nc_join_network'
/** Set by role pages before networks covered functions and industries; its value is a bare role slug. Still read so a signup in flight is not lost. */
export const LEGACY_PENDING_ROLE_COOKIE = 'nc_join_role'
export const PENDING_NETWORK_MAX_AGE_SECONDS = 60 * 60 * 24 * 14
