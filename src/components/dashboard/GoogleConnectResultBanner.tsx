'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { googleConnectErrorMessage } from '@/lib/google/connect-error-copy'

// These pages render their own connect result in context.
const HAS_OWN_BANNER = ['/dashboard/network', '/dashboard/privacy']

/**
 * The Google connect routes send the candidate back to whichever dashboard
 * page they clicked Connect on, with ?gmailConnected / ?gmailError (or the
 * calendar equivalents). Most pages don't read those, so this shows the
 * outcome on any page that doesn't.
 */
export function GoogleConnectResultBanner() {
  const pathname = usePathname()
  const params = useSearchParams()
  if (HAS_OWN_BANNER.includes(pathname)) return null

  const gmailError = params.get('gmailError')
  const calendarError = params.get('calendarError')
  const error = gmailError ? googleConnectErrorMessage(gmailError, 'gmail')
    : calendarError ? googleConnectErrorMessage(calendarError, 'calendar') : null
  if (error) {
    return <p role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
  }

  const gmail = params.get('gmailConnected')
  const calendar = params.get('calendarConnected')
  if (!gmail && !calendar) return null
  const what = gmail && calendar ? 'Gmail and Calendar' : gmail ? 'Gmail' : 'Calendar'
  return (
    <p role="status" className="mb-6 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
      {what} connected. Your activity will start counting automatically.
    </p>
  )
}
