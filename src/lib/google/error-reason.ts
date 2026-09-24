/**
 * Google answers both "this token can't read Gmail" and "slow down" with a
 * 403 — only the body says which. Returns " <reason>" (e.g.
 * " ACCESS_TOKEN_SCOPE_INSUFFICIENT", " rateLimitExceeded") to append to an
 * error message, or "" when there's nothing to add.
 */
export async function googleErrorReason(res: Response): Promise<string> {
  try {
    const body = await res.text()
    const m = body.match(/"reason"\s*:\s*"([A-Za-z_]+)"/)
    return m ? ` ${m[1]}` : ''
  } catch {
    return ''
  }
}

/** A 403 that reconnecting (with every permission box ticked) fixes. */
export function isMissingPermission(error: string): boolean {
  return /ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions|PERMISSION_DENIED/.test(error)
}

/** Google's rate limit — waiting fixes it, reconnecting doesn't. */
export function isRateLimited(error: string): boolean {
  return /\b429\b|rateLimitExceeded|userRateLimitExceeded|RESOURCE_EXHAUSTED|quotaExceeded/.test(error)
}
