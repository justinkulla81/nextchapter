'use client'

import { logReferenceFollowUp } from '@/app/dashboard/references/actions'

// Wraps the existing "Follow up" mailto/Gmail-compose link with a
// fire-and-forget click log — the link itself still navigates normally;
// this only records that a genuine follow-up nudge happened, so it can
// earn Sprint credit like the app's other auto-detected action types.
export function ReferenceFollowUpLink({ referenceId, href }: { referenceId: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-medium text-primary underline underline-offset-4"
      onClick={() => {
        logReferenceFollowUp(referenceId).catch(() => {})
      }}
    >
      Follow up
    </a>
  )
}
