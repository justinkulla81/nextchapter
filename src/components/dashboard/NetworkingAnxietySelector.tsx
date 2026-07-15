import type { NetworkingAnxiety } from '@prisma/client'
import { SubmitButton } from '@/components/ui/submit-button'
import { setNetworkingAnxiety } from '@/app/dashboard/network/actions'

const OPTIONS: { value: NetworkingAnxiety; label: string }[] = [
  { value: 'SEEM_DESPERATE', label: "I don't want to seem desperate" },
  { value: 'BURDEN_PEOPLE', label: "I don't want to burden people" },
  { value: 'NOT_SURE_WHAT_TO_SAY', label: "I'm not sure what to say" },
  { value: 'NETWORK_NOT_STRONG', label: "My network isn't strong enough" },
  { value: 'DONT_LIKE_ASKING_FOR_HELP', label: "I don't like asking for help" },
  { value: 'ALREADY_USED_UP_NETWORK', label: "I've already used up my network" },
  { value: 'OTHER', label: 'Something else' },
]

export function NetworkingAnxietySelector({ current }: { current: NetworkingAnxiety | null }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        What concerns do you have about reaching out to your network?
      </p>
      <p className="text-sm text-muted-foreground">
        Most job searches are won or lost on this one thing. Answer honestly — it shapes the
        outreach scripts you&apos;ll use below, and naming the real hesitation is the first step
        past it.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {OPTIONS.map((opt) => (
          <form key={opt.value} action={setNetworkingAnxiety.bind(null, opt.value)}>
            <SubmitButton variant={current === opt.value ? 'default' : 'outline'} size="sm">
              {opt.label}
            </SubmitButton>
          </form>
        ))}
      </div>
    </div>
  )
}
