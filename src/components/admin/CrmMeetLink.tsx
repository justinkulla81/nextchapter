'use client'

import posthog from 'posthog-js'

/** Link to a Meet call or its Gemini notes doc; opens in a new tab and counts the click. */
export function CrmMeetLink({
  href, label, kind, personId, orgId,
}: {
  href: string
  label: string
  kind: 'join' | 'notes'
  personId?: string
  orgId?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline hover:no-underline"
      onClick={() => posthog.capture('crm_meeting_link_clicked', { kind, personId: personId ?? null, orgId: orgId ?? null })}
    >
      {label}
    </a>
  )
}
