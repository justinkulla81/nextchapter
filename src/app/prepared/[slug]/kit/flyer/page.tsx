import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getOrgBrand } from '@/lib/branding/store'
import { orgThemeVars } from '@/lib/branding/theme'
import { boardKitContext } from '@/lib/org-claims/board-kit-data'
import { boardKitCopy, boardKitQrLink } from '@/lib/org-claims/board-kit'
import { SITE_URL } from '@/lib/org-claims/urls'
import { qrSvg } from '@/lib/qr/qr-svg'
import { prisma } from '@/lib/prisma'
import { PrintButton } from '@/components/org-kit/PrintButton'

// The board's flyer: one Letter page in its colors, with a QR code that goes to its page and counts as "Flyer and QR code". Print it, or
// choose "Save as PDF" in the print window.
export const metadata: Metadata = { robots: { index: false, follow: false }, title: { absolute: 'Flyer | NextChapter' } }
export const dynamic = 'force-dynamic'

export default async function BoardFlyerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await boardKitContext(slug)
  if (!ctx) notFound()
  const printLink = await prisma.referralLink.findFirst({ where: { label: `ob:${ctx.boardId}:print` }, select: { code: true } })
  if (!printLink) notFound()
  const brand = await getOrgBrand('WORKFORCE_BOARD', ctx.boardId)
  const copy = boardKitCopy({ boardName: ctx.name, area: ctx.area, links: { email: '', web: '', social: '', print: '' } })
  const qr = qrSvg(boardKitQrLink(SITE_URL, printLink.code, ctx.pagePath), { size: 190 })
  const vars = orgThemeVars(brand?.pair)

  return (
    <div style={vars} className="min-h-screen bg-neutral-200 py-6 print:bg-white print:py-0">
      <style>{`@page{size:Letter;margin:0}`}</style>
      <div className="mx-auto mb-4 flex max-w-[8.5in] justify-end px-4 print:hidden"><PrintButton boardId={ctx.boardId} /></div>
      <div className="mx-auto flex h-[11in] w-[8.5in] max-w-full flex-col bg-white shadow print:shadow-none">
        <div
          className={`px-12 py-10 ${brand ? '' : 'bg-navy text-white'}`}
          style={brand ? { backgroundColor: 'var(--org-1)', color: 'var(--org-1-ink)' } : undefined}
        >
          <p className="text-sm font-medium uppercase tracking-[0.14em] opacity-85">{ctx.name}</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight [text-wrap:balance]">{copy.flyer.headline}</h1>
        </div>
        <div className={`h-3 ${brand ? '' : 'bg-orange'}`} style={brand ? { backgroundColor: 'var(--org-2)' } : undefined} />
        <div className="flex flex-1 flex-col justify-between px-12 py-10">
          <div className="space-y-5 text-xl leading-relaxed text-neutral-800">
            {copy.flyer.lines.map((l) => <p key={l}>{l}</p>)}
          </div>
          <div className="flex items-center gap-8">
            <div className="rounded-lg border border-neutral-300 p-2" dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR code" role="img" />
            <div>
              <p className="font-serif text-3xl font-semibold text-neutral-900">{copy.flyer.scan}</p>
              <p className="mt-2 text-base text-neutral-600">Point your phone&apos;s camera at the code.</p>
            </div>
          </div>
          <p className="text-xs text-neutral-500">NextChapter is an independent platform and is not run by {ctx.name}.</p>
        </div>
      </div>
    </div>
  )
}
