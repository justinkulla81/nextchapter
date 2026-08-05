import type { NetworkComfortLevel } from '@prisma/client'

const COMFORT_LABEL: Record<NetworkComfortLevel, string> = {
  VERY_COMFORTABLE: 'very comfortable',
  SOMEWHAT_COMFORTABLE: 'somewhat comfortable',
  NOT_VERY_COMFORTABLE: 'not very comfortable',
  RATHER_NOT: "you'd rather not",
}

const ENCOURAGEMENT: Record<NetworkComfortLevel, string> = {
  VERY_COMFORTABLE:
    "Good — that's a real advantage. Most people find this the hardest part of a search, and you're not starting from a place of dread.",
  SOMEWHAT_COMFORTABLE:
    "That's a normal place to be. You don't have to feel fully ready to start — just willing to send one message.",
  NOT_VERY_COMFORTABLE:
    "That discomfort is common, and it doesn't mean you're doing this wrong. Start with the one or two people who'd be easiest to reach out to, not the hardest.",
  RATHER_NOT:
    "That's honest, and worth naming. This part of a search asks something real of you, and it's okay if it doesn't feel good.",
}

export function NetworkEncouragement({ comfortLevel }: { comfortLevel: NetworkComfortLevel }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-off-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        You told us
      </p>
      <p className="text-sm text-foreground">
        You said {COMFORT_LABEL[comfortLevel]} letting your network know you&apos;re looking.{' '}
        {ENCOURAGEMENT[comfortLevel]}
      </p>
      <p className="text-sm font-medium text-foreground">
        Here&apos;s the honest truth, though: most roles get filled through a connection, not a
        cold application. Skipping this step is one of the highest-cost decisions you can make in
        a search — so even a little, done consistently, matters more than waiting to feel ready.
      </p>
    </div>
  )
}
