'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { PartyPopper, X, Megaphone, Share2, Users, Compass, BookOpen, Video } from 'lucide-react'
import { Dialog, DialogClose, DialogPopup } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// A Lucide icon is a component reference, not serializable data — a
// producer of UnlockItem[] that's a Server Component (search-strategy/
// page.tsx's per-step `unlock` config) can't pass one directly to this
// Client Component; React throws "Functions cannot be passed directly to
// Client Components" at request time (not caught by tsc, only surfaces on
// a real render). A string key resolved to the real component here, inside
// the client boundary, sidesteps that entirely — client-only producers
// (GigDirectoryUnlockForm, SkillsAssessmentForm) use the same keys for
// consistency, even though they could pass a component reference safely.
const UNLOCK_ICON_MAP = {
  megaphone: Megaphone,
  share2: Share2,
  users: Users,
  compass: Compass,
  'book-open': BookOpen,
  video: Video,
} as const

export type UnlockIconKey = keyof typeof UNLOCK_ICON_MAP

export interface UnlockItem {
  href: string
  icon: UnlockIconKey
  label: string
  description: string
}

// Generic "you just unlocked X" celebration — generalized from the one-off
// SkillsUnlockDialog (Skills Assessment → Learning + Videos) so any
// unlock/badge-award moment across the app can reuse the same pattern
// instead of hand-rolling its own dialog. No animation/toast library exists
// in this codebase (checked package.json), so this leans on the Dialog
// primitive's own built-in enter/exit transition, and reuses the same
// orange/Lock visual language LockedFeatureNotice uses for the locked
// state — inverted here to brand-colored icons for the unlocked moment.
// `analyticsKey` namespaces the PostHog events (e.g. "skills",
// "marketing_plan_willingness") so each trigger site's opens/clicks are
// distinguishable in the data.
export function UnlockAnnouncementDialog({
  open,
  onOpenChange,
  title = 'New pages unlocked!',
  introText,
  items,
  analyticsKey,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  introText: string
  items: UnlockItem[]
  analyticsKey: string
}) {
  const posthog = usePostHog()

  useEffect(() => {
    if (open) posthog?.capture('unlock_dialog_shown', { key: analyticsKey })
  }, [open, posthog, analyticsKey])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="w-[min(92vw,26rem)] rounded-xl border border-border bg-white p-6 shadow-lg">
        <DialogClose className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <div className="flex items-center gap-2">
          <PartyPopper className="size-5 text-brand" />
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{introText}</p>

        <div className="mt-4 space-y-3">
          {items.map(({ href, icon, label, description }) => {
            const Icon = UNLOCK_ICON_MAP[icon]
            return (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  posthog?.capture('unlock_dialog_link_clicked', { key: analyticsKey, href })
                  onOpenChange(false)
                }}
                className="flex items-start gap-3 rounded-lg border border-brand/30 bg-brand/5 p-3 transition-colors hover:bg-brand/10"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-brand" />
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </Link>
            )
          })}
        </div>

        <Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>
          Got it
        </Button>
      </DialogPopup>
    </Dialog>
  )
}
