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
              : code === 'missing_gmail' || code === 'missing_calendar' || code === 'missing_both'
                ? // Google's consent screen lets members untick each permission.
                  `Google didn't give us ${
                    code === 'missing_gmail' ? 'Gmail' : code === 'missing_calendar' ? 'Calendar' : 'Gmail or Calendar'
                  } access, and we need both to track your search. We only read, and we never send or delete. Try again and leave both boxes ticked.`
                : code === 'work_account'
                  ? 'That looks like a work or school Google account. Use your personal Gmail so your search stays private from your employer.'
                  : code === 'not_gmail'
                    ? 'For now we can only connect a personal Gmail account. Use your Gmail address, or continue with email instead.'
                    : code === 'no_identity'
                      ? "We couldn't confirm which Google account that was. Please try again."
                      : null
}
