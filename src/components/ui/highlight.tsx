import type { ReactNode } from 'react'

/** A marker behind the one number that matters. For counts and figures only, never for something you can click. */
export function Highlight({ children }: { children: ReactNode }) {
  return <mark className="rounded-sm bg-marker px-1 text-inherit">{children}</mark>
}
