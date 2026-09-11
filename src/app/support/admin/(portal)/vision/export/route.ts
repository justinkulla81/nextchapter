import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { KIND_LABELS, STATUS_LABELS, BUCKET_LABELS, SOURCE_LABELS, OVERLAP_LABELS } from '@/lib/vision/labels'

export const maxDuration = 60

/**
 * A Markdown bundle for pasting into Claude.
 *
 * Carries the EVIDENCE, not a summary of it: every linked piece of feedback is
 * quoted verbatim and attributed. Asking "what should I build next" against
 * eight real tester quotes gets a different answer than asking it against a
 * tidy summary of them — and the summary is the easy half to reproduce later,
 * while the quotes are not.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  const include = new Set((req.nextUrl.searchParams.get('include') ?? 'vision,items,feedback,competitors').split(','))

  const [doc, items, competitors, features] = await Promise.all([
    include.has('vision') ? prisma.productVisionDoc.findFirst({ where: { isCurrent: true } }) : null,
    include.has('items')
      ? prisma.productItem.findMany({
          where: { status: { not: 'SPARK' } },
          orderBy: [{ bucket: 'asc' }, { priority: { sort: 'asc', nulls: 'last' } }],
          include: {
            feedbackLinks: { include: { feedback: { include: { person: { select: { fullName: true } } } } } },
            blockedBy: { select: { title: true } },
          },
        })
      : [],
    include.has('competitors')
      ? prisma.productCompetitor.findMany({ orderBy: { name: 'asc' }, include: { cells: { include: { item: { select: { title: true } } } } } })
      : [],
    prisma.productItem.findMany({ where: { kind: 'FEATURE' }, select: { id: true, title: true } }),
  ])

  const unlinked = include.has('feedback')
    ? await prisma.productFeedback.findMany({
        where: { links: { none: {} }, status: { not: 'ARCHIVED' } },
        include: { person: { select: { fullName: true } } },
        orderBy: { receivedAt: 'desc' },
      })
    : []

  const out: string[] = []
  const stamp = new Date().toISOString().slice(0, 10)

  out.push(`# NextChapter — product context (${stamp})`)
  out.push('')
  out.push('Exported from NextChapter Vision. Feedback is quoted verbatim and attributed; nothing here is a summary.')
  out.push('')

  if (doc) {
    out.push('---', '', `## Master product vision (version ${doc.version})`, '')
    if (doc.changeNote) out.push(`_Last change: ${doc.changeNote}_`, '')
    out.push(doc.bodyMarkdown, '')
  }

  if (items.length > 0) {
    out.push('---', '', '## Roadmap', '')
    for (const b of ['NOW', 'NEXT', 'LATER', 'UNSCHEDULED'] as const) {
      const rows = items.filter((i) => i.bucket === b)
      if (rows.length === 0) continue
      out.push(`### ${BUCKET_LABELS[b]}`, '')
      for (const i of rows) {
        out.push(`#### ${i.title}`)
        const meta = [
          KIND_LABELS[i.kind],
          STATUS_LABELS[i.status],
          i.priority ? `priority ${i.priority}` : null,
          i.effort !== 'UNKNOWN' ? `effort ${i.effort}` : null,
        ].filter(Boolean).join(' · ')
        out.push(`_${meta}_`, '')
        if (i.body) out.push(i.body, '')
        if (i.costDriver) out.push(`**Cost driver:** ${i.costDriver}`, '')
        if (i.blockedBy) out.push(`**Blocked by:** ${i.blockedBy.title}`, '')
        if (i.wontDoReason) out.push(`**Not doing because:** ${i.wontDoReason}`, '')
        if (i.feedbackLinks.length > 0) {
          out.push(`**What ${i.feedbackLinks.length} ${i.feedbackLinks.length === 1 ? 'person' : 'people'} actually said:**`, '')
          for (const l of i.feedbackLinks) {
            const who = l.feedback.person?.fullName ?? l.feedback.personLabel ?? 'Unattributed'
            out.push(`> ${l.feedback.rawText.replace(/\n/g, '\n> ')}`)
            out.push(`> — ${who}, ${SOURCE_LABELS[l.feedback.source]}, ${l.feedback.receivedAt.toISOString().slice(0, 10)}`, '')
          }
        }
        out.push('')
      }
    }
  }

  if (unlinked.length > 0) {
    out.push('---', '', '## Feedback not yet linked to anything', '')
    out.push('_Raw, untriaged. Often the most useful part of a bundle like this._', '')
    for (const f of unlinked) {
      const who = f.person?.fullName ?? f.personLabel ?? 'Unattributed'
      out.push(`> ${f.rawText.replace(/\n/g, '\n> ')}`)
      out.push(`> — ${who}, ${SOURCE_LABELS[f.source]}, ${f.receivedAt.toISOString().slice(0, 10)}`, '')
    }
  }

  if (competitors.length > 0) {
    out.push('---', '', '## Competitors', '')
    for (const c of competitors) {
      out.push(`### ${c.name}`)
      const firmo = [
        c.segment, c.positioning,
        c.fundingRaisedUsd ? `raised $${c.fundingRaisedUsd.toLocaleString()}` : null,
        c.headcount ? `${c.headcount} staff` : null,
        c.revenueNote, c.userCountNote,
      ].filter(Boolean).join(' · ')
      if (firmo) out.push(firmo)
      out.push(c.lastReviewedAt
        ? `_Last reviewed ${c.lastReviewedAt.toISOString().slice(0, 10)}${c.sourceUrl ? ` — ${c.sourceUrl}` : ''}_`
        : '_Never reviewed — treat these numbers as unverified._')
      out.push('')
      const known = c.cells.filter((x) => x.overlap !== 'UNKNOWN')
      if (known.length > 0) {
        for (const cell of known) out.push(`- ${cell.item.title}: **${OVERLAP_LABELS[cell.overlap]}**`)
        out.push('')
      }
      const unchecked = features.length - known.length
      if (unchecked > 0) out.push(`_${unchecked} of our features not yet checked against them._`, '')
    }
  }

  captureServerEvent(admin.email ?? 'admin', 'vision_exported', {
    items: items.length, unlinkedFeedback: unlinked.length, competitors: competitors.length, hasVision: Boolean(doc),
  })

  return new Response(out.join('\n'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="nextchapter-product-context-${stamp}.md"`,
    },
  })
}
