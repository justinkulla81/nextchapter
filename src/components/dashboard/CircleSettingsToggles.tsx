import { Button } from '@/components/ui/button'
import { toggleAListOptOut, toggleEncouragementGiving } from '@/app/dashboard/circle/actions'

export function CircleSettingsToggles({
  aListOptOut,
  encouragementGivingOptIn,
}: {
  aListOptOut: boolean
  encouragementGivingOptIn: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">A-List recognition</p>
          <p className="text-sm text-muted-foreground">
            Show my name (first name, last initial) when I earn a weekly A-List spot.
          </p>
        </div>
        <form action={toggleAListOptOut.bind(null, aListOptOut)}>
          <Button type="submit" variant="outline" size="sm">
            {aListOptOut ? 'Opted out' : 'Opted in'}
          </Button>
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
          <Button type="submit" variant="outline" size="sm">
            {encouragementGivingOptIn ? 'Opted in' : 'Opted out'}
          </Button>
        </form>
      </div>
    </div>
  )
}
