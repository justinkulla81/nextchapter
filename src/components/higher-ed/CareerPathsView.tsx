// Candidate › Learn for students and recent graduates (owner, 2026-11-21): jobs people with their major take, the skills
// each asks for, which they already show, and what the college offers for the rest. Pure: the dev preview renders it.

import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import type { PathRole } from '@/lib/higher-ed/career-paths'

const KIND: Record<string, string> = { program: 'Program', audit: 'Audit a course', service: 'Offering' }

export function CareerPathsView({ majorLabel, roles, college, slug, student }: { majorLabel: string; roles: PathRole[]; college: string; slug: string; student: boolean }) {
  return (
    <section aria-labelledby="paths-h" className="space-y-3">
      <div>
        <h2 id="paths-h" className="text-base font-semibold">
          Jobs {majorLabel} graduates take
        </h2>
        <p className="text-sm text-muted-foreground">
          The skills each one asks for, the ones your résumé already shows, and what {college} offers for the rest{student ? ', while you’re still here' : ''}.
        </p>
      </div>
      <ul className="grid gap-3 lg:grid-cols-2">
        {roles.map((r) => {
          const shown = r.skills.filter((s) => s.have).length
          return (
            <li key={r.title} className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  You show {shown} of {r.skills.length}
                </p>
              </div>
              <ul className="space-y-2">
                {r.skills.map((s) => (
                  <li key={s.name} className="text-sm">
                    {s.have ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="size-3.5 text-success" aria-hidden="true" />
                        {s.name} <span className="text-xs text-muted-foreground">(you show it)</span>
                      </span>
                    ) : (
                      <div className="space-y-0.5">
                        <p>
                          {s.name} <span className="text-xs text-muted-foreground">(to build)</span>
                        </p>
                        {s.offerings.length ? (
                          s.offerings.slice(0, 2).map((o) => (
                            <Link key={o.key} href={`/i/${slug}/bridge?o=${encodeURIComponent(o.key)}&s=${encodeURIComponent(s.name)}`} className="group ml-4 flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                              {o.name} · {KIND[o.kind] ?? 'Offering'}
                              <ArrowRight className="size-3" aria-hidden="true" />
                            </Link>
                          ))
                        ) : (
                          <p className="ml-4 text-xs text-muted-foreground">Not offered by {college} yet.</p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
