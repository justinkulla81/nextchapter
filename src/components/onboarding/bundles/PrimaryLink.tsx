import type { ReactNode } from 'react'
import Link from 'next/link'

// The primary action when it is a plain move to the next page rather than a save: same look as PrimaryAction.
export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none">
      {children}
    </Link>
  )
}
