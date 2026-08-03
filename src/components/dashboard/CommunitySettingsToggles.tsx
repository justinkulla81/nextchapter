import { SubmitButton } from '@/components/ui/submit-button'
import { toggleWeeklySprintTargetOptOut, toggleEncouragementGiving } from '@/app/dashboard/community/actions'

export function CommunitySettingsToggles({
  weeklySprintTargetOptOut,
  encouragementGivingOptIn,
}: {
  weeklySprintTargetOptOut: boolean
  encouragementGivingOptIn: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Weekly Sprint Target recognition</p>
          <p className="text-sm text-muted-foreground">
            Show my name (first name, last initial) when I hit the Weekly Sprint Target.
          </p>
        </div>
        <form action={toggleWeeklySprintTargetOptOut.bind(null, weeklySprintTargetOptOut)}>
          <SubmitButton variant="outline" size="sm">
            {weeklySprintTargetOptOut ? 'Opted out' : 'Opted in'}
          </SubmitButton>
        </form>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Give encouragement</p>
          <p className="text-sm text-muted-foreground">
            Get occasional prompts to send a short, anonymous note to someone having a hard week.
          </p>
        </div>
        <form action={toggleEncouragementGiving.bind(null, encouragementGivingOptIn)}>
          <SubmitButton variant="outline" size="sm">
            {encouragementGivingOptIn ? 'Opted in' : 'Opted out'}
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
