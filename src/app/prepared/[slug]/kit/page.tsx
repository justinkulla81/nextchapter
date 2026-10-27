import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CopyBlock } from '@/components/org-kit/CopyBlock'
import { getOrgBrand } from '@/lib/branding/store'
import { orgThemeVars } from '@/lib/branding/theme'
import { boardKitContext, boardKitStats } from '@/lib/org-claims/board-kit-data'
import { BOARD_KIT_SOURCES, boardKitCopy, boardKitLink, boardKitQrLink, type BoardKitSource } from '@/lib/org-claims/board-kit'
import { SITE_URL } from '@/lib/org-claims/urls'
import { qrSvg } from '@/lib/qr/qr-svg'
import { captureServerEvent } from '@/lib/posthog/server'
import { prisma } from '@/lib/prisma'

// A workforce board's launch kit: its page in its own colors, the words to send, a flyer with a QR code, and what its sends brought in.
// Unlisted, like the claim page it belongs to; it holds no personal information. The links are created ahead of time
// (scripts/branding/prepare-board-kits.ts); a board without them has no kit page.
export const metadata: Metadata = { robots: { index: false, follow: false }, title: { absolute: 'Your launch kit | NextChapter' } }
export const dynamic = 'force-dynamic'

export default async function BoardKitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await boardKitContext(slug)
  if (!ctx) notFound()
  const rows = await prisma.referralLink.findMany({ where: { label: { startsWith: `ob:${ctx.boardId}:` } }, select: { label: true, code: true } })
  const codes = Object.fromEntries(rows.map((r) => [r.label.split(':')[2], r.code])) as Partial<Record<BoardKitSource, string>>
  if (BOARD_KIT_SOURCES.some((s) => !codes[s.source])) notFound()

  const [brand, stats] = await Promise.all([getOrgBrand('WORKFORCE_BOARD', ctx.boardId), boardKitStats(ctx.boardId)])
  const links = Object.fromEntries(BOARD_KIT_SOURCES.map((s) => [s.source, boardKitLink(SITE_URL, codes[s.source]!, ctx.pagePath)])) as Record<BoardKitSource, string>
  const copy = boardKitCopy({ boardName: ctx.name, area: ctx.area, links })
  const qr = qrSvg(boardKitQrLink(SITE_URL, codes.print!, ctx.pagePath), { size: 144 })
  const vars = orgThemeVars(brand?.pair)
  captureServerEvent(`org-kit:${ctx.boardId}`, 'org_kit_viewed', { kind: 'WORKFORCE_BOARD', boardId: ctx.boardId, branded: !!brand })

  return (
    <div style={vars} className="min-h-screen bg-off-white">
      <header
        className={`px-4 py-8 sm:px-6 ${brand ? '' : 'bg-navy text-white'}`}
        style={brand ? { backgroundColor: 'var(--org-1)', color: 'var(--org-1-ink)' } : undefined}
      >
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-medium uppercase tracking-[0.14em] opacity-80">Launch kit · {ctx.name}</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight sm:text-4xl [text-wrap:balance]">Send your people to a page that already looks like yours.</h1>
          <p className="mt-3 max-w-2xl opacity-90">
            Your page is built in the colors we read from your website. Below is what to send with it. Every link is tracked, so you can see which place brought people in.
          </p>
          <Link
            href={ctx.pagePath}
            className={`mt-5 inline-block rounded-full px-5 py-2 text-sm font-semibold ${brand ? 'bg-[var(--org-cta)] text-[var(--org-cta-ink)]' : 'bg-orange text-navy'}`}
          >
            See your page
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6">
        <section aria-labelledby="send-h" className="space-y-4">
          <h2 id="send-h" className="font-serif text-2xl font-semibold text-navy">What to send</h2>
          <CopyBlock title={`Email: ${copy.email.subject}`} note="For your newsletter, a mailing to past participants, or a note to employers and partners." text={copy.email.body} boardId={ctx.boardId} block="email" />
          <CopyBlock title="Your website or newsletter" note="A short line with the link. Put it on a page job seekers already visit." text={copy.newsletter} boardId={ctx.boardId} block="web" />
          <CopyBlock title="Social post" note="For LinkedIn, Facebook and the rest." text={copy.social} boardId={ctx.boardId} block="social" />
        </section>

        <section aria-labelledby="print-h" className="space-y-4">
          <h2 id="print-h" className="font-serif text-2xl font-semibold text-navy">Flyer and QR code</h2>
          <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border bg-white p-5">
            <div className="rounded-lg border border-border bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR code for the flyer link" role="img" />
            <div className="min-w-0 flex-1 space-y-2 text-sm text-muted-foreground">
              <p>Print the flyer, or save it as a PDF from the print window. The QR code goes to your page and is counted as the flyer.</p>
              <Link href={`/prepared/${slug}/kit/flyer`} className="inline-block rounded-full border border-border px-4 py-1.5 font-medium text-navy hover:bg-off-white">Open the flyer</Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="results-h" className="space-y-4">
          <h2 id="results-h" className="font-serif text-2xl font-semibold text-navy">What your sends brought in</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="p-3 font-medium">Where</th><th className="p-3 font-medium">Clicks</th><th className="p-3 font-medium">Started an account</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.sources.map((s) => (
                  <tr key={s.source}><td className="p-3 font-medium text-navy">{s.label}</td><td className="p-3 tabular-nums">{s.clicks.toLocaleString('en-US')}</td><td className="p-3 tabular-nums">{s.joined == null ? 'Shown at 10 or more' : s.joined.toLocaleString('en-US')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Counts only, never names. A number under 10 is held back so no one can be picked out of a small group.</p>
        </section>

        <section aria-labelledby="claim-h" className="rounded-xl border border-border bg-white p-6">
          <h2 id="claim-h" className="font-serif text-xl font-semibold text-navy">Make it yours</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Claim the page with a work email at your organization&apos;s domain to set up a free workspace.</p>
          <Link href={`/prepared/${slug}`} className="mt-4 inline-block rounded-full bg-orange px-5 py-2 text-sm font-semibold text-navy hover:bg-orange/90">Claim this page</Link>
        </section>

        <p className="text-xs text-muted-foreground">NextChapter is an independent platform and is not run by {ctx.name}. This page is unlisted and shows no personal information.</p>
      </main>
    </div>
  )
}
