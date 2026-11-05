import { START_PAYOFF } from '@/lib/onboarding/start-gate'

// The reminder of what the five short steps lead to, shown once at the top of the first question and again on the account
// step (owner decision 2026-11-05: the email box states the payoff, and the registration path restates it, bigger). The lines
// are the same ones the email box promised (src/lib/onboarding/start-gate.ts), so the promise never changes between screens.
export function PathPayoff({ lead }: { lead: string }) {
  return (
    <div className="rounded-2xl bg-navy p-5 text-white">
      <p className="text-base font-semibold">{lead}</p>
      <ul className="mt-2 space-y-1.5 text-sm text-white/90">
        {START_PAYOFF.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden className="font-bold">✓</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
