import Link from 'next/link'

export interface PeerLink { name: string; href: string }

const H2 = 'text-2xl font-bold tracking-tight text-navy'

function Row({ links, cta }: { links: PeerLink[]; cta: string }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-3">
      {links.map((p) => (
        <li key={p.name}>
          <Link href={p.href} className="flex min-w-36 flex-col rounded-xl border border-border bg-white px-4 py-3 text-sm hover:border-brand">
            <span className="font-semibold text-navy">{p.name}</span>
            <span className="text-xs text-brand">{cta} →</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Two rows of employers: in the same metro (no move needed), and the same kind of company elsewhere (for people open to remote or relocating). A row with no matches is not shown. */
export function PeerEmployers({ company, near, similar, metro }: { company: string; near: PeerLink[]; similar: PeerLink[]; metro: string | null }) {
  if (!near.length && !similar.length) return null
  return (
    <div className="space-y-10">
      {near.length > 0 && (
        <section aria-labelledby="peers-near">
          <h2 id="peers-near" className={H2}>Who is hiring near {company}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Employers hiring most{metro ? ` in ${metro}` : ' nearby'}, the same line of work first. No move needed.</p>
          <Row links={near} cta="Open jobs" />
        </section>
      )}
      {similar.length > 0 && (
        <section aria-labelledby="peers-similar">
          <h2 id="peers-similar" className={H2}>Similar to {company}, if you are open to remote or relocating</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Companies in the same line of work, based elsewhere. Each link shows their open jobs.</p>
          <Row links={similar} cta="Open jobs" />
        </section>
      )}
    </div>
  )
}
