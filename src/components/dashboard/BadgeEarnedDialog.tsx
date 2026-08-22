'use client'

import { useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Award, X } from 'lucide-react'
import { Dialog, DialogClose, DialogPopup } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { acknowledgeBadgeNotices } from '@/app/dashboard/actions'

export interface BadgeNotice {
  id: string
  source: 'weekly' | 'milestone'
  badgeKey: string
  label: string
  description: string
}

// Auto-opens on mount whenever the server found unnotified badges (see
// getPendingBadgeNotices) — no trigger click needed, same "surface it the
// next time they load a page" shape as CommunityAutoJoinBanner, just as a
// celebratory Dialog instead of an inline banner since these are meant to
// feel like a real "you earned this" moment. Any close path (X, backdrop,
// Escape, "Got it") routes through onOpenChange so acknowledgment always
// fires exactly once, regardless of how the candidate dismissed it.
export function BadgeEarnedDialog({ notices }: { notices: BadgeNotice[] }) {
  const [open, setOpen] = useState(notices.length > 0)
  const posthog = usePostHog()

  if (notices.length === 0) return null

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) return
    posthog?.capture('badge_earned_dialog_dismissed', { badgeKeys: notices.map((n) => n.badgeKey) })
    acknowledgeBadgeNotices({
      weeklyIds: notices.filter((n) => n.source === 'weekly').map((n) => n.id),
      milestoneIds: notices.filter((n) => n.source === 'milestone').map((n) => n.id),
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className="w-[min(92vw,26rem)] rounded-xl border border-border bg-white p-6 shadow-lg">
        <DialogClose className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <div className="flex items-center gap-2">
          <Award className="size-5 text-brand" />
          <h2 className="text-lg font-semibold tracking-tight">
            {notices.length === 1 ? 'New badge!' : `${notices.length} new badges!`}
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Real work you logged just earned this.</p>

        <div className="mt-4 space-y-3">
          {notices.map((n) => (
            <div key={n.id} className="rounded-lg border border-brand/30 bg-brand/5 p-3">
              <p className="text-sm font-medium text-foreground">{n.label}</p>
              <p className="text-xs text-muted-foreground">{n.description}</p>
            </div>
          ))}
        </div>

        <Button className="mt-5 w-full" onClick={() => handleOpenChange(false)}>
          Got it
        </Button>
      </DialogPopup>
    </Dialog>
  )
}
