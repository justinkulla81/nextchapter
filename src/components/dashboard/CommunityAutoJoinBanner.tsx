import { acknowledgeAutoJoinNoticesAction } from '@/app/dashboard/community/actions'
import { SubmitButton } from '@/components/ui/submit-button'

// Batches every pending auto-join into one specific-named banner — never a
// generic "you've joined some communities" line and never one toast per
// community. See getPendingAutoJoinNotices/acknowledgeAutoJoinNotices.
export function CommunityAutoJoinBanner({ notices }: { notices: { membershipId: string; label: string }[] }) {
  if (notices.length === 0) return null

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
