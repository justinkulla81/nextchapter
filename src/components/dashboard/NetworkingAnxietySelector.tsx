import type { NetworkingAnxiety } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { setNetworkingAnxiety } from '@/app/dashboard/network/actions'

const OPTIONS: { value: NetworkingAnxiety; label: string }[] = [
  { value: 'SEEM_DESPERATE', label: "I don't want to seem desperate" },
  { value: 'BURDEN_PEOPLE', label: "I don't want to burden people" },
  { value: 'NOT_SURE_WHAT_TO_SAY', label: "I'm not sure what to say" },
  { value: 'NETWORK_NOT_STRONG', label: "My network isn't strong enough" },
  { value: 'OTHER', label: 'Something else' },
]

export function NetworkingAnxietySelector({ current }: { current: NetworkingAnxiety | null }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        What&apos;s your biggest concern about reaching out to people in your network?
      </p>
      <p className="text-sm text-muted-foreground">This shapes the outreach scripts below.</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {OPTIONS.map((opt) => (
          <form key={opt.value} action={setNetworkingAnxiety.bind(null, opt.value)}>
            <Button type="submit" variant={current === opt.value ? 'default' : 'outline'} size="sm">
              {opt.label}
            </Button>
          </form>
        ))}
      </div>
    </div>
  )
}
