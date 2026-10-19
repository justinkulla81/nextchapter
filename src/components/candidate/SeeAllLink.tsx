import Link from 'next/link'

// The way back to everything on a page the redesign has simplified. Nothing is deleted: the full page stays
// one link away, and this is the line that says so.
export function SeeAllLink({ href, children = 'See everything on this page' }: { href: string; children?: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      <Link href={href} className="font-medium text-brand underline underline-offset-4">
        {children}
      </Link>
    </p>
  )
}
