'use client'

import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'

// Busy-cursor-on-submit per design-principles.md. Split into its own
// Client Component leaf so RoleContextBanner (which must stay a Server
// Component — role resolution has to happen before hydration, not after)
// can still get real pending-state UI on the switch button.
export function SwitchRoleSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'rounded-md border border-white/30 px-2 py-1 text-xs font-medium text-white underline-offset-4 hover:bg-white/10',
        pending && 'cursor-progress'
      )}
    >
      {pending ? 'Switching…' : `Switch to → ${label}`}
    </button>
  )
}
