'use client'

import type { Webinar } from '@prisma/client'
import { registerForWebinarAction } from '@/app/dashboard/webinars/actions'
import { ActionLink } from '@/components/candidate/ActionLink'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

// The next live webinar, up front, with the one action that fits where the member is: save a seat, or join.
export function WebinarFeature({ webinar, isRegistered }: { webinar: Webinar; isRegistered: boolean }) {
  const when = webinar.scheduledAt.toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return (
    <section aria-labelledby="next-webinar" className="space-y-3 rounded-2xl border border-border p-6 sm:p-7">
      <p className="text-sm font-semibold text-muted-foreground">Live {when} · {webinar.durationMinutes} minutes</p>
      <h2 id="next-webinar" className="font-display text-2xl font-semibold text-ink">{webinar.title}</h2>
      {webinar.description && <p className="max-w-xl text-base text-ink">{webinar.description}</p>}
      <p className="text-sm text-muted-foreground">Hosted by {webinar.hostLabel}. Register and we keep your seat.</p>
      {isRegistered ? (
        webinar.meetLink ? (
          <ActionLink href={webinar.meetLink} external event="webinar_join_clicked" props={{ webinarId: webinar.id, source: 'videos_page' }}>
            Join the webinar
          </ActionLink>
        ) : (
          <p className="text-base font-semibold text-ink">You are registered. The join link appears here closer to the start.</p>
        )
      ) : (
        <form action={registerForWebinarAction.bind(null, webinar.id)}>
          <ActionSubmit pendingLabel="Saving your seat…" event="webinar_registered" props={{ webinarId: webinar.id, source: 'videos_page' }}>
            Save my seat
          </ActionSubmit>
        </form>
      )}
    </section>
  )
}
