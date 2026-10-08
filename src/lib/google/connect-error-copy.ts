// What a failed Google connect came back with (?gmailError= / ?calendarError=,
// set by the /api/auth/*/start and /api/auth/*/callback routes). Shared by
// the network page's banners and GoogleConnectResultBanner.
export function googleConnectErrorMessage(code: string, kind: 'gmail' | 'calendar'): string | null {
  const label = kind === 'gmail' ? 'Gmail' : 'Calendar'
  return code === 'not_a_tester'
    ? `We just requested ${label} access for your account — this app is still in Google's testing mode, so it takes us a few minutes to approve new accounts by hand. Try again shortly.`
    : code === 'not_logged_in'
      ? 'Please log in first.'
      : code === 'no_refresh_token' || code === 'exchange_failed'
        ? 'Something went wrong connecting — please try again.'
        : code === 'not_configured'
          ? `${label} connection is not available right now.`
          : code === 'denied'
            ? "Connection wasn't completed."
            : code === 'corporate_domain_blocked'
              ? // §4.6 — spec's exact copy.
                "Use a personal account. Connecting your work email would put your job search inside your employer's systems, where they can see it. We'll only connect a personal account while Confidential Search Mode is on."
              : null
}
