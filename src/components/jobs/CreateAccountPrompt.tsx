import { TrackedLink } from '@/components/marketing/TrackedLink'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Shown the moment someone saves a job or a search without an account: the save worked, and this
// is the one next step. The account keeps what they just saved and ranks it for them.
export const SAVE_ACCOUNT_HREF = '/onboarding/desire?from=job_save'

const GETS = ['A fit score and a reason on every job', 'Who to contact at the company', 'Your saved jobs and applications in one tracker']

export function CreateAccountPrompt({ what, properties }: { what: 'job' | 'search'; properties: Record<string, unknown> }) {
  return (
    <div className="mt-3 rounded-2xl border border-border bg-white p-4">
      <p className="text-sm font-semibold">Create your free account to keep {what === 'job' ? 'this job' : 'this search'} and see how you fit.</p>
      <ul className="mt-2 space-y-1 text-sm">
        {GETS.map((g) => (
          <li key={g} className="flex gap-2">
            <span aria-hidden className="text-success">✓</span>
            <span>{g}</span>
          </li>
        ))}
      </ul>
      <TrackedLink
        href={SAVE_ACCOUNT_HREF}
        event="save_create_account_clicked"
        properties={{ ...properties, what }}
        className={cn(buttonVariants({ size: 'lg' }), 'mt-3 h-12 w-full rounded-full bg-action text-action-foreground hover:brightness-95 sm:w-auto sm:px-6')}
      >
        Create my free account
      </TrackedLink>
      <p className="mt-2 text-xs text-muted-foreground">Use the same email and your saved {what === 'job' ? 'job is' : 'search is'} waiting in it.</p>
    </div>
  )
}
