'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ActionLink } from '@/components/candidate/ActionLink'
import { posthog } from '@/lib/posthog/client'

// The one primary action on the prep page. With a Meet link it opens the call in a new tab and takes this tab to the
// notes; without one it just opens the notes. Both record which it was.
export function PrepPrimaryAction({
  label,
  hint,
  meetUrl,
  notesHref,
  coachId,
  candidateId,
}: {
  label: string
  hint: string
  meetUrl: string | null
  notesHref: string
  coachId: string
  candidateId: string
}) {
  const router = useRouter()
  const props = { coachId, candidateId, hasMeetUrl: meetUrl !== null }
  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      {meetUrl ? (
        <ActionLink href={meetUrl} external kind="primary" event="coach_prep_primary_clicked" props={props} onClick={() => router.push(notesHref)}>
          {label}
        </ActionLink>
      ) : (
        <ActionLink href={notesHref} kind="primary" event="coach_prep_primary_clicked" props={props}>
          {label}
        </ActionLink>
      )}
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

/** Records that the page was opened, with what a query would need to tell a full page from a thin one. */
export function PrepViewed({ properties }: { properties: Record<string, unknown> }) {
  useEffect(() => {
    posthog.capture('coach_prep_viewed', properties)
    // Once per page view: the properties describe this load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
