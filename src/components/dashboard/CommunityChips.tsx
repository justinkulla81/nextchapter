import Link from 'next/link'
import { leaveCommunityAction } from '@/app/dashboard/community/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

// Real joinable communities (Community rework Phase 4) — replaces the old
// CommunityFilterBar's per-dimension All/own toggles with one active-filter
// selection across whatever the candidate is actually a member of (City/
// Function/Industry auto-joined off their profile, Ex-Company off their
// layoff cohort). No browse-any-community picker here — see communities.ts.
export function CommunityChips({
  communities,
  activeCommunityId,
}: {
  communities: { membershipId: string; communityId: string; label: string }[]
  activeCommunityId?: string
}) {
  if (communities.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/dashboard/community"
        className={cn(
          'rounded-full px-3 py-1 text-sm font-medium',
          !activeCommunityId ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
        )}
      >
        All
      </Link>
      {communities.map((community) => (
        <div
          key={community.communityId}
          className={cn(
            'flex items-center gap-1 rounded-full pl-3 pr-1 py-1 text-sm font-medium',
            activeCommunityId === community.communityId
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Link href={`/dashboard/community?community=${community.communityId}`}>{community.label}</Link>
          <form action={leaveCommunityAction.bind(null, community.communityId)}>
            <SubmitButton
              variant="ghost"
              size="sm"
              className={cn(
                'h-auto rounded-full p-1 text-xs leading-none',
                activeCommunityId === community.communityId
                  ? 'text-primary-foreground hover:bg-primary-foreground/20'
                  : 'hover:bg-muted-foreground/20'
              )}
              aria-label={`Leave ${community.label}`}
            >
              ×
            </SubmitButton>
          </form>
        </div>
      ))}
    </div>
  )
}
