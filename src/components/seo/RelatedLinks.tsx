import Link from 'next/link'
import { relatedLinks } from '@/lib/seo/keywords'

/** "Related" links for an owner page, from the keyword map's RELATED table, so every cluster is linked from the pages around it. */
export function RelatedLinks({ path, className = 'mt-12' }: { path: string; className?: string }) {
  const links = relatedLinks(path)
  if (links.length === 0) return null
  return (
    <nav aria-labelledby="related-heading" className={className}>
      <h2 id="related-heading" className="text-xl font-semibold tracking-tight text-navy">Related</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-brand underline underline-offset-4">{l.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
