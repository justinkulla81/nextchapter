'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { BookOpen, PartyPopper, Video, X } from 'lucide-react'
import { Dialog, DialogClose, DialogPopup } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const UNLOCKED_PAGES = [
  {
    href: '/dashboard/learning',
    icon: BookOpen,
    label: 'Learn New Skills',
    description: 'Courses picked for the skills you just told us you want to build.',
  },
  {
    href: '/dashboard/webinars',
    icon: Video,
    label: 'Videos and Webinars',
    description: 'Videos matched to your skills and target role.',
  },
] as const

// One-time celebration shown right after a candidate's first-ever Skills
// Assessment completion — the exact moment DashboardNav flips
// skillsAssessmentCompleted from false to true and unlocks these two nav
// items (see the skillsLock object there). No animation/toast library
// exists in this codebase (checked package.json), so this leans on the
// Dialog primitive's own built-in enter/exit transition rather than adding
// one, and reuses the same orange/Lock visual language LockedFeatureNotice
// uses for the locked state — inverted here to brand-colored icons for the
// unlocked moment.
export function SkillsUnlockDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const posthog = usePostHog()

  useEffect(() => {
    if (open) posthog?.capture('skills_unlock_dialog_shown')
  }, [open, posthog])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="w-[min(92vw,26rem)] rounded-xl border border-border bg-white p-6 shadow-lg">
        <DialogClose className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <div className="flex items-center gap-2">
          <PartyPopper className="size-5 text-brand" />
          <h2 className="text-lg font-semibold tracking-tight">New pages unlocked!</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Completing your Skills Assessment just unlocked:
        </p>

        <div className="mt-4 space-y-3">
          {UNLOCKED_PAGES.map(({ href, icon: Icon, label, description }) => (
            <Link
              key={href}
              href={href}
              onClick={() => {
                posthog?.capture('skills_unlock_dialog_link_clicked', { href })
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
          ))}
        </div>

        <Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>
          Got it
        </Button>
      </DialogPopup>
    </Dialog>
  )
}
