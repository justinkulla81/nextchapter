import { cn } from '@/lib/utils'

// The one card pattern every Home module uses: a title, optional action, body.
// "dark" is reserved for the Unlocks module, the single navy block on a page.
export function HomeModule({
  title,
  action,
  tone = 'light',
  children,
}: {
  title: string
  action?: React.ReactNode
  tone?: 'light' | 'dark'
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'space-y-4 rounded-xl border p-6',
        tone === 'dark' ? 'border-navy bg-navy text-white' : 'border-border bg-white text-foreground'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
