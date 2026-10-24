/** Replies go to help-<requestId>@<inbound domain>. Pure, so both the sender and the receiver can import it. */
export const HELP_REPLY_PREFIX = 'help-'
export const helpRequestIdFromLocal = (local: string): string | null =>
  local.startsWith(HELP_REPLY_PREFIX) && local.length > HELP_REPLY_PREFIX.length ? local.slice(HELP_REPLY_PREFIX.length) : null
