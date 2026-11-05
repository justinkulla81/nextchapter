import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { PullTop } from '@/components/capture/PullCta'
import { ANSWER_LABEL, formatCheckDate, type AlternativePage } from '@/lib/marketing/alternative-core'

// Generated from the competitor matrix. Every line about the competitor links to the page it was read from and shows
// the date it was checked. Every line about NextChapter comes from the capability catalog (BUILT or PARTIAL only).
export function AlternativePageTemplate({ page }: { page: AlternativePage }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0"><Logo className="text-2xl" /></Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="/vs" className="font-medium text-brand hover:text-navy">Compare</Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">{page.name}</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">{page.name} alternative: NextChapter vs. {page.name}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {page.segment ? `${page.name} is described as ${page.segment.toLowerCase()}. ` : ''}
          Below, each line about {page.name} links to the page it was read from and shows the date we checked it. Each line about NextChapter describes something already in the product.
        </p>
        <PullTop name={`${page.name} comparison`} path={`/vs/${page.slug}`} audience={page.forOrganizations ? 'org' : 'seeker'} />

        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight text-navy">Side by side</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {page.citedCount} capabilities, checked through {formatCheckDate(page.checkedThrough)}. Details change, so confirm current features on {page.host ?? `${page.name}'s site`} before you decide.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold text-navy">Capability</th>
                  <th className="py-2 pr-4 font-semibold text-navy">{page.name}</th>
                  <th className="py-2 font-semibold text-brand">NextChapter</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((r) => (
                  <tr key={r.capabilityKey} className="border-b border-border align-top">
                    <td className="py-3 pr-4 font-medium text-foreground">{r.name}<span className="block text-xs font-normal text-muted-foreground">{r.areaLabel}</span></td>
                    <td className="py-3 pr-4 text-foreground">
                      {ANSWER_LABEL[r.theirs]}
                      {r.theirNote ? <span className="block text-xs text-muted-foreground">{r.theirNote}</span> : null}
                      <span className="block text-xs text-muted-foreground">
                        <a href={r.evidenceUrl} rel="nofollow noopener noreferrer" target="_blank" className="underline underline-offset-2">Source</a>, checked {formatCheckDate(r.checkedAt)}
                      </span>
                    </td>
                    <td className="py-3 text-foreground">
                      {r.ours ? (r.oursStatus === 'PARTIAL' ? <>In part. {r.ours}</> : r.ours) : 'Not part of NextChapter today.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {page.theyShowAndWeLack.length > 0 && (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="text-xl font-bold tracking-tight text-navy">Where {page.name} shows something we do not have today</h2>
            <ul className="mt-4 space-y-2">
              {page.theyShowAndWeLack.map((r) => (
                <li key={r.capabilityKey} className="flex items-start gap-3 text-sm text-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{r.name}. If this matters most to you, look at {page.name}.</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {page.oursAlso.length > 0 && (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="text-xl font-bold tracking-tight text-navy">More of what NextChapter does in the same areas</h2>
            <p className="mt-2 text-sm text-muted-foreground">We have not compared these with {page.name}; they describe our product only.</p>
            <ul className="mt-4 space-y-3">
              {page.oursAlso.map((c) => (
                <li key={c.key} className="text-sm text-foreground"><span className="font-medium">{c.name}.</span> {c.description}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/vs" className="underline underline-offset-4">← All comparisons</Link>
          {' · '}
          <Link href="/pricing" className="underline underline-offset-4">Plans</Link>
        </div>
      </main>
    </div>
  )
}
