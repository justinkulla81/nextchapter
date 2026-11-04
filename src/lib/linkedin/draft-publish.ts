import 'server-only'
import { prisma } from '@/lib/prisma'
import { commentAsPage, publishPagePost } from './page-posting'
import { renderDraftSlides } from './draft-slides'

export type PublishDraftResult =
  | { ok: true; postUrn: string; commented: boolean; angle: string; credibility: string }
  | { ok: false; reason: 'already-claimed' | 'failed'; error?: string }

/**
 * Publishes one draft as the NextChapter page: the text with its slides, then the link as the first comment.
 * The draft is claimed (set to POSTED) before anything is sent, so two callers can never post it twice; if
 * LinkedIn refuses, it goes back to DRAFT. Shared by the admin's "post" button and the scheduled publisher.
 */
export async function publishDraftAsPage(id: string, conn: { accessToken: string; organizationUrn: string }): Promise<PublishDraftResult> {
  const claimed = await prisma.linkedInPostDraft.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'POSTED', postedAt: new Date() } })
  if (claimed.count === 0) return { ok: false, reason: 'already-claimed' }
  const draft = await prisma.linkedInPostDraft.findUniqueOrThrow({ where: { id }, select: { body: true, firstComment: true, angle: true, credibility: true } })

  let postUrn: string
  try {
    const rendered = await renderDraftSlides(id)
    postUrn = await publishPagePost({ token: conn.accessToken, orgUrn: conn.organizationUrn, text: draft.body, images: rendered?.pngs, altText: `NextChapter: ${rendered?.employer ?? 'layoff'} layoff` })
  } catch (e) {
    await prisma.linkedInPostDraft.update({ where: { id }, data: { status: 'DRAFT', postedAt: null } })
    console.error('LinkedIn post failed for draft', id, e)
    return { ok: false, reason: 'failed', error: e instanceof Error ? e.message.slice(0, 200) : 'unknown' }
  }

  await prisma.linkedInPostDraft.update({ where: { id }, data: { postUrn } })
  let commented = true
  if (draft.firstComment.trim()) {
    try {
      await commentAsPage(conn.accessToken, conn.organizationUrn, postUrn, draft.firstComment)
    } catch (e) {
      commented = false
      console.error('LinkedIn first comment failed for draft', id, e)
    }
  }
  return { ok: true, postUrn, commented, angle: draft.angle, credibility: draft.credibility }
}
