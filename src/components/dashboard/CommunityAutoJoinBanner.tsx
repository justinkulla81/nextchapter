import { acknowledgeAutoJoinNoticesAction } from '@/app/dashboard/community/actions'
import { SubmitButton } from '@/components/ui/submit-button'

// Batches every pending auto-join into one specific-named banner — never a
// generic "you've joined some communities" line and never one toast per
// community. See getPendingAutoJoinNotices/acknowledgeAutoJoinNotices.
export function CommunityAutoJoinBanner({ notices, redesign = false }: { notices: { membershipId: string; label: string }[]; redesign?: boolean }) {
  if (notices.length === 0) return null

  if (redesign) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 p-5">
        <p className="max-w-xl text-base text-ink">
          We added you to <span className="font-semibold">{notices.map((n) => n.label).join(', ')}</span> because of your profile. You can leave any of them under Filter by group.
        </p>
        <form action={acknowledgeAutoJoinNoticesAction}>
          <SubmitButton variant="outline" className="h-10 rounded-full px-5 text-sm">
            Got it
          </SubmitButton>
        </form>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <p className="text-sm text-foreground">
        You&apos;ve been added to: <span className="font-medium">{notices.map((n) => n.label).join(', ')}</span> —
        based on your profile. You can leave any of these below.
      </p>
      <form action={acknowledgeAutoJoinNoticesAction}>
        <SubmitButton variant="outline" size="sm">
          Got it
        </SubmitButton>
      </form>
    </div>
  )
}
