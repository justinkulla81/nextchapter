import { BellOff } from 'lucide-react'

// Never color alone (spec §11): an icon and the words.
export function DoNotSolicitBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-900">
      <BellOff className="size-3" aria-hidden="true" />
      Do not solicit
    </span>
  )
}
